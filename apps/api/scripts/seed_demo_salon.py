"""Seed a fictional demo salon for product screenshots and videos (local only).

Creates "Atelier Aurora" with an owner account, a practitioner, fictional
clients, a calendar of visits and notes, then signs a few forms through the
real public signing flow and the practitioner flow of a *running* local API,
so every document on screen is genuinely produced by the product.

Every person, phone number and address here is invented.

    BEAUTYDOCS_ENVIRONMENT=test npm run api:dev      # API on :8080; "test" never sends SMS
    cd apps/api && BEAUTYDOCS_ENVIRONMENT=test .venv/bin/python scripts/seed_demo_salon.py

Owner sign-in for the demo panel: DEMO_OWNER_EMAIL / DEMO_OWNER_PASSWORD below
(override the password with BEAUTYDOCS_DEMO_PASSWORD). Refuses to run unless
BEAUTYDOCS_ENVIRONMENT is local or test.
"""

from __future__ import annotations

import asyncio
import base64
import io
import math
import os
import random
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from PIL import Image, ImageDraw
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password, normalize_email  # noqa: E402
from app.db.tenant_context import set_tenant_context  # noqa: E402
from app.models.domain import (  # noqa: E402
    Client,
    ClientNote,
    FormTemplate,
    MembershipRole,
    TeamMember,
    Tenant,
    TenantFormTemplate,
    TenantMembership,
    TenantStatus,
    User,
    Visit,
    VisitStatus,
)
from app.services.signature_sms import normalize_phone  # noqa: E402

DEMO_SLUG = "atelier-aurora"
DEMO_OWNER_EMAIL = "demo.owner@example.com"
DEMO_OWNER_PASSWORD = os.environ.get("BEAUTYDOCS_DEMO_PASSWORD", "Aurora-Demo-2026!")
DEMO_OWNER_PHONE = "+48 500 100 200"
API = os.environ.get("BEAUTYDOCS_API_URL", "http://localhost:8080/api/v1")
ORIGIN = "http://localhost:3000"
WARSAW = ZoneInfo("Europe/Warsaw")

ENABLED_FORMS = [
    ("modelowanie-ust", 60),
    ("wolumetria-twarzy", 60),
    ("mezoterapia-iglowa", 45),
    ("makijaz-permanentny", 120),
    ("depilacja-laserowa", 45),
    ("laminacja-rzes-brwi", 60),
    ("oczyszczanie-twarzy", 60),
    ("farbowanie-rzes-brwi", 30),
]

CLIENTS = [
    ("Zofia", "Wiśniewska", "501 234 118", "1991-04-12"),
    ("Maja", "Lewandowska", "502 411 907", "1988-11-03"),
    ("Hanna", "Kamińska", "503 820 344", "1995-02-27"),
    ("Julia", "Zielińska", "504 119 562", "1993-07-19"),
    ("Oliwia", "Szymańska", "505 736 210", "1985-09-08"),
    ("Aleksandra", "Woźniak", "506 204 873", "1999-01-30"),
    ("Natalia", "Dąbrowska", "507 648 191", "1990-05-16"),
    ("Wiktoria", "Kozłowska", "508 377 425", "1997-12-02"),
    ("Emilia", "Jankowska", "509 512 736", "1987-03-21"),
    ("Laura", "Mazur", "510 883 604", "1994-08-11"),
    ("Karolina", "Krawczyk", "511 290 457", "1992-10-25"),
    ("Magdalena", "Piotrowska", "512 604 318", "1983-06-07"),
    ("Agata", "Grabowska", "513 145 992", "1996-04-29"),
    ("Paulina", "Pawłowska", "514 738 051", "1989-02-14"),
]

TREATMENTS = [
    ("modelowanie-ust", "Modelowanie ust"),
    ("mezoterapia-iglowa", "Mezoterapia igłowa"),
    ("laminacja-rzes-brwi", "Laminacja brwi"),
    ("oczyszczanie-twarzy", "Oczyszczanie twarzy"),
    ("depilacja-laserowa", "Depilacja laserowa"),
    ("wolumetria-twarzy", "Wypełnianie kwasem hialuronowym"),
]

NOTES = [
    ("Preferuje wizyty po 16:00. Wrażliwa skóra w okolicy żuchwy.", "NOTATKA"),
    ("Uczulenie na lateks — używać rękawiczek nitrylowych.", "ALERGIA"),
    ("Po ostatnim zabiegu lekki obrzęk przez 24 h. Zalecono SPF 50 i kontrolę za 4 tygodnie.", "UWAGA"),
]

PROFILE = {
    "introduction": "Kameralne studio medycyny estetycznej i kosmetologii w sercu Krakowa.",
    "about": (
        "Atelier Aurora to spokojne miejsce, w którym zabiegi planujemy razem z Tobą. "
        "Pracujemy na sprawdzonych preparatach, a dokumentację i zgody wypełnisz wygodnie online "
        "jeszcze przed wizytą."
    ),
    "services": [
        {"name": "Modelowanie ust", "description": "Kwas hialuronowy, konsultacja w cenie.", "price": 90000, "priceFrom": True, "durationMinutes": 60},
        {"name": "Mezoterapia igłowa", "description": "Rewitalizacja i nawilżenie skóry.", "price": 45000, "priceFrom": False, "durationMinutes": 45},
        {"name": "Laminacja brwi", "description": "Z koloryzacją i regulacją.", "price": 18000, "priceFrom": False, "durationMinutes": 60},
        {"name": "Oczyszczanie twarzy", "description": "Wodorowe, z maską dobraną do skóry.", "price": 25000, "priceFrom": False, "durationMinutes": 60},
    ],
    "latitude": 50.0614,
    "longitude": 19.9372,
    "photos": [],
}


def signature_curve(seed: int, x0: float, y0: float, width: float, height: float) -> list[tuple[float, float]]:
    """Joined cursive loops with a tall opening loop, like a quick handwritten signature."""

    rng = random.Random(seed)
    loops = rng.choice([6, 7])
    total = loops * 2 * math.pi
    advance = width * 0.62 / total
    points = []
    t = 0.0
    while t <= total:
        loop = int(t / (2 * math.pi))
        amp = height * (0.13 + 0.07 * math.sin(t * 0.37 + seed) + (0.16 if loop == 0 else 0.07 if loop in (2, 5) else 0))
        points.append((x0 + advance * t + amp * 0.9 * math.sin(t), y0 - amp * (1 - math.cos(t)) * 0.9 + amp * 0.15))
        t += 0.04
    last_x, last_y = points[-1]
    points += [(last_x + width * 0.045, last_y + height * 0.06), (last_x + width * 0.1, last_y + height * 0.02)]
    return points


def signature_png(seed: int) -> str:
    """A hand-drawn-looking signature as a PNG data URL (drawn 3x, downsampled)."""

    scale, width, height = 3, 900, 260
    image = Image.new("RGBA", (width * scale, height * scale), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    x0, y0 = 110 * scale, height * 0.62 * scale
    points = signature_curve(seed, x0, y0, width * scale, height * scale)
    draw.line(points, fill=(23, 61, 53, 255), width=5 * scale, joint="curve")
    draw.line([(x0 + 30 * scale, y0 + 38 * scale), (points[-1][0] - 20 * scale, y0 + 30 * scale)], fill=(23, 61, 53, 255), width=4 * scale)
    image = image.resize((width, height), Image.LANCZOS)
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(out.getvalue()).decode()


def local_dt(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=WARSAW)


async def seed_database(session: AsyncSession) -> tuple[Tenant, dict[str, Client]]:
    existing = await session.scalar(select(Tenant).where(Tenant.slug == DEMO_SLUG))
    if existing is not None:
        # Resume: the database half is done, only the signing flows may be missing.
        await set_tenant_context(session, existing.id)
        rows = (await session.scalars(select(Client).where(Client.tenant_id == existing.id))).all()
        by_name = {f"{c.first_name} {c.last_name}": c for c in rows}
        return existing, {f"{first} {last}": by_name[f"{first} {last}"] for first, last, _, _ in CLIENTS}

    schedule = {
        "slotIntervalMinutes": 30,
        "days": [
            {"weekday": weekday, "enabled": weekday < 6, "opensAt": "09:00", "closesAt": "19:00" if weekday < 5 else "15:00"}
            for weekday in range(7)
        ],
    }
    tenant = Tenant(
        slug=DEMO_SLUG,
        display_name="Atelier Aurora",
        legal_name="Atelier Aurora Sp. z o.o.",
        email="kontakt@atelier-aurora.example.com",
        privacy_contact_email="rodo@atelier-aurora.example.com",
        phone="+48 12 345 67 89",
        website_url="https://atelier-aurora.example.com",
        address_line1="ul. Floriańska 21",
        postal_code="31-019",
        city="Kraków",
        public_profile=PROFILE,
        directory_visible=True,
        booking_schedule=schedule,
        status=TenantStatus.ACTIVE.value,
    )
    session.add(tenant)
    await session.flush()
    await set_tenant_context(session, tenant.id)

    owner = await session.scalar(select(User).where(User.email_normalized == normalize_email(DEMO_OWNER_EMAIL)))
    if owner is not None:
        owner.signature_data_url = signature_png(7)
        owner.signature_updated_at = datetime.now(UTC)
    else:
        owner = User(
            email=DEMO_OWNER_EMAIL,
            email_normalized=normalize_email(DEMO_OWNER_EMAIL),
            password_hash=hash_password(DEMO_OWNER_PASSWORD),
            display_name="Julia Nowak",
            phone_normalized=normalize_phone(DEMO_OWNER_PHONE),
            email_verified_at=datetime.now(UTC),
            signature_data_url=signature_png(7),
            signature_updated_at=datetime.now(UTC),
        )
        session.add(owner)
        await session.flush()

    membership = TenantMembership(tenant_id=tenant.id, user_id=owner.id, role=MembershipRole.OWNER.value)
    session.add(membership)
    await session.flush()
    session.add_all(
        [
            TeamMember(
                tenant_id=tenant.id,
                membership_id=membership.id,
                display_name="Julia Nowak",
                email=DEMO_OWNER_EMAIL,
                phone=DEMO_OWNER_PHONE,
                phone_normalized=normalize_phone(DEMO_OWNER_PHONE),
                job_title="Lekarz medycyny estetycznej",
                is_owner=True,
                performs_treatments=True,
                all_treatments=True,
                treatment_codes=[],
                signature_data_url=signature_png(7),
                signature_updated_at=datetime.now(UTC),
            ),
            TeamMember(
                tenant_id=tenant.id,
                display_name="Marta Kaczmarek",
                email="marta.kaczmarek@example.com",
                job_title="Kosmetolog",
                performs_treatments=True,
                all_treatments=False,
                treatment_codes=["laminacja-rzes-brwi", "oczyszczanie-twarzy", "farbowanie-rzes-brwi"],
            ),
            TeamMember(
                tenant_id=tenant.id,
                display_name="Ewa Sikora",
                email="ewa.sikora@example.com",
                job_title="Recepcja",
                performs_treatments=False,
                all_treatments=False,
                treatment_codes=[],
            ),
        ]
    )

    templates = {
        row.code: row.id
        for row in (await session.execute(select(FormTemplate.code, FormTemplate.id))).all()
    }
    for order, (code, minutes) in enumerate(ENABLED_FORMS):
        if code in templates:
            session.add(
                TenantFormTemplate(
                    tenant_id=tenant.id,
                    form_template_id=templates[code],
                    enabled=True,
                    display_order=order,
                    duration_minutes=minutes,
                )
            )

    clients: dict[str, Client] = {}
    for first, last, phone, birth in CLIENTS:
        client = Client(
            tenant_id=tenant.id,
            first_name=first,
            last_name=last,
            first_name_normalized=first.casefold(),
            last_name_normalized=last.casefold(),
            phone=f"+48 {phone}",
            phone_normalized=normalize_phone(f"+48 {phone}"),
            email=f"{first.lower()}.{normalize_ascii(last)}@example.com",
            birth_date=date.fromisoformat(birth),
        )
        session.add(client)
        clients[f"{first} {last}"] = client
    await session.flush()

    rng = random.Random(2026)
    today = datetime.now(WARSAW).date()
    client_list = list(clients.values())
    # Twelve weeks of history for the charts, busier towards now.
    for week in range(12, 0, -1):
        for _ in range(3 + (12 - week) // 2):
            day = today - timedelta(days=week * 7 - rng.randint(0, 5))
            code, name = rng.choice(TREATMENTS)
            start = local_dt(day, rng.choice([9, 10, 11, 13, 14, 15, 16, 17]), rng.choice([0, 30]))
            session.add(
                Visit(
                    tenant_id=tenant.id,
                    client_id=rng.choice(client_list).id,
                    staff_membership_id=membership.id,
                    form_template_id=templates.get(code),
                    treatment_name=name,
                    starts_at=start,
                    ends_at=start + timedelta(minutes=60),
                    status=VisitStatus.COMPLETED.value,
                )
            )
    # This week and next: a full-looking calendar with today's agenda.
    monday = today - timedelta(days=today.weekday())
    for offset in range(0, 12):
        day = monday + timedelta(days=offset)
        if day.weekday() == 6:
            continue
        hours = [9, 10.5, 12, 14, 15.5, 17] if day.weekday() < 5 else [9.5, 11, 12.5]
        for hour in hours:
            if rng.random() < 0.25:
                continue
            code, name = rng.choice(TREATMENTS)
            start = local_dt(day, int(hour), 30 if hour % 1 else 0)
            session.add(
                Visit(
                    tenant_id=tenant.id,
                    client_id=rng.choice(client_list).id,
                    staff_membership_id=membership.id,
                    form_template_id=templates.get(code),
                    treatment_name=name,
                    starts_at=start,
                    ends_at=start + timedelta(minutes=60),
                    status=VisitStatus.COMPLETED.value if day < today else VisitStatus.PLANNED.value,
                )
            )
    for client in client_list[:5]:
        for body, category in NOTES:
            session.add(
                ClientNote(
                    tenant_id=tenant.id,
                    client_id=client.id,
                    author_membership_id=membership.id,
                    body=body,
                    category=category,
                )
            )
    await session.flush()
    return tenant, clients


def normalize_ascii(value: str) -> str:
    table = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
    return value.translate(table).lower()


async def sign_forms_through_api(clients: dict[str, Client]) -> None:
    """Run the real client + practitioner signing flows against the local API."""

    headers = {"origin": ORIGIN, "content-type": "application/json"}
    async with httpx.AsyncClient(base_url=API, timeout=30, headers=headers) as http:
        form = (await http.get(f"/public/tenants/{DEMO_SLUG}/forms/modelowanie-ust")).json()
        practitioner_id = form["practitioners"][0]["id"]
        questions = next(s for s in form["definition"]["sections"] if s.get("type") == "contraindications")["items"]

        signed = []
        for index, (name, client) in enumerate(list(clients.items())[:6]):
            code = ["modelowanie-ust", "mezoterapia-iglowa", "laminacja-rzes-brwi", "modelowanie-ust", "oczyszczanie-twarzy", "wolumetria-twarzy"][index]
            if code != "modelowanie-ust":
                form = (await http.get(f"/public/tenants/{DEMO_SLUG}/forms/{code}")).json()
                questions = next(s for s in form["definition"]["sections"] if s.get("type") == "contraindications")["items"]
            answers = {q["key"]: {"answer": "no", "followUp": ""} for q in questions}
            draft = {
                "client": {
                    "fullName": name,
                    "phone": client.phone,
                    "email": client.email,
                    "birthDate": client.birth_date.isoformat() if client.birth_date else None,
                    "street": "ul. Długa 5/2",
                    "postalCode": "31-147",
                    "city": "Kraków",
                },
                "treatmentArea": ["usta"] if code == "modelowanie-ust" else [],
                "answers": {
                    "nazwaProduktu": "Juvederm Volift" if code in {"modelowanie-ust", "wolumetria-twarzy"} else "",
                    "celEfektu": "Delikatne powiększenie i nawilżenie" if code == "modelowanie-ust" else "Rewitalizacja skóry",
                    "contraindications": answers,
                },
                "consents": {},
                "placeAndDate": f"Kraków, {datetime.now(WARSAW):%d.%m.%Y}",
                "practitionerTeamMemberId": practitioner_id,
                "locale": "pl",
            }
            start = await http.post(f"/public/tenants/{DEMO_SLUG}/forms/{code}/submissions/client-verification", json=draft)
            start.raise_for_status()
            started = start.json()
            submission_id = started["submissionId"]
            token = started["submissionToken"]
            base = f"/public/tenants/{DEMO_SLUG}/forms/{code}/submissions/{submission_id}"
            confirm = await http.post(
                f"{base}/client-verification/confirm",
                json={"submissionToken": token, "verificationId": started["verificationId"], "code": started["devCode"]},
            )
            confirm.raise_for_status()
            consents = {
                "zgodaWykonanieZabiegu": True,
                "zgodaPrzetwarzanieDanych": True,
                "zgodaMarketing": index % 2 == 0,
                "zgodaFotografie": index % 3 == 0,
            }
            signatures = {
                "podpisDane": signature_png(100 + index),
                "podpisRodo": signature_png(200 + index),
                "podpisMarketing": signature_png(300 + index),
                "podpisFotografie": signature_png(400 + index),
            }
            sign = await http.post(
                f"{base}/client-signature",
                json={"submissionToken": token, "verificationId": started["verificationId"], "consents": consents, "signatures": signatures},
            )
            if sign.status_code >= 400:
                raise SystemExit(f"Client signature failed: {sign.status_code} {sign.text}")
            signed.append((client, submission_id))

        login = await http.post("/auth/login", json={"email": DEMO_OWNER_EMAIL, "password": DEMO_OWNER_PASSWORD})
        login.raise_for_status()
        # Practitioner countersigns the first four; the rest stay "awaiting salon signature".
        for client, submission_id in signed[:4]:
            base = f"/admin/tenants/{DEMO_SLUG}/clients/{client.id}/forms/{submission_id}"
            started = await http.post(f"{base}/practitioner-verification", json={})
            started.raise_for_status()
            verification = started.json()
            (await http.post(
                f"{base}/practitioner-verification/confirm",
                json={"verificationId": verification["verificationId"], "code": verification["devCode"]},
            )).raise_for_status()
            (await http.post(
                f"{base}/practitioner-signature",
                json={"verificationId": verification["verificationId"], "signature": signature_png(7)},
            )).raise_for_status()
        await http.post("/auth/logout")


async def main() -> None:
    settings = get_settings()
    if settings.environment not in {"local", "test"}:
        raise SystemExit("Refusing to seed demo data outside a local/test environment.")
    if settings.environment != "test" and settings.smsapi_token is not None:
        # In "local" with a real SMSAPI token the API would text these invented numbers.
        raise SystemExit(
            "An SMSAPI token is configured. Run both the API and this script with "
            "BEAUTYDOCS_ENVIRONMENT=test so no real SMS is sent to the fictional numbers."
        )
    engine = create_async_engine(settings.database_url.get_secret_value())
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session, session.begin():
        _, clients = await seed_database(session)
    await engine.dispose()
    await sign_forms_through_api(clients)
    print(f"Seeded '{DEMO_SLUG}'. Owner: {DEMO_OWNER_EMAIL} (password: see DEMO_OWNER_PASSWORD).")


if __name__ == "__main__":
    asyncio.run(main())
