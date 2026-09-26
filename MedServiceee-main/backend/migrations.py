"""Schema migration layer for MedService database.

Safe and additive for both SQLite and PostgreSQL.
"""

from sqlalchemy import inspect, text
from database import engine
from models import Base

ADDITIVE_COLUMNS = {
    "clinics": {
        "photo_url": "VARCHAR",
        "district": "VARCHAR",
        "has_active_promotion": "BOOLEAN DEFAULT FALSE",
    },
    "doctors": {
        "gender": "VARCHAR DEFAULT 'm'",
        "category": "VARCHAR DEFAULT 'Высшая категория'",
        "is_pediatric": "BOOLEAN DEFAULT FALSE",
        "languages": "TEXT DEFAULT 'ru,kk'",
    },
    "users": {
        "full_name": "VARCHAR",
        "plan": "VARCHAR DEFAULT 'free'",
        "ai_requests_used": "INTEGER DEFAULT 0",
        "ai_usage_period_started_at": "DATETIME",
    },
    "bookings": {
        "patient_id": "VARCHAR",
        "appointment_at": "DATETIME",
        "promo_code": "VARCHAR",
        "discount_amount": "NUMERIC(10, 2) DEFAULT 0",
        "total_amount": "NUMERIC(10, 2)",
        "priority_booking": "BOOLEAN DEFAULT FALSE",
    },
    "reviews": {
        "booking_id": "VARCHAR",
        "patient_name": "VARCHAR",
        "is_verified": "BOOLEAN DEFAULT TRUE",
    }
}


def ensure_schema() -> None:
    """Create missing tables and add missing columns without dropping data."""
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    dialect = engine.dialect.name

    with engine.begin() as connection:
        for table_name, columns in ADDITIVE_COLUMNS.items():
            if table_name not in inspector.get_table_names():
                continue
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name in existing:
                    continue
                if dialect == "postgresql":
                    column_type = column_type.replace("DATETIME", "TIMESTAMP")
                table_sql = f'"{table_name}"'
                column_sql = f'"{column_name}"'
                connection.execute(text(f"ALTER TABLE {table_sql} ADD COLUMN {column_sql} {column_type}"))

    _ = dialect


if __name__ == "__main__":
    ensure_schema()
    print("Database schema is up to date")
