import threading
import duckdb
from contextlib import contextmanager
from app.config import settings

_conn: duckdb.DuckDBPyConnection | None = None
_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id              VARCHAR PRIMARY KEY,
    booking_date    DATE,
    value_date      DATE,
    month           VARCHAR,
    counterparty    VARCHAR,
    counterparty_address VARCHAR,
    title           VARCHAR,
    amount          DOUBLE,
    abs_amount      DOUBLE,
    currency        VARCHAR,
    direction       VARCHAR,
    category        VARCHAR DEFAULT 'Uncategorized',
    bank_category   VARCHAR,
    operation_type  VARCHAR,
    source_account  VARCHAR,
    target_account  VARCHAR,
    reference       VARCHAR,
    is_internal     BOOLEAN DEFAULT FALSE,
    source_file     VARCHAR,
    imported_at     TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_rules (
    id       INTEGER PRIMARY KEY,
    category VARCHAR NOT NULL,
    pattern  VARCHAR NOT NULL,
    fields   VARCHAR[] DEFAULT ['counterparty','title','operation_type'],
    priority INTEGER DEFAULT 0,
    comment  VARCHAR DEFAULT ''
);

CREATE SEQUENCE IF NOT EXISTS category_rules_seq START 1;

CREATE TABLE IF NOT EXISTS app_settings (
    key   VARCHAR PRIMARY KEY,
    value VARCHAR
);

CREATE TABLE IF NOT EXISTS manual_transactions (
    id          VARCHAR PRIMARY KEY,
    booking_date DATE,
    description VARCHAR,
    amount      DOUBLE,
    currency    VARCHAR DEFAULT 'PLN',
    category    VARCHAR DEFAULT 'Uncategorized',
    created_at  TIMESTAMP DEFAULT now()
);
"""


def get_conn() -> duckdb.DuckDBPyConnection:
    global _conn
    if _conn is None:
        _conn = duckdb.connect(settings.db_path)
        _conn.executemany("", [])  # warm up
        _conn.execute(SCHEMA)
    return _conn


@contextmanager
def db():
    with _lock:
        yield get_conn()
