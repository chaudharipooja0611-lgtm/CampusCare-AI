import os
import re
import uuid
from config import Config

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CATEGORIES = ["Technical", "Electrical", "Maintenance", "Accounts", "Safety", "Library"]
PRIORITIES = ["High", "Medium", "Low"]
STATUSES = ["Assigned", "In Progress", "Resolved", "Rejected"]
OPEN_STATUSES = ("Assigned", "In Progress")
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def text_field(value, label, min_len, max_len):
    value = _CTRL.sub("", str(value or "")).strip()
    if len(value) < min_len:
        raise ApiError(f"{label} must be at least {min_len} characters long")
    if len(value) > max_len:
        raise ApiError(f"{label} must be at most {max_len} characters long")
    return value


def validate_email(value):
    email = (value or "").strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 120:
        raise ApiError("Please enter a valid email address")
    return email


def validate_password(pw):
    pw = pw or ""
    if len(pw) < 8:
        raise ApiError("Password must be at least 8 characters long")
    if len(pw) > 128:
        raise ApiError("Password is too long (max 128 characters)")
    if not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        raise ApiError("Password must contain at least one letter and one number")
    return pw


def parse_int(value, label, lo, hi):
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ApiError(f"{label} must be a number")
    if not lo <= n <= hi:
        raise ApiError(f"{label} must be between {lo} and {hi}")
    return n


_MAGIC = [(b"\x89PNG\r\n\x1a\n", "png"), (b"\xff\xd8\xff", "jpg"), (b"GIF87a", "gif"), (b"GIF89a", "gif")]


def _detect_image(head):
    for sig, ext in _MAGIC:
        if head.startswith(sig):
            return ext
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def save_image(file):
    """Validates an upload by its real content (magic bytes), not its name, and stores it under a random name."""
    if not file or not file.filename:
        return None
    head = file.stream.read(12)
    file.stream.seek(0)
    ext = _detect_image(head)
    if not ext:
        raise ApiError("Only genuine PNG, JPG, GIF or WEBP images are allowed")
    name = f"{uuid.uuid4().hex}.{ext}"
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    file.save(os.path.join(Config.UPLOAD_FOLDER, name))
    return name
