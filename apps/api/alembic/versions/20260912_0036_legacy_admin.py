"""Move the single-salon admin schema under Alembic (fresh database)."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260912_0036"
down_revision = "20260825_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "Client",
        sa.Column("id", sa.Text, nullable=False, primary_key=True),
        sa.Column(
            "createdAt", sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updatedAt", sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("imieNazwisko", sa.Text, nullable=False, unique=True),
        sa.Column("telefon", sa.Text, nullable=True),
    )
    op.create_table(
        "ClientNote",
        sa.Column("id", sa.Text, nullable=False, primary_key=True),
        sa.Column(
            "createdAt", sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updatedAt", sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "category",
            sa.Enum("NOTATKA", "ALERGIA", "UWAGA", "PREFERENCJA", name="NoteCategory"),
            nullable=False,
            server_default="NOTATKA",
        ),
        sa.Column(
            "clientId", sa.Text, sa.ForeignKey("Client.id", ondelete="CASCADE"), nullable=False
        ),
    )
    op.create_table(
        "ConsentForm",
        sa.Column("id", sa.Text, nullable=False, primary_key=True),
        sa.Column(
            "type",
            sa.Enum(
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
                name="FormType",
            ),
            nullable=False,
            server_default="LIP_AUGMENTATION",
        ),
        sa.Column(
            "createdAt", sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("imieNazwisko", sa.Text, nullable=False),
        sa.Column("email", sa.Text, nullable=True),
        sa.Column("ulica", sa.Text, nullable=True),
        sa.Column("kodPocztowy", sa.Text, nullable=True),
        sa.Column("miasto", sa.Text, nullable=True),
        sa.Column("dataUrodzenia", sa.Text, nullable=True),
        sa.Column("telefon", sa.Text, nullable=False),
        sa.Column("miejscowoscData", sa.Text, nullable=False),
        sa.Column("nazwaProduktu", sa.Text, nullable=True),
        sa.Column("obszarZabiegu", sa.Text, nullable=True),
        sa.Column("celEfektu", sa.Text, nullable=True),
        sa.Column("znieczulenie", sa.Text, nullable=True),
        sa.Column("przeciwwskazania", postgresql.JSONB, nullable=False),
        sa.Column("zgodaPrzetwarzanieDanych", sa.Boolean, nullable=False),
        sa.Column("zgodaMarketing", sa.Boolean, nullable=False),
        sa.Column("zgodaFotografie", sa.Boolean, nullable=False),
        sa.Column("zgodaPomocPrawna", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("miejscaPublikacjiFotografii", sa.Text, nullable=True),
        sa.Column("podpisDane", sa.Text, nullable=True),
        sa.Column("podpisMarketing", sa.Text, nullable=True),
        sa.Column("podpisFotografie", sa.Text, nullable=True),
        sa.Column("podpisRodo", sa.Text, nullable=True),
        sa.Column("podpisRodo2", sa.Text, nullable=True),
        sa.Column("informacjaDodatkowa", sa.Text, nullable=True),
        sa.Column("zastrzeniaKlienta", sa.Text, nullable=True),
        sa.Column("numerZabiegu", sa.Text, nullable=True),
        sa.Column("osobaPrzeprowadzajacaZabieg", sa.Text, nullable=True),
        sa.Column("metodaZabiegu", sa.Text, nullable=True),
        sa.Column("planowanaIloscZabiegow", sa.Text, nullable=True),
        sa.Column("odstepMiedzyZabiegami", sa.Text, nullable=True),
        sa.Column("kolejneZabiegiOdstepy", sa.Text, nullable=True),
        sa.Column("iloscProduktu", sa.Text, nullable=True),
        sa.Column("signatureStatus", sa.Text, nullable=True, server_default="PENDING"),
        sa.Column("signatureVerifiedAt", sa.DateTime(timezone=False), nullable=True),
        sa.Column("auditLog", postgresql.JSONB, nullable=True),
        sa.Column(
            "clientId", sa.Text, sa.ForeignKey("Client.id", ondelete="SET NULL"), nullable=True
        ),
    )
    op.create_table(
        "OtpVerification",
        sa.Column("id", sa.Text, nullable=False, primary_key=True),
        sa.Column("phoneNumber", sa.Text, nullable=False),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("formId", sa.Text, nullable=True),
        sa.Column("expiresAt", sa.DateTime(timezone=False), nullable=False),
        sa.Column("verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "createdAt", sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_table(
        "AdminUser",
        sa.Column("id", sa.Text, nullable=False, primary_key=True),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("phoneNumber", sa.Text, nullable=True, unique=True),
        sa.Column("passwordHash", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=True),
    )
    op.create_table(
        "TreatmentHistory",
        sa.Column("id", sa.Text, nullable=False, primary_key=True),
        sa.Column(
            "createdAt", sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("date", sa.DateTime(timezone=False), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("znieczulenie", sa.Text, nullable=True),
        sa.Column(
            "formId", sa.Text, sa.ForeignKey("ConsentForm.id", ondelete="CASCADE"), nullable=False
        ),
    )
    op.create_index(
        "OtpVerification_phoneNumber_code_idx", "OtpVerification", ["phoneNumber", "code"]
    )


def downgrade() -> None:
    op.drop_table("TreatmentHistory")
    op.drop_table("AdminUser")
    op.drop_table("OtpVerification")
    op.drop_table("ConsentForm")
    op.drop_table("ClientNote")
    op.drop_table("Client")
    sa.Enum(name="FormType").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="NoteCategory").drop(op.get_bind(), checkfirst=True)
