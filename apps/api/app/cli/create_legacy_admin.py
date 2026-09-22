"""Create a single-salon admin through SQLAlchemy; never print credentials."""

from __future__ import annotations

import argparse
import asyncio
import getpass
import os

import bcrypt
from sqlalchemy import select

from app.core.config import Settings
from app.db.session import Database
from app.models.legacy import LegacyAdminUser


async def create_admin(email: str, password: str, name: str, phone: str | None) -> str:
    if not email or "@" not in email or len(password) < 12 or len(password.encode()) > 72:
        raise ValueError("Use a valid email and a password of 12-72 UTF-8 bytes")
    database = Database(Settings())
    if not database.configured:
        raise ValueError("Set BEAUTYDOCS_DATABASE_URL in apps/api/.env")
    try:
        async with database.session() as session:
            if await session.scalar(
                select(LegacyAdminUser.id).where(LegacyAdminUser.email == email)
            ):
                raise ValueError("An administrator with this email already exists")
            user = LegacyAdminUser(
                email=email,
                name=name,
                phoneNumber=phone,
                passwordHash=bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode(),
            )
            session.add(user)
            await session.flush()
            return user.id
    finally:
        await database.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL"))
    parser.add_argument("--name", default=os.getenv("ADMIN_NAME", "Administrator"))
    parser.add_argument("--phone", default=os.getenv("PHONE_NUMBER"))
    args = parser.parse_args()
    if not args.email:
        parser.error("Provide --email or ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Administrator password: ")
    try:
        asyncio.run(create_admin(args.email, password, args.name, args.phone))
    except ValueError as exc:
        parser.exit(1, f"{exc}\n")
    print("Administrator created. Sign in at /admin/login.")


if __name__ == "__main__":
    main()
