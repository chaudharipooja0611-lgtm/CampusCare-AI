import os
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SECRET = "dev-secret-change-me"


def _int(name, default):
    try:
        return max(1, int(os.getenv(name, default)))
    except ValueError:
        return default


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET)
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "campuscare_ai")
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB
    JWT_HOURS = 12
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    # SLA targets: hours allowed to resolve a complaint, by priority
    SLA_HOURS = {"High": _int("SLA_HOURS_HIGH", 24), "Medium": _int("SLA_HOURS_MEDIUM", 72), "Low": _int("SLA_HOURS_LOW", 168)}
    SLA_WARN_FRACTION = 0.2          # warn when <20% of the SLA window is left
    SLA_WORKER = os.getenv("SLA_WORKER", "1") == "1"
    SLA_INTERVAL_SECONDS = _int("SLA_INTERVAL_SECONDS", 60)
