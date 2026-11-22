import csv
import datetime
import io

from flask import Blueprint, jsonify, g, request, Response
from config import Config
from db import query, execute, run
from ml import classifier
from security import login_required, rate_limit
from utils import ApiError, CATEGORIES, PRIORITIES, STATUSES

bp = Blueprint("analytics", __name__, url_prefix="/api")

OPEN = "c.status IN ('Assigned','In Progress')"


def _scope(user):
    if user["role"] == "student":
        return "c.user_id = %s", [user["id"]]
    if user["role"] == "department":
        return "c.department_id = %s", [user["department_id"] or 0]
    return "1=1", []


def _group(col, order, where, args):
    rows = query(f"SELECT {col} AS k, COUNT(*) AS n FROM complaints c WHERE {where} GROUP BY {col}", args)
    m = {r["k"]: r["n"] for r in rows}
    return [{"name": k, "value": int(m.get(k, 0))} for k in order]


def _num(v, nd=1):
    return round(float(v), nd) if v is not None else None


def compute(user):
    where, args = _scope(user)
    warn = {p: int(h * 60 * Config.SLA_WARN_FRACTION) for p, h in Config.SLA_HOURS.items()}
    at_risk = " + ".join(f"COALESCE(SUM({OPEN} AND c.priority='{p}' AND c.sla_due_at >= NOW() AND c.sla_due_at <= DATE_ADD(NOW(), INTERVAL {m} MINUTE)),0)" for p, m in warn.items())
    t = query(f"""SELECT COUNT(*) AS total,
                  COALESCE(SUM({OPEN}),0) AS active,
                  COALESCE(SUM(c.status='Resolved'),0) AS resolved,
                  COALESCE(SUM(c.priority='High' AND {OPEN}),0) AS high_open,
                  COALESCE(AVG(c.confidence),0) AS avg_confidence,
                  COALESCE(SUM(c.is_corrected),0) AS corrected,
                  COALESCE(SUM(c.duplicate_of IS NOT NULL),0) AS duplicates,
                  AVG(CASE WHEN c.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, c.created_at, c.resolved_at) END) AS avg_minutes,
                  COALESCE(SUM({OPEN} AND c.sla_due_at < NOW()),0) AS overdue,
                  ({at_risk}) AS at_risk,
                  COALESCE(SUM({OPEN} AND c.escalation_level > 0),0) AS escalated_open,
                  COALESCE(SUM(c.status='Resolved' AND c.resolved_at <= c.sla_due_at),0) AS sla_met,
                  AVG(c.rating) AS avg_rating, COUNT(c.rating) AS rated_count,
                  COALESCE(SUM(c.status='Resolved' AND c.rating IS NULL),0) AS awaiting_rating
                  FROM complaints c WHERE {where}""", args, one=True)
    total, resolved = int(t["total"]), int(t["resolved"])
    stats = {"total": total, "active": int(t["active"]), "resolved": resolved, "high_open": int(t["high_open"]),
             "avg_confidence": _num(t["avg_confidence"]), "corrected": int(t["corrected"]), "duplicates": int(t["duplicates"]),
             "avg_resolution_hours": _num(float(t["avg_minutes"]) / 60) if t["avg_minutes"] is not None else None,
             "resolution_rate": _num(100 * resolved / total) if total else 0,
             "ai_acceptance": _num(100 - 100 * int(t["corrected"]) / total) if total else None,
             "overdue": int(t["overdue"]), "at_risk": int(t["at_risk"]), "escalated_open": int(t["escalated_open"]),
             "sla_compliance": _num(100 * int(t["sla_met"]) / resolved) if resolved else None,
             "avg_rating": _num(t["avg_rating"], 2), "rated_count": int(t["rated_count"]), "awaiting_rating": int(t["awaiting_rating"])}

    days = {r["d"]: r["n"] for r in query(
        f"SELECT DATE(c.created_at) AS d, COUNT(*) AS n FROM complaints c WHERE {where} AND c.created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) GROUP BY DATE(c.created_at)", args)}
    today = datetime.date.today()
    trend = [{"date": (today - datetime.timedelta(days=i)).strftime("%d %b"),
              "complaints": int(days.get(today - datetime.timedelta(days=i), 0))} for i in range(13, -1, -1)]

    rating_rows = {r["rating"]: r["n"] for r in query(f"SELECT c.rating, COUNT(*) AS n FROM complaints c WHERE {where} AND c.rating IS NOT NULL GROUP BY c.rating", args)}
    sla_rows = {r["priority"]: r for r in query(
        f"""SELECT c.priority, COALESCE(SUM(c.status='Resolved'),0) AS resolved,
            COALESCE(SUM(c.status='Resolved' AND c.resolved_at <= c.sla_due_at),0) AS met,
            COALESCE(SUM({OPEN} AND c.sla_due_at < NOW()),0) AS overdue
            FROM complaints c WHERE {where} GROUP BY c.priority""", args)}
    sla_by_priority = []
    for p in PRIORITIES:
        r = sla_rows.get(p, {"resolved": 0, "met": 0, "overdue": 0})
        sla_by_priority.append({"name": p, "target_hours": Config.SLA_HOURS[p], "resolved": int(r["resolved"]), "overdue": int(r["overdue"]),
                                "value": _num(100 * int(r["met"]) / int(r["resolved"])) if int(r["resolved"]) else 0})

    dept = query(f"""SELECT COALESCE(d.name,'Unassigned') AS name, COUNT(*) AS total,
                     COALESCE(SUM({OPEN}),0) AS open_count, COALESCE(SUM({OPEN} AND c.sla_due_at < NOW()),0) AS overdue,
                     AVG(c.rating) AS avg_rating, COALESCE(SUM(c.status='Resolved'),0) AS resolved,
                     COALESCE(SUM(c.status='Resolved' AND c.resolved_at <= c.sla_due_at),0) AS met,
                     AVG(CASE WHEN c.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, c.created_at, c.resolved_at) END) AS avg_min
                     FROM complaints c LEFT JOIN departments d ON d.id = c.department_id WHERE {where} GROUP BY d.id, d.name ORDER BY total DESC""", args)
    performance = [{"name": r["name"], "total": int(r["total"]), "open": int(r["open_count"]), "overdue": int(r["overdue"]),
                    "avg_rating": _num(r["avg_rating"], 2), "resolved": int(r["resolved"]),
                    "sla_compliance": _num(100 * int(r["met"]) / int(r["resolved"])) if int(r["resolved"]) else None,
                    "avg_resolution_hours": _num(float(r["avg_min"]) / 60) if r["avg_min"] is not None else None} for r in dept]
    return {
        "stats": stats, "trend": trend,
        "by_category": _group("c.category", CATEGORIES, where, args),
        "by_priority": _group("c.priority", PRIORITIES, where, args),
        "by_status": _group("c.status", STATUSES, where, args),
        "by_sentiment": _group("c.sentiment", ["Positive", "Neutral", "Negative"], where, args),
        "by_department": [{"name": r["name"], "value": r["total"]} for r in performance],
        "department_performance": performance,
        "rating_distribution": [{"name": f"{i}★", "value": int(rating_rows.get(i, 0))} for i in range(1, 6)],
        "sla_by_priority": sla_by_priority,
        "sla_targets": Config.SLA_HOURS,
    }


@bp.get("/analytics")
@login_required()
def analytics():
    data = compute(g.user)
    data["model"] = classifier.get_metrics()
    return jsonify(data)


def _cell(v):
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@") else s


@bp.get("/reports/summary")
@login_required("admin", "department")
@rate_limit(20, 60)
def summary_report():
    """CSV summary report (KPIs, breakdowns and department performance) scoped to the caller's role."""
    d = compute(g.user)
    s = d["stats"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["CampusCare AI – summary report"])
    w.writerow(["Generated", datetime.datetime.now().strftime("%Y-%m-%d %H:%M")])
    w.writerow(["Scope", g.user["department_name"] or "All departments" if g.user["role"] == "department" else "All departments"])
    w.writerow([])
    w.writerow(["KPI", "Value"])
    for label, key in [("Total complaints", "total"), ("Active", "active"), ("Resolved", "resolved"), ("High priority open", "high_open"),
                       ("Overdue (SLA)", "overdue"), ("At risk (SLA)", "at_risk"), ("Escalated open", "escalated_open"),
                       ("SLA compliance % (resolved)", "sla_compliance"), ("Average rating (1-5)", "avg_rating"), ("Ratings received", "rated_count"),
                       ("Average resolution hours", "avg_resolution_hours"), ("Average AI confidence %", "avg_confidence"),
                       ("Admin corrections", "corrected"), ("Possible duplicates", "duplicates")]:
        w.writerow([label, _cell(s[key])])
    for title, key in [("By category", "by_category"), ("By priority", "by_priority"), ("By status", "by_status"), ("By sentiment", "by_sentiment")]:
        w.writerow([]); w.writerow([title, "Complaints"])
        for r in d[key]:
            w.writerow([r["name"], r["value"]])
    w.writerow([]); w.writerow(["SLA by priority", "Target hours", "Resolved", "Within SLA %", "Currently overdue"])
    for r in d["sla_by_priority"]:
        w.writerow([r["name"], r["target_hours"], r["resolved"], r["value"], r["overdue"]])
    w.writerow([]); w.writerow(["Department", "Total", "Open", "Overdue", "Resolved", "SLA compliance %", "Avg resolution h", "Avg rating"])
    for r in d["department_performance"]:
        w.writerow([_cell(r["name"]), r["total"], r["open"], r["overdue"], r["resolved"], r["sla_compliance"], r["avg_resolution_hours"], r["avg_rating"]])
    name = f"campuscare-summary-{datetime.datetime.now():%Y%m%d-%H%M}.csv"
    return Response("\ufeff" + buf.getvalue(), mimetype="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ----------------------------------------------------------------------------- notification center
N_SELECT = """SELECT n.id, n.complaint_id, n.message, n.type, n.severity, n.is_read, n.created_at, c.ticket_id
              FROM notifications n LEFT JOIN complaints c ON c.id = n.complaint_id """


@bp.get("/notifications")
@login_required()
def notifications():
    flt = request.args.get("filter", "all")
    if flt not in ("all", "unread", "alerts"):
        raise ApiError("Invalid filter")
    try:
        limit = min(100, max(1, int(request.args.get("limit", 30))))
        offset = max(0, int(request.args.get("offset", 0)))
    except ValueError:
        raise ApiError("Invalid paging values")
    clause = {"all": "", "unread": " AND n.is_read = 0", "alerts": " AND n.severity IN ('warning','critical')"}[flt]
    uid = g.user["id"]
    # unread alerts first (critical before warning), then newest
    rows = query(N_SELECT + f"WHERE n.user_id=%s{clause} ORDER BY (n.is_read=0 AND n.severity='critical') DESC, n.created_at DESC, n.id DESC LIMIT %s OFFSET %s",
                 (uid, limit, offset))
    counts = query("""SELECT COUNT(*) AS total, COALESCE(SUM(is_read=0),0) AS unread,
                      COALESCE(SUM(is_read=0 AND severity IN ('warning','critical')),0) AS alerts_unread,
                      COALESCE(SUM(is_read=0 AND severity='critical'),0) AS critical_unread
                      FROM notifications WHERE user_id=%s""", (uid,), one=True)
    return jsonify(notifications=rows, unread=int(counts["unread"]), alerts_unread=int(counts["alerts_unread"]),
                   critical_unread=int(counts["critical_unread"]), total=int(counts["total"]))


@bp.post("/notifications/read")
@login_required()
def mark_all_read():
    execute("UPDATE notifications SET is_read=1 WHERE user_id=%s", (g.user["id"],))
    return jsonify(ok=True)


@bp.post("/notifications/<int:nid>/read")
@login_required()
def mark_read(nid):
    if not run("UPDATE notifications SET is_read=1 WHERE id=%s AND user_id=%s", (nid, g.user["id"])):
        if not query("SELECT id FROM notifications WHERE id=%s AND user_id=%s", (nid, g.user["id"]), one=True):
            raise ApiError("Notification not found", 404)
    return jsonify(ok=True)


@bp.delete("/notifications/<int:nid>")
@login_required()
def delete_notification(nid):
    if not run("DELETE FROM notifications WHERE id=%s AND user_id=%s", (nid, g.user["id"])):
        raise ApiError("Notification not found", 404)
    return jsonify(ok=True)


@bp.delete("/notifications")
@login_required()
def clear_notifications():
    n = run("DELETE FROM notifications WHERE user_id=%s AND is_read=1", (g.user["id"],))
    return jsonify(ok=True, deleted=n)
