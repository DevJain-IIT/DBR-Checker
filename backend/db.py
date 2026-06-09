"""
db.py

Postgres persistence for saved reports (history). Corpus / IS-code data is NOT
stored here — only user-generated analyses.

DATABASE_URL env var (Render Postgres). Falls back to a local SQLite file when
unset so the app runs in dev / CI without a database. Tables auto-create on
startup (init_db); Alembic migrations live in alembic/ for production schema
evolution.
"""
from __future__ import annotations

import datetime as dt
import os
import uuid
from typing import Optional

from sqlalchemy import String, DateTime, Integer, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.types import JSON

# Render gives postgres:// ; SQLAlchemy 2.x wants postgresql+psycopg://
_raw = os.getenv("DATABASE_URL", "").strip()
if _raw.startswith("postgres://"):
    _raw = _raw.replace("postgres://", "postgresql+psycopg://", 1)
elif _raw.startswith("postgresql://"):
    _raw = _raw.replace("postgresql://", "postgresql+psycopg://", 1)

DATABASE_URL = _raw or "sqlite:///./dbr_reports.db"

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _uuid() -> str:
    return uuid.uuid4().hex


class Report(Base):
    """One saved DBR analysis. extracted/findings/summary stored as JSON."""
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    filename: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now)

    extraction_model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    extracted: Mapped[dict] = mapped_column(JSON, default=dict)   # DBRData dict
    findings: Mapped[list] = mapped_column(JSON, default=list)    # enriched findings
    summary: Mapped[dict] = mapped_column(JSON, default=dict)     # verdict counts

    # denormalised for cheap history listing
    overall_status: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    flaw_count: Mapped[int] = mapped_column(Integer, default=0)
    check_count: Mapped[int] = mapped_column(Integer, default=0)

    def list_item(self) -> dict:
        return {
            "id": self.id,
            "filename": self.filename,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "summary": self.summary,
            "overall_status": self.overall_status,
            "flaw_count": self.flaw_count,
            "check_count": self.check_count,
        }

    def full(self) -> dict:
        return {
            **self.list_item(),
            "extraction_model": self.extraction_model,
            "extracted": self.extracted,
            "findings": self.findings,
        }


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
