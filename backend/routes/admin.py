from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash
from db import query, execute
from ml import classifier
from security import login_required
from services import run_sla_check
from utils import ApiError, EMAIL_RE, text_field, validate_email, validate_password, CATEGORIES

bp = Blueprint("admin", __name__, url_prefix="/api")

DEPT_SQL = """SELECT d.*, (SELECT COUNT(*) FROM complaints c WHERE c.department_id=d.id) AS complaint_count,
              (SELECT COUNT(*) FROM complaints c WHERE c.department_id=d.id AND c.status IN ('Assigned','In Progress')) AS open_count,
              (SELECT COUNT(*) FROM users u WHERE u.department_id=d.id) AS staff_count FROM departments d """


def _dept_payload(d):
    name = text_field(d.get("name"), "Department name", 3, 100)
    category = d.get("category")
    if category not in CATEGORIES:
        raise ApiError("Please choose a valid category for routing")
    email = (d.get("email") or "").strip()
    if email and not EMAIL_RE.match(email):
        raise ApiError("Invalid department email")
    return name, category, (d.get("description") or "").strip()[:255], email or None


@bp.get("/departments")
@login_required()
def departments():
    return jsonify(departments=query(DEPT_SQL + "ORDER BY d.id"))


@bp.post("/departments")
@login_required("admin")
def create_department():
    name, category, desc, email = _dept_payload(request.get_json(silent=True) or {})
    if query("SELECT id FROM departments WHERE name=%s", (name,), one=True):
        raise ApiError("A department with this name already exists", 409)
    did = execute("INSERT INTO departments (name, category, description, email) VALUES (%s,%s,%s,%s)", (name, category, desc, email))
    return jsonify(department=query(DEPT_SQL + "WHERE d.id=%s", (did,), one=True)), 201


@bp.put("/departments/<int:did>")
@login_required("admin")
def update_department(did):
    if not query("SELECT id FROM departments WHERE id=%s", (did,), one=True):
        raise ApiError("Department not found", 404)
    name, category, desc, email = _dept_payload(request.get_json(silent=True) or {})
    if query("SELECT id FROM departments WHERE name=%s AND id<>%s", (name, did), one=True):
        raise ApiError("A department with this name already exists", 409)
    execute("UPDATE departments SET name=%s, category=%s, description=%s, email=%s WHERE id=%s", (name, category, desc, email, did))
    return jsonify(department=query(DEPT_SQL + "WHERE d.id=%s", (did,), one=True))


@bp.delete("/departments/<int:did>")
@login_required("admin")
def delete_department(did):
    row = query("SELECT (SELECT COUNT(*) FROM complaints WHERE department_id=%s) AS n", (did,), one=True)
    if row["n"]:
        raise ApiError("This department has complaints assigned. Reassign them before deleting it.", 409)
    execute("DELETE FROM departments WHERE id=%s", (did,))
    return jsonify(ok=True)


@bp.get("/users")
@login_required("admin")
def users():
    rows = query("""SELECT u.id, u.name, u.email, u.role, u.department_id, u.created_at, d.name AS department_name
                    FROM users u LEFT JOIN departments d ON d.id=u.department_id ORDER BY u.id""")
    return jsonify(users=rows)


@bp.post("/users")
@login_required("admin")
def create_user():
    d = request.get_json(silent=True) or {}
    name = text_field(d.get("name"), "Name", 2, 100)
    email = validate_email(d.get("email"))
    validate_password(d.get("password"))
    role = d.get("role")
    if role not in ("student", "department", "admin"):
        raise ApiError("Invalid role")
    dept_id = d.get("department_id") or None
    if role == "department" and not dept_id:
        raise ApiError("Department staff must be linked to a department")
    if query("SELECT id FROM users WHERE email=%s", (email,), one=True):
        raise ApiError("An account with this email already exists", 409)
    uid = execute("INSERT INTO users (name,email,password_hash,role,department_id) VALUES (%s,%s,%s,%s,%s)",
                  (name, email, generate_password_hash(d["password"]), role, dept_id if role == "department" else None))
    return jsonify(id=uid), 201


@bp.patch("/users/<int:uid>")
@login_required("admin")
def update_user(uid):
    d = request.get_json(silent=True) or {}
    user = query("SELECT * FROM users WHERE id=%s", (uid,), one=True)
    if not user:
        raise ApiError("User not found", 404)
    role = d.get("role", user["role"])
    if role not in ("student", "department", "admin"):
        raise ApiError("Invalid role")
    if uid == g.user["id"] and role != "admin":
        raise ApiError("You cannot remove your own admin access")
    dept_id = d.get("department_id", user["department_id"]) or None
    if role == "department" and not dept_id:
        raise ApiError("Department staff must be linked to a department")
    execute("UPDATE users SET role=%s, department_id=%s WHERE id=%s", (role, dept_id if role == "department" else None, uid))
    return jsonify(ok=True)


@bp.post("/admin/retrain")
@login_required("admin")
def retrain():
    return jsonify(metrics=classifier.retrain())


@bp.post("/admin/sla-check")
@login_required("admin")
def sla_check():
    """Runs the SLA monitor immediately (it also runs automatically in the background)."""
    return jsonify(result=run_sla_check())
