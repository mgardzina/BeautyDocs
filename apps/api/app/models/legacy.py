"""SQLAlchemy mappings for the existing single-salon admin contracts.

These tables retain legacy IDs and field names; the multi-tenant BeautyDocs
models remain separate. Only the authenticated internal service uses them.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

FORMTYPE_VALUES = (
    "LIP_AUGMENTATION",
    "FACIAL_VOLUMETRY",
    "NEEDLE_MESOTHERAPY",
    "INJECTION_LIPOLYSIS",
    "PERMANENT_MAKEUP",
    "LASER_HAIR_REMOVAL",
    "LASER_TATTOO_REMOVAL",
    "WRINKLE_REDUCTION",
    "EYELID_LIFT",
    "TISSUE_STIMULATION",
    "EYEBROW_TINTING",
    "EYELASH_EXTENSION",
    "EYEBROW_LAMINATION",
    "FACIAL_CLEANSING",
    "HYALURONIC",
    "PMU",
    "LASER",
)
NOTECATEGORY_VALUES = ("NOTATKA", "ALERGIA", "UWAGA", "PREFERENCJA")


class LegacyClient(Base):
    __tablename__ = "Client"

    id: Mapped[str] = mapped_column(
        Text, nullable=False, primary_key=True, default=lambda: str(uuid4())
    )
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    imieNazwisko: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    telefon: Mapped[str | None] = mapped_column(Text, nullable=True)


class LegacyClientNote(Base):
    __tablename__ = "ClientNote"

    id: Mapped[str] = mapped_column(
        Text, nullable=False, primary_key=True, default=lambda: str(uuid4())
    )
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        Enum(*NOTECATEGORY_VALUES, name="NoteCategory"), nullable=False, server_default="NOTATKA"
    )
    clientId: Mapped[str] = mapped_column(
        Text, ForeignKey("Client.id", ondelete="CASCADE"), nullable=False
    )


class LegacyConsentForm(Base):
    __tablename__ = "ConsentForm"

    id: Mapped[str] = mapped_column(
        Text, nullable=False, primary_key=True, default=lambda: str(uuid4())
    )
    type: Mapped[str] = mapped_column(
        Enum(*FORMTYPE_VALUES, name="FormType"), nullable=False, server_default="LIP_AUGMENTATION"
    )
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    imieNazwisko: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    ulica: Mapped[str | None] = mapped_column(Text, nullable=True)
    kodPocztowy: Mapped[str | None] = mapped_column(Text, nullable=True)
    miasto: Mapped[str | None] = mapped_column(Text, nullable=True)
    dataUrodzenia: Mapped[str | None] = mapped_column(Text, nullable=True)
    telefon: Mapped[str] = mapped_column(Text, nullable=False)
    miejscowoscData: Mapped[str] = mapped_column(Text, nullable=False)
    nazwaProduktu: Mapped[str | None] = mapped_column(Text, nullable=True)
    obszarZabiegu: Mapped[str | None] = mapped_column(Text, nullable=True)
    celEfektu: Mapped[str | None] = mapped_column(Text, nullable=True)
    znieczulenie: Mapped[str | None] = mapped_column(Text, nullable=True)
    przeciwwskazania: Mapped[Any] = mapped_column(JSONB, nullable=False)
    zgodaPrzetwarzanieDanych: Mapped[bool] = mapped_column(Boolean, nullable=False)
    zgodaMarketing: Mapped[bool] = mapped_column(Boolean, nullable=False)
    zgodaFotografie: Mapped[bool] = mapped_column(Boolean, nullable=False)
    zgodaPomocPrawna: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    miejscaPublikacjiFotografii: Mapped[str | None] = mapped_column(Text, nullable=True)
    podpisDane: Mapped[str | None] = mapped_column(Text, nullable=True)
    podpisMarketing: Mapped[str | None] = mapped_column(Text, nullable=True)
    podpisFotografie: Mapped[str | None] = mapped_column(Text, nullable=True)
    podpisRodo: Mapped[str | None] = mapped_column(Text, nullable=True)
    podpisRodo2: Mapped[str | None] = mapped_column(Text, nullable=True)
    informacjaDodatkowa: Mapped[str | None] = mapped_column(Text, nullable=True)
    zastrzeniaKlienta: Mapped[str | None] = mapped_column(Text, nullable=True)
    numerZabiegu: Mapped[str | None] = mapped_column(Text, nullable=True)
    osobaPrzeprowadzajacaZabieg: Mapped[str | None] = mapped_column(Text, nullable=True)
    metodaZabiegu: Mapped[str | None] = mapped_column(Text, nullable=True)
    planowanaIloscZabiegow: Mapped[str | None] = mapped_column(Text, nullable=True)
    odstepMiedzyZabiegami: Mapped[str | None] = mapped_column(Text, nullable=True)
    kolejneZabiegiOdstepy: Mapped[str | None] = mapped_column(Text, nullable=True)
    iloscProduktu: Mapped[str | None] = mapped_column(Text, nullable=True)
    signatureStatus: Mapped[str | None] = mapped_column(
        Text, nullable=True, server_default="PENDING"
    )
    signatureVerifiedAt: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )
    auditLog: Mapped[Any] = mapped_column(JSONB, nullable=True)
    clientId: Mapped[str | None] = mapped_column(
        Text, ForeignKey("Client.id", ondelete="SET NULL"), nullable=True
    )


class LegacyOtpVerification(Base):
    __tablename__ = "OtpVerification"

    id: Mapped[str] = mapped_column(
        Text, nullable=False, primary_key=True, default=lambda: str(uuid4())
    )
    phoneNumber: Mapped[str] = mapped_column(Text, nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    formId: Mapped[str | None] = mapped_column(Text, nullable=True)
    expiresAt: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )

    __table_args__ = (Index("OtpVerification_phoneNumber_code_idx", "phoneNumber", "code"),)


class LegacyAdminUser(Base):
    __tablename__ = "AdminUser"

    id: Mapped[str] = mapped_column(
        Text, nullable=False, primary_key=True, default=lambda: str(uuid4())
    )
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    phoneNumber: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)
    passwordHash: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str | None] = mapped_column(Text, nullable=True)


class LegacyTreatmentHistory(Base):
    __tablename__ = "TreatmentHistory"

    id: Mapped[str] = mapped_column(
        Text, nullable=False, primary_key=True, default=lambda: str(uuid4())
    )
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    date: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    znieczulenie: Mapped[str | None] = mapped_column(Text, nullable=True)
    formId: Mapped[str] = mapped_column(
        Text, ForeignKey("ConsentForm.id", ondelete="CASCADE"), nullable=False
    )
