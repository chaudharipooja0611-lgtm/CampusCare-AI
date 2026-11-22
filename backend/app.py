import datetime
import decimal
import logging
import os
import threading

from flask import Flask, jsonify, request
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from config import Config, DEFAULT_SECRET
from db import close_db
from utils import ApiError

log = logging.getLogger("campuscare")


def _json_default(o):
    if isinstance(o, (datetime.datetime, datetime.date)):
        return o.isoformat()
    if isinstance(o, decimal.Decimal):
        return float(o)
    return DefaultJSONProvider.default(o)


class JSONProvider(DefaultJSONProvider):
    default = staticmethod(_json_default)
    sort_keys = False


def start_sla_worker(app):
    """Background monitor: warns about approaching deadlines, flags breaches and escalates. Idempotent."""
    from services import run_sla_check
    stop = threading.Event()

    def loop():
        while not stop.wait(Config.SLA_INTERVAL_SECONDS):
            try:
                with app.app_context():
                    result = run_sla_check()
                if any(result.values()):
                    log.info("SLA monitor: %s", result)
            except Exception:  # never let the monitor die
                log.exception("SLA monitor failed")

    threading.Thread(target=loop, name="sla-monitor", daemon=True).start()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.json = JSONProvider(app)
    CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}})
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    app.teardown_appcontext(close_db)

    from routes import auth, complaints, admin, analytics
    for module in (auth, complaints, admin, analytics):
        app.register_blueprint(module.bp)

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", service="CampusCare AI")

    @app.get("/api/config")
    def public_config():
        return jsonify(sla_hours=Config.SLA_HOURS, warn_fraction=Config.SLA_WARN_FRACTION)

    @app.after_request
    def security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if request.path.startswith("/api/") and not request.path.startswith("/api/uploads/"):
            resp.headers["Cache-Control"] = "no-store"
        return resp

    @app.errorhandler(ApiError)
    def api_error(e):
        return jsonify(error=e.message), e.status

    @app.errorhandler(HTTPException)
    def http_error(e):
        msg = {413: "File too large. Maximum image size is 5 MB.", 404: "Resource not found", 405: "Method not allowed"}.get(e.code, e.description)
        return jsonify(error=msg), e.code

    @app.errorhandler(Exception)
    def server_error(e):
        app.logger.exception(e)
        return jsonify(error="Something went wrong on the server. Please try again."), 500

    if Config.SECRET_KEY == DEFAULT_SECRET:
        log.warning("SECRET_KEY is the insecure default. Set a long random value in .env before deploying.")

    # upgrade an existing database in place (adds v2 columns, back-fills SLA deadlines)
    try:
        from migrate import ensure_schema
        ensure_schema()
    except Exception as e:
        log.warning("Schema check skipped (is MySQL running and initialised?): %s", e)

    # warm up the ML model at startup (trains automatically on first run)
    from ml import classifier
    classifier.load()

    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    if Config.SLA_WORKER and (not debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true"):
        start_sla_worker(app)
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("FLASK_DEBUG", "1") == "1")
