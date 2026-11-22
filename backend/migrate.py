"""Idempotent, non-destructive schema upgrade. Safe to run on every start.

Adds the v2 columns (SLA, escalation, ratings, explainability, notification types) to an existing
database without touching existing data, then back-fills SLA deadlines for older complaints.
"""
import logging
from config import Config
from db import connect

log = logging.getLogger("campuscare.migrate")

COLUMNS = {
    "complaints": [
        ("sla_due_at", "DATETIME NULL"),
        ("sla_breached_at", "DATETIME NULL"),
        ("sla_warned_at", "DATETIME NULL"),
        ("escalation_level", "TINYINT NOT NULL DEFAULT 0"),
        ("escalated_at", "DATETIME NULL"),
        ("escalation_reason", "VARCHAR(255) NULL"),
        ("rating", "TINYINT NULL"),
        ("feedback", "VARCHAR(500) NULL"),
        ("rated_at", "DATETIME NULL"),
        ("explanation", "MEDIUMTEXT NULL"),
    ],
    "notifications": [
        ("type", "VARCHAR(20) NOT NULL DEFAULT 'info'"),
        ("severity", "VARCHAR(10) NOT NULL DEFAULT 'info'"),
    ],
}
INDEXES = [
    ("complaints", "idx_c_sla", "(status, sla_due_at)"),
    ("complaints", "idx_c_escalation", "(escalation_level)"),
    ("notifications", "idx_n_created", "(user_id, created_at)"),
]


def ensure_schema():
    conn = connect(dict_cursor=False)
    changed = []
    try:
        with conn.cursor() as cur:
            for table, cols in COLUMNS.items():
                for name, ddl in cols:
                    cur.execute("SELECT 1 FROM information_schema.columns WHERE table_schema=%s AND table_name=%s AND column_name=%s",
                                (Config.DB_NAME, table, name))
                    if not cur.fetchone():
                        cur.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
                        changed.append(f"{table}.{name}")
            for table, idx, cols in INDEXES:
                cur.execute("SELECT 1 FROM information_schema.statistics WHERE table_schema=%s AND table_name=%s AND index_name=%s",
                            (Config.DB_NAME, table, idx))
                if not cur.fetchone():
                    cur.execute(f"ALTER TABLE {table} ADD INDEX {idx} {cols}")
            # back-fill SLA deadlines for complaints created before the upgrade
            for pr, hours in Config.SLA_HOURS.items():
                cur.execute("UPDATE complaints SET sla_due_at = DATE_ADD(created_at, INTERVAL %s HOUR) WHERE sla_due_at IS NULL AND priority=%s", (hours, pr))
            # close-out: complaints already resolved shouldn't look overdue
            cur.execute("UPDATE complaints SET sla_breached_at = sla_due_at WHERE sla_breached_at IS NULL AND status IN ('Resolved','Rejected') AND resolved_at IS NOT NULL AND resolved_at > sla_due_at")
    finally:
        conn.close()
    if changed:
        log.warning("Schema upgraded: added %s", ", ".join(changed))
    return changed
