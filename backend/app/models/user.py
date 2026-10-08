from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.generation import Generation


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    plan: Mapped[str] = mapped_column(String, default="free", server_default="free")
    credits: Mapped[int] = mapped_column(Integer, default=10, server_default=text("10"))
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # SQLAlchemy emits this timestamp on UPDATE; raw SQL updates must set it explicitly.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    generations: Mapped[list[Generation]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
