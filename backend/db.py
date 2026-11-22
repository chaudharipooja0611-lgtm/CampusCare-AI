import pymysql
import pymysql.cursors
from flask import g
from config import Config


def connect(database=True, dict_cursor=True, autocommit=True):
    return pymysql.connect(
        host=Config.DB_HOST, port=Config.DB_PORT, user=Config.DB_USER, password=Config.DB_PASSWORD,
        database=Config.DB_NAME if database else None, charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor if dict_cursor else pymysql.cursors.Cursor, autocommit=autocommit,
    )


def get_db():
    if "db" not in g:
        g.db = connect()
    return g.db


def close_db(exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def query(sql, args=None, one=False):
    with get_db().cursor() as cur:
        cur.execute(sql, args or ())
        rows = cur.fetchall()
    if one:
        return rows[0] if rows else None
    return rows


def execute(sql, args=None):
    """Runs a write statement and returns the new row id."""
    with get_db().cursor() as cur:
        cur.execute(sql, args or ())
        return cur.lastrowid


def run(sql, args=None):
    """Runs a write statement and returns the number of affected rows (used for atomic 'claim' updates)."""
    with get_db().cursor() as cur:
        return cur.execute(sql, args or ())
