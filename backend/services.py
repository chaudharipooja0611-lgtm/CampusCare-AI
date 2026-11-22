"""Business logic shared by routes, the SLA monitor and the seeding script."""
import csv
import json
import os
import random
import string

from config import Config
from db import query, execute, run
from ml import classifier, train as trainer
from utils import ApiError, OPEN_STATUSES

SEVERITY_BY_PRIORITY = {"High": "warning", "Medium": "info", "Low": "info"}


# ----------------------------------------------------------------------------- notifications
def notify(user_id, message, complaint_id=None, type="info", severity="info"):
    execute("INSERT INTO notifications (user_id, complaint_id, message, type, severity) VALUES (%s,%s,%s,%s,%s)",
            (user_id, complaint_id, message[:255], type, severity))


def notify_department(department_id, message, complaint_id, type="info", severity="info"):
    if not department_id:
        return
    for u in query("SELECT id FROM users WHERE role='department' AND department_id=%s", (department_id,)):
        notify(u["id"], message, complaint_id, type, severity)


def notify_admins(message, complaint_id, type="info", severity="info"):
    for u in query("SELECT id FROM users WHERE role='admin'"):
        notify(u["id"], message, complaint_id, type, severity)


def add_timeline(complaint_id, user_id, status, note):
    execute("INSERT INTO complaint_updates (complaint_id, user_id, status, note) VALUES (%s,%s,%s,%s)",
            (complaint_id, user_id, status, note[:500]))


# ----------------------------------------------------------------------------- helpers
def sla_hours(priority):
    return Config.SLA_HOURS.get(priority, Config.SLA_HOURS["Medium"])


def generate_ticket():
    for _ in range(20):
        ticket = "CC-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        if not query("SELECT id FROM complaints WHERE ticket_id=%s", (ticket,), one=True):
            return ticket
    raise ApiError("Could not generate a ticket ID, please retry", 500)


def route_department(category):
    return query("SELECT id, name FROM departments WHERE category=%s ORDER BY id LIMIT 1", (category,), one=True)


def open_candidates():
    return query("""SELECT id, ticket_id, title, status, CONCAT(title, '. ', description) AS text FROM complaints
                    WHERE status IN ('Assigned','In Progress') AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    ORDER BY id DESC LIMIT 300""")


def analyze(text, with_duplicates=True):
    result = {"prediction": classifier.predict(text), "sentiment": classifier.analyze_sentiment(text), "duplicates": []}
    if with_duplicates:
        result["duplicates"] = classifier.find_duplicates(text, open_candidates())
    result["sla_hours"] = sla_hours(result["prediction"]["priority"])
    return result


# ----------------------------------------------------------------------------- escalation
def critical_reason(pred, sent):
    """Rule-based auto-escalation for critical complaints, evaluated at submission time."""
    if pred["priority"] != "High":
        return None
    if pred["category"] == "Safety":
        return "High-priority safety complaint"
    hazards = pred.get("explanation", {}).get("priority", {}).get("urgent_keywords", [])
    if hazards:
        return "Urgent / hazard keywords detected: " + ", ".join(hazards[:4])
    if sent["score"] <= -0.5:
        return "High-priority complaint with strongly negative sentiment"
    return None


def escalate(c, level, reason, by_user_id=None):
    """Raise a complaint to `level` (1 = escalated, 2 = critical). Atomic: returns False if already at/above that level."""
    n = run("UPDATE complaints SET escalation_level=%s, escalated_at=NOW(), escalation_reason=%s WHERE id=%s AND escalation_level<%s",
            (level, reason[:255], c["id"], level))
    if not n:
        return False
    label = "Escalated" if level == 1 else "Critical escalation"
    add_timeline(c["id"], by_user_id, c["status"], f"{label}: {reason}")
    msg = f"{label}: {c['ticket_id']} – {reason}"
    notify_admins(msg, c["id"], "escalation", "critical")
    notify_department(c.get("department_id"), msg, c["id"], "escalation", "critical")
    return True


# ----------------------------------------------------------------------------- complaint creation
def create_complaint(user_id, title, description, location, image_path=None, created_at=None):
    text = f"{title}. {description}"
    a = analyze(text)
    pred, sent, dups = a["prediction"], a["sentiment"], a["duplicates"]
    dept = route_department(pred["category"])
    dept_id = dept["id"] if dept else None
    ticket = generate_ticket()
    cid = execute(
        """INSERT INTO complaints (ticket_id, user_id, title, description, location, image_path, category,
           predicted_category, priority, confidence, sentiment, sentiment_score, status, department_id,
           duplicate_of, duplicate_score, explanation, sla_due_at, created_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'Assigned',%s,%s,%s,%s,
                   DATE_ADD(COALESCE(%s, NOW()), INTERVAL %s HOUR), COALESCE(%s, NOW()))""",
        (ticket, user_id, title, description, location, image_path, pred["category"], pred["category"],
         pred["priority"], pred["confidence"], sent["label"], sent["score"], dept_id,
         dups[0]["id"] if dups else None, dups[0]["similarity"] if dups else None,
         json.dumps(pred["explanation"]), created_at, sla_hours(pred["priority"]), created_at))
    note = (f"Complaint submitted. AI classified it as {pred['category']} ({pred['confidence']}% confidence, "
            f"{pred['priority']} priority) and routed it to {dept['name'] if dept else 'the admin team'}. "
            f"Target resolution: {sla_hours(pred['priority'])}h.")
    execute("INSERT INTO complaint_updates (complaint_id, user_id, status, note, created_at) VALUES (%s,%s,'Assigned',%s,COALESCE(%s, NOW()))",
            (cid, user_id, note, created_at))
    notify_department(dept_id, f"New {pred['priority']} priority complaint {ticket}: {title}", cid, "new_complaint",
                      SEVERITY_BY_PRIORITY[pred["priority"]])
    reason = critical_reason(pred, sent)
    escalated = False
    if reason:
        escalated = escalate({"id": cid, "ticket_id": ticket, "status": "Assigned", "department_id": dept_id}, 1, reason)
    return {"id": cid, "ticket_id": ticket, "prediction": pred, "sentiment": sent, "duplicates": dups,
            "department": dept["name"] if dept else None, "sla_hours": sla_hours(pred["priority"]),
            "escalated": escalated, "escalation_reason": reason if escalated else None}


def save_feedback(text, category, priority):
    """Store an admin correction so the model can learn from it on the next retrain."""
    path = trainer.FEEDBACK_FILE
    new = not os.path.exists(path)
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["text", "category", "priority", "group"])
        w.writerow([text, category, priority, ""])


# ----------------------------------------------------------------------------- SLA monitor
def run_sla_check():
    """Detects SLA warnings, breaches and second-level escalations. Idempotent and safe to run concurrently."""
    summary = {"warned": 0, "breached": 0, "escalated": 0}
    open_sql = "c.status IN ('Assigned','In Progress')"
    base = "SELECT c.id, c.ticket_id, c.title, c.priority, c.status, c.department_id, c.user_id FROM complaints c WHERE "

    # 1) approaching deadline -> warn the department once
    for pr, hours in Config.SLA_HOURS.items():
        minutes = int(hours * 60 * Config.SLA_WARN_FRACTION)
        rows = query(base + f"{open_sql} AND c.priority=%s AND c.sla_warned_at IS NULL AND c.sla_due_at > NOW() "
                     "AND c.sla_due_at <= DATE_ADD(NOW(), INTERVAL %s MINUTE)", (pr, minutes))
        for r in rows:
            if run("UPDATE complaints SET sla_warned_at=NOW() WHERE id=%s AND sla_warned_at IS NULL", (r["id"],)):
                summary["warned"] += 1
                notify_department(r["department_id"], f"SLA warning: {r['ticket_id']} is close to its deadline", r["id"], "sla_warning", "warning")

    # 2) deadline passed -> flag, alert, and escalate High-priority complaints
    for r in query(base + f"{open_sql} AND c.sla_breached_at IS NULL AND c.sla_due_at < NOW()"):
        if run("UPDATE complaints SET sla_breached_at=NOW() WHERE id=%s AND sla_breached_at IS NULL", (r["id"],)):
            summary["breached"] += 1
            sev = "critical" if r["priority"] == "High" else "warning"
            add_timeline(r["id"], None, r["status"], f"SLA breached: the {sla_hours(r['priority'])}h target for {r['priority']} priority has passed.")
            msg = f"Overdue: {r['ticket_id']} missed its SLA – {r['title']}"
            notify_department(r["department_id"], msg, r["id"], "sla_overdue", sev)
            notify_admins(msg, r["id"], "sla_overdue", sev)
            notify(r["user_id"], f"Your complaint {r['ticket_id']} is taking longer than expected and has been flagged for attention", r["id"], "sla_overdue", "info")
            if r["priority"] == "High" and escalate(r, 1, "SLA breached on a High-priority complaint"):
                summary["escalated"] += 1

    # 3) overdue by more than a whole SLA window -> critical escalation (level 2)
    for pr, hours in Config.SLA_HOURS.items():
        rows = query(base + f"{open_sql} AND c.priority=%s AND c.escalation_level<2 AND c.sla_due_at < DATE_SUB(NOW(), INTERVAL %s HOUR)", (pr, hours))
        for r in rows:
            if escalate(r, 2, "Overdue by more than a full SLA window"):
                summary["escalated"] += 1
    return summary
