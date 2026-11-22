from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from db import query, execute
from security import make_token, login_required, get_user
from security import rate_limit
from utils import ApiError, text_field, validate_email, validate_password
from flask import g

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/register")
@rate_limit(10, 60)
def register():
    d = request.get_json(silent=True) or {}
    name = text_field(d.get("name"), "Name", 2, 100)
    email = validate_email(d.get("email"))
    password = validate_password(d.get("password"))
    if query("SELECT id FROM users WHERE email=%s", (email,), one=True):
        raise ApiError("An account with this email already exists", 409)
    uid = execute("INSERT INTO users (name, email, password_hash, role) VALUES (%s,%s,%s,'student')",
                  (name, email, generate_password_hash(password)))
    user = get_user(uid)
    return jsonify(token=make_token(user), user=user), 201


@bp.post("/login")
@rate_limit(20, 60)
def login():
    d = request.get_json(silent=True) or {}
    email = str(d.get("email") or "").strip().lower()
    password = str(d.get("password") or "")
    if not email or not password:
        raise ApiError("Email and password are required")
    row = query("SELECT id, password_hash FROM users WHERE email=%s", (email,), one=True)
    if not row or not check_password_hash(row["password_hash"], password):
        raise ApiError("Invalid email or password", 401)
    user = get_user(row["id"])
    return jsonify(token=make_token(user), user=user)


@bp.get("/me")
@login_required()
def me():
    return jsonify(user=g.user)
