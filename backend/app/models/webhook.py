import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime, func, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Webhook(Base):
    __tablename__ = "webhooks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    events: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_pinged: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

