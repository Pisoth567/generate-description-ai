from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Generation(Base):
    __tablename__ = "generations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    product_name: Mapped[str] = mapped_column(String)
    category: Mapped[str | None] = mapped_column(String)
    generated_text: Mapped[str] = mapped_column(Text)
    tone: Mapped[str] = mapped_column(
        String, default="professional", server_default="professional"
    )
    language: Mapped[str] = mapped_column(
        String, default="English", server_default="English"
    )
    tokens_used: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="generations")
