import csv
import datetime
import io
import json

from flask import Blueprint, request, jsonify, g, send_from_directory, Response
from config import Config
from db import query, execute, run
from ml import classifier
from security import login_required, optional_user, rate_limit
from services import (create_complaint, analyze, notify, notify_department, notify_admins, route_department,
                      save_feedback, add_timeline, escalate, sla_hours)
from utils import ApiError, text_field, save_image, parse_int, CATEGORIES, PRIORITIES, STATUSES, OPEN_STATUSES

bp = Blueprint("complaints", __name__, url_prefix="/api")

SELECT = """SELECT c.*, u.name AS user_name, u.email AS user_email, d.name AS department_name,
            dup.ticket_id AS duplicate_ticket, TIMESTAMPDIFF(SECOND, NOW(), c.sla_due_at) AS sla_seconds_left
            FROM complaints c JOIN users u ON u.id = c.user_id
            LEFT JOIN departments d ON d.id = c.department_id
            LEFT JOIN complaints dup ON dup.id = c.duplicate_of """
COUNT = "SELECT COUNT(*) AS n FROM complaints c JOIN users u ON u.id = c.user_id "
OPEN_SQL = "c.status IN ('Assigned','In Progress')"

SORTS = {
    "created_at": "c.created_at {d}, c.id {d}",
    "priority": "CASE c.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END {d}, c.created_at DESC",
    "sla": "(c.status NOT IN ('Assigned','In Progress')) ASC, c.sla_due_at {d}",
    "confidence": "c.confidence {d}",
    "status": "c.status {d}, c.created_at DESC",
}


def _scope(user):
    if user["role"] == "student":
        return "c.user_id = %s", [user["id"]]
    if user["role"] == "department":
        return "c.department_id = %s", [user["department_id"] or 0]
    return "1=1", []


def _can_view(user, c):
    if user["role"] == "admin":
        return True
    if user["role"] == "department":
        return c["department_id"] == user["department_id"]
    return c["user_id"] == user["id"]


def decorate(c):
    """Adds derived SLA fields (state, total window) to a complaint row."""
    total = sla_hours(c["priority"]) * 3600
    left = c.get("sla_seconds_left")
    c["sla_total_seconds"] = total
    if c["status"] in OPEN_STATUSES:
        if left is None:
            state = "on_track"
        elif left < 0:
            state = "overdue"
        elif left < total * Config.SLA_WARN_FRACTION:
            state = "at_risk"
        else:
            state = "on_track"
    elif c["status"] == "Resolved":
        late = c.get("resolved_at") and c.get("sla_due_at") and c["resolved_at"] > c["sla_due_at"]
        state = "resolved_late" if late else "met"
    else:
        state = "closed"
    c["sla_state"] = state
    return c


def _date(value, label):
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise ApiError(f"{label} must be a date in YYYY-MM-DD format")


def build_filters(user, args):
    where, params = _scope(user)
    clauses, params = [where], list(params)

    def pick(name, allowed):
        values = [v for v in (args.get(name) or "").split(",") if v]
        for v in values:
            if v not in allowed:
                raise ApiError(f"Invalid {name} filter: {v}")
        if values:
            clauses.append(f"c.{name} IN ({','.join(['%s'] * len(values))})")
            params.extend(values)

    pick("status", STATUSES)
    pick("category", CATEGORIES)
    pick("priority", PRIORITIES)
    pick("sentiment", ["Positive", "Neutral", "Negative"])
    q = (args.get("q") or "").strip()[:100]
    if q:
        clauses.append("(c.title LIKE %s OR c.ticket_id LIKE %s OR c.location LIKE %s OR c.description LIKE %s OR u.name LIKE %s)")
        params += [f"%{q}%"] * 5
    if args.get("department_id"):
        clauses.append("c.department_id = %s")
        params.append(parse_int(args["department_id"], "Department", 1, 10**9))
    flags = {"overdue": f"{OPEN_SQL} AND c.sla_due_at < NOW()",
             "escalated": f"{OPEN_SQL} AND c.escalation_level > 0",
             "attention": f"{OPEN_SQL} AND (c.escalation_level > 0 OR c.sla_due_at < NOW())",
             "duplicate": "c.duplicate_of IS NOT NULL",
             "corrected": "c.is_corrected = 1",
             "low_confidence": "c.confidence < 60",
             "unrated": "c.status = 'Resolved' AND c.rating IS NULL",
             "rated": "c.rating IS NOT NULL"}
    for key, sql in flags.items():
        if args.get(key) in ("1", "true"):
            clauses.append(sql)
    if args.get("rating_max"):
        clauses.append("c.rating <= %s")
        params.append(parse_int(args["rating_max"], "Rating", 1, 5))
    if args.get("min_confidence"):
        clauses.append("c.confidence >= %s")
        params.append(parse_int(args["min_confidence"], "Minimum confidence", 0, 100))
    if args.get("date_from"):
        clauses.append("c.created_at >= %s")
        params.append(_date(args["date_from"], "Start date"))
    if args.get("date_to"):
        clauses.append("c.created_at < %s")
        params.append(_date(args["date_to"], "End date") + datetime.timedelta(days=1))
    sort = args.get("sort", "created_at")
    if sort not in SORTS:
        raise ApiError("Invalid sort option")
    direction = "ASC" if args.get("order") == "asc" else "DESC"
    return " AND ".join(clauses), params, SORTS[sort].format(d=direction)


def _timeline(cid):
    return query("""SELECT cu.id, cu.status, cu.note, cu.created_at, u.name AS user_name, u.role AS user_role
                    FROM complaint_updates cu LEFT JOIN users u ON u.id = cu.user_id
                    WHERE cu.complaint_id=%s ORDER BY cu.id""", (cid,))


def _get(cid, keep_explanation=False):
    c = query(SELECT + "WHERE c.id=%s", (cid,), one=True)
    if not c:
        raise ApiError("Complaint not found", 404)
    if not keep_explanation:
        c.pop("explanation", None)
    return decorate(c)


def _full(cid):
    c = _get(cid, keep_explanation=True)
    c["updates"] = _timeline(cid)
    c["duplicates"] = query("SELECT id, ticket_id, title, status FROM complaints WHERE duplicate_of=%s", (cid,))
    raw = c.pop("explanation", None)
    if not raw:  # complaint created before explainability existed: compute from the current model and keep it
        exp = classifier.predict(f"{c['title']}. {c['description']}")["explanation"]
        execute("UPDATE complaints SET explanation=%s WHERE id=%s", (json.dumps(exp), cid))
    else:
        exp = json.loads(raw)
    c["explanation"] = exp
    return c


# ----------------------------------------------------------------------------- AI preview / submit
@bp.post("/complaints/predict")
@rate_limit(60, 60)
def predict_preview():
    """Live AI preview (public). Duplicate detection only for logged-in users."""
    d = request.get_json(silent=True) or {}
    text = (str(d.get("title") or "") + ". " + str(d.get("description") or "")).strip(". ")
    if len(text) < 10:
        raise ApiError("Please write a little more so the AI can analyse it")
    return jsonify(analyze(text[:4000], with_duplicates=bool(optional_user())))


@bp.post("/complaints")
@login_required()
@rate_limit(30, 60)
def submit():
    title = text_field(request.form.get("title"), "Title", 5, 150)
    description = text_field(request.form.get("description"), "Description", 15, 3000)
    location = text_field(request.form.get("location"), "Location", 2, 120)
    image = save_image(request.files.get("image"))
    return jsonify(create_complaint(g.user["id"], title, description, location, image)), 201


# ----------------------------------------------------------------------------- list / export / detail
@bp.get("/complaints")
@login_required()
def list_complaints():
    where, params, order = build_filters(g.user, request.args)
    paged = "per_page" in request.args
    per_page = parse_int(request.args.get("per_page", 500), "per_page", 1, 500) if paged else 500
    page = parse_int(request.args.get("page", 1), "page", 1, 10**6)
    total = query(COUNT + "WHERE " + where, params, one=True)["n"]
    rows = query(SELECT + f"WHERE {where} ORDER BY {order} LIMIT %s OFFSET %s", params + [per_page, (page - 1) * per_page])
    for r in rows:
        r.pop("explanation", None)
        decorate(r)
    return jsonify(complaints=rows, total=total, page=page, per_page=per_page, pages=max(1, -(-total // per_page)))


def _csv_cell(v):
    if v is None:
        return ""
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d %H:%M")
    s = str(v).replace("\r", " ").replace("\n", " ")
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t") else s  # neutralise spreadsheet formula injection


@bp.get("/complaints/export")
@login_required()
@rate_limit(20, 60)
def export_csv():
    where, params, order = build_filters(g.user, request.args)
    rows = query(SELECT + f"WHERE {where} ORDER BY {order} LIMIT 10000", params)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Ticket ID", "Title", "Description", "Location", "Category", "AI predicted category", "Priority",
                "AI confidence %", "Sentiment", "Status", "Department", "Submitted by", "Submitted at", "SLA due",
                "SLA state", "Escalation level", "Resolved at", "Rating", "Feedback", "Possible duplicate of"])
    for r in rows:
        decorate(r)
        w.writerow([_csv_cell(v) for v in (
            r["ticket_id"], r["title"], r["description"], r["location"], r["category"], r["predicted_category"],
            r["priority"], r["confidence"], r["sentiment"], r["status"], r["department_name"], r["user_name"],
            r["created_at"], r["sla_due_at"], r["sla_state"], r["escalation_level"], r["resolved_at"], r["rating"],
            r["feedback"], r["duplicate_ticket"])])
    name = f"campuscare-complaints-{datetime.datetime.now():%Y%m%d-%H%M}.csv"
    return Response("\ufeff" + buf.getvalue(), mimetype="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{name}"', "X-Row-Count": str(len(rows))})


@bp.get("/complaints/<int:cid>")
@login_required()
def get_complaint(cid):
    c = _get(cid)
    if not _can_view(g.user, c):
        raise ApiError("You do not have access to this complaint", 403)
    return jsonify(complaint=_full(cid))


@bp.get("/track/<ticket>")
@rate_limit(60, 60)
def track(ticket):
    c = query("""SELECT c.id, c.ticket_id, c.title, c.category, c.priority, c.status, c.location, c.created_at,
                 c.updated_at, d.name AS department_name FROM complaints c LEFT JOIN departments d ON d.id=c.department_id
                 WHERE c.ticket_id=%s""", (ticket.strip().upper()[:24],), one=True)
    if not c:
        raise ApiError("No complaint found with that ticket ID", 404)
    c["updates"] = query("SELECT status, note, created_at FROM complaint_updates WHERE complaint_id=%s ORDER BY id", (c["id"],))
    return jsonify(complaint=c)


# ----------------------------------------------------------------------------- workflow actions
@bp.patch("/complaints/<int:cid>/status")
@login_required("admin", "department")
def update_status(cid):
    c = _get(cid)
    if not _can_view(g.user, c):
        raise ApiError("This complaint is not assigned to your department", 403)
    d = request.get_json(silent=True) or {}
    status = d.get("status")
    note = str(d.get("note") or "").strip()[:500]
    if status not in STATUSES:
        raise ApiError("Invalid status")
    if status == c["status"] and not note:
        raise ApiError("Nothing to update. Change the status or add a note.")
    closed = c["status"] not in OPEN_STATUSES
    if closed and status != c["status"] and g.user["role"] != "admin":
        raise ApiError("Only an administrator can reopen a closed complaint", 403)
    if status in ("Resolved", "Rejected") and status != c["status"] and not note:
        raise ApiError("Please add a note explaining the resolution or rejection")
    if status == "Resolved" and c["status"] != "Resolved":
        execute("UPDATE complaints SET status=%s, resolved_at=NOW() WHERE id=%s", (status, cid))
    elif status in OPEN_STATUSES:
        execute("UPDATE complaints SET status=%s, resolved_at=NULL WHERE id=%s", (status, cid))
    else:
        execute("UPDATE complaints SET status=%s WHERE id=%s", (status, cid))
    add_timeline(cid, g.user["id"], status, note or f"Status changed to {status}")
    if status != c["status"]:
        msg = f"Your complaint {c['ticket_id']} is now {status}"
        if status == "Resolved":
            msg += ". Please rate the resolution"
        notify(c["user_id"], msg, cid, "status", "info")
    return jsonify(complaint=_get(cid), updates=_timeline(cid))


@bp.patch("/complaints/<int:cid>/correct")
@login_required("admin")
def correct(cid):
    """Admin manual correction of the AI prediction (category / priority / department)."""
    c = _get(cid)
    d = request.get_json(silent=True) or {}
    category = d.get("category") or c["category"]
    priority = d.get("priority") or c["priority"]
    if category not in CATEGORIES:
        raise ApiError("Invalid category")
    if priority not in PRIORITIES:
        raise ApiError("Invalid priority")
    dept_id = d.get("department_id")
    if dept_id:
        dept = query("SELECT id, name FROM departments WHERE id=%s", (dept_id,), one=True)
        if not dept:
            raise ApiError("Department not found", 404)
    elif category != c["category"]:
        dept = route_department(category)
    else:
        dept = query("SELECT id, name FROM departments WHERE id=%s", (c["department_id"],), one=True) if c["department_id"] else None
    changed = []
    if category != c["category"]:
        changed.append(f"category {c['category']} → {category}")
    if priority != c["priority"]:
        changed.append(f"priority {c['priority']} → {priority}")
    new_dept_id = dept["id"] if dept else None
    if new_dept_id != c["department_id"]:
        changed.append(f"department → {dept['name'] if dept else 'unassigned'}")
    if not changed:
        raise ApiError("No changes to apply")
    execute("UPDATE complaints SET category=%s, priority=%s, department_id=%s, is_corrected=1 WHERE id=%s",
            (category, priority, new_dept_id, cid))
    if priority != c["priority"] and c["status"] in OPEN_STATUSES:
        h = sla_hours(priority)
        execute("""UPDATE complaints SET sla_due_at = DATE_ADD(created_at, INTERVAL %s HOUR),
                   sla_breached_at = IF(DATE_ADD(created_at, INTERVAL %s HOUR) > NOW(), NULL, sla_breached_at),
                   sla_warned_at = IF(DATE_ADD(created_at, INTERVAL %s HOUR) > NOW(), NULL, sla_warned_at) WHERE id=%s""", (h, h, h, cid))
        changed.append(f"SLA target now {h}h")
    add_timeline(cid, g.user["id"], c["status"], "Admin correction: " + "; ".join(changed))
    if category != c["category"] or priority != c["priority"]:
        save_feedback(f"{c['title']}. {c['description']}", category, priority)
    notify(c["user_id"], f"Your complaint {c['ticket_id']} was reviewed and updated by an administrator", cid, "correction", "info")
    if new_dept_id != c["department_id"]:
        notify_department(new_dept_id, f"Complaint {c['ticket_id']} was assigned to your department", cid, "new_complaint", "warning" if priority == "High" else "info")
    return jsonify(complaint=_get(cid), updates=_timeline(cid))


@bp.post("/complaints/<int:cid>/escalate")
@login_required("admin", "department")
def manual_escalate(cid):
    c = _get(cid)
    if not _can_view(g.user, c):
        raise ApiError("This complaint is not assigned to your department", 403)
    if c["status"] not in OPEN_STATUSES:
        raise ApiError("Only open complaints can be escalated")
    if c["escalation_level"] >= 2:
        raise ApiError("This complaint is already at the highest escalation level")
    reason = text_field((request.get_json(silent=True) or {}).get("reason"), "Reason", 5, 200)
    escalate(c, c["escalation_level"] + 1, f"{reason} (by {g.user['name']})", g.user["id"])
    return jsonify(complaint=_get(cid), updates=_timeline(cid))


@bp.post("/complaints/<int:cid>/rating")
@login_required()
def rate(cid):
    c = _get(cid)
    if c["user_id"] != g.user["id"]:
        raise ApiError("Only the student who submitted this complaint can rate it", 403)
    if c["status"] != "Resolved":
        raise ApiError("You can rate a complaint once it has been resolved")
    if c["rating"] is not None:
        raise ApiError("You have already rated this complaint", 409)
    d = request.get_json(silent=True) or {}
    rating = parse_int(d.get("rating"), "Rating", 1, 5)
    feedback = str(d.get("feedback") or "").strip()[:500] or None
    execute("UPDATE complaints SET rating=%s, feedback=%s, rated_at=NOW() WHERE id=%s", (rating, feedback, cid))
    add_timeline(cid, g.user["id"], "Resolved", f"Student rated the resolution {rating}/5" + (f": “{feedback[:120]}”" if feedback else ""))
    msg = f"{c['ticket_id']} was rated {rating}/5 by the student"
    notify_department(c["department_id"], msg, cid, "rating", "warning" if rating <= 2 else "info")
    if rating <= 2:
        notify_admins(f"Low rating ({rating}/5) on {c['ticket_id']}: {c['title']}", cid, "rating", "warning")
    return jsonify(complaint=_get(cid), updates=_timeline(cid))


@bp.get("/uploads/<path:filename>")
def uploads(filename):
    resp = send_from_directory(Config.UPLOAD_FOLDER, filename)
    resp.headers["Content-Security-Policy"] = "default-src 'none'"
    resp.headers["Cache-Control"] = "private, max-age=86400"
    return resp
