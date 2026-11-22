"""Create tables (database/schema.sql), seed demo accounts and sample complaints.

Usage:  python init_db.py            # schema + users + demo complaints
        python init_db.py --no-demo  # schema + users only
"""
import os
import random
import sys
import datetime

import pymysql
from werkzeug.security import generate_password_hash

from config import Config

SCHEMA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "database", "schema.sql")

USERS = [
    ("System Admin", "admin@campuscare.edu", "admin123", "admin", None),
    ("IT Desk", "it@campuscare.edu", "dept123", "department", "Technical"),
    ("Electrical Desk", "electrical@campuscare.edu", "dept123", "department", "Electrical"),
    ("Maintenance Desk", "maintenance@campuscare.edu", "dept123", "department", "Maintenance"),
    ("Accounts Desk", "accounts@campuscare.edu", "dept123", "department", "Accounts"),
    ("Security Desk", "safety@campuscare.edu", "dept123", "department", "Safety"),
    ("Library Desk", "library@campuscare.edu", "dept123", "department", "Library"),
    ("Aarav Sharma", "student@campuscare.edu", "student123", "student", None),
    ("Priya Patil", "priya@campuscare.edu", "student123", "student", None),
]

DEMO = [
    ("Wi-Fi down in Hostel Block A", "The wifi router in our block has stopped working since morning and nobody can access the internet for online classes.", "Hostel Block A"),
    ("Sparks from switchboard", "There are sparks and a burning smell coming from the switchboard near the corridor. Someone could get an electric shock. Please act immediately.", "Engineering Block, Floor 2"),
    ("Scholarship not credited", "My scholarship amount has not been credited for the last three months and my hostel fee is pending. Please check urgently.", "Accounts Office"),
    ("Water tap leaking", "The tap in the washroom is leaking continuously and wasting water. Needs repair soon.", "Boys Hostel Washroom"),
    ("Reference books missing", "Important DBMS reference books are missing from the library and the exams are next week.", "Central Library"),
    ("CCTV not working in parking", "CCTV cameras in the parking area are not working, which is unsafe at night.", "Main Parking"),
    ("Projector not turning on", "The projector in classroom 204 does not turn on, lectures are getting disturbed.", "Classroom 204"),
    ("Ceiling fan not working", "Two ceiling fans in the seminar hall are not working and it is very hot.", "Seminar Hall"),
    ("Ragging complaint", "Seniors are harassing first year students in the hostel at night. This is a very serious matter.", "Boys Hostel"),
    ("Fee receipt not generated", "I paid the tuition fee online but the receipt has not been generated yet.", "Accounts Office"),
    ("Dustbins overflowing", "Garbage bins near the cafeteria are overflowing and not cleared regularly. It is dirty.", "Cafeteria"),
    ("Request more novels", "I suggest adding more novels and magazines to the library collection when possible.", "Central Library"),
    ("Student portal login error", "I cannot log in to the student portal, it shows an error every time I try.", "Online"),
    ("Street light flickering", "The street light near the main gate flickers sometimes. A small request to check it.", "Main Gate"),
]


def run_schema():
    conn = pymysql.connect(host=Config.DB_HOST, port=Config.DB_PORT, user=Config.DB_USER, password=Config.DB_PASSWORD, charset="utf8mb4", autocommit=True)
    sql = open(SCHEMA, encoding="utf-8").read().replace("campuscare_ai", Config.DB_NAME)
    with conn.cursor() as cur:
        for stmt in [s.strip() for s in sql.split(";") if s.strip()]:
            cur.execute(stmt)
    conn.close()
    from migrate import ensure_schema
    ensure_schema()
    print("✔ Schema created / upgraded")


def seed(demo=True):
    from app import app
    from db import query, execute
    from services import create_complaint
    from werkzeug.security import generate_password_hash
    with app.app_context():
        for name, email, pw, role, cat in USERS:
            if query("SELECT id FROM users WHERE email=%s", (email,), one=True):
                continue
            dept = query("SELECT id FROM departments WHERE category=%s ORDER BY id LIMIT 1", (cat,), one=True) if cat else None
            execute("INSERT INTO users (name,email,password_hash,role,department_id) VALUES (%s,%s,%s,%s,%s)",
                    (name, email, generate_password_hash(pw), role, dept["id"] if dept else None))
        print("✔ Demo users ready")
        if demo and not query("SELECT id FROM complaints LIMIT 1", one=True):
            random.seed(7)
            students = [r["id"] for r in query("SELECT id FROM users WHERE role='student'")]
            admin = query("SELECT id FROM users WHERE role='admin'", one=True)["id"]
            for i, (title, desc, loc) in enumerate(DEMO):
                days_ago = random.randint(0, 12)
                created = datetime.datetime.now() - datetime.timedelta(days=days_ago, hours=random.randint(0, 20))
                res = create_complaint(random.choice(students), title, desc, loc, None, created)
                status = random.choice(["Assigned", "In Progress", "Resolved", "Resolved", "In Progress"])
                if status != "Assigned" and days_ago > 0:
                    resolved_at = created + datetime.timedelta(hours=random.randint(3, 48)) if status == "Resolved" else None
                    execute("UPDATE complaints SET status=%s, resolved_at=%s WHERE id=%s", (status, resolved_at, res["id"]))
                    execute("INSERT INTO complaint_updates (complaint_id,user_id,status,note,created_at) VALUES (%s,%s,%s,%s,%s)",
                            (res["id"], admin, status, "Work started by the department." if status == "In Progress" else "Issue fixed and verified.",
                             created + datetime.timedelta(hours=2)))
            print(f"✔ {len(DEMO)} sample complaints created through the AI pipeline")


if __name__ == "__main__":
    run_schema()
    seed(demo="--no-demo" not in sys.argv)
    print("\nLogins:\n  admin@campuscare.edu / admin123\n  it@campuscare.edu / dept123 (department)\n  student@campuscare.edu / student123")
