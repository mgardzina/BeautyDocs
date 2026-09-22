"""Explicitly published salon content; prices are informational PLN amounts."""

from __future__ import annotations

import base64
import binascii
import io
import re
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


class ProfileModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid", str_strip_whitespace=True
    )


class SalonService(ProfileModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    price: int = Field(ge=0, le=100_000_000, strict=True)  # grosze; never float currency
    price_from: bool = False
    duration_minutes: int | None = Field(default=None, ge=5, le=1440)


class SalonPhoto(ProfileModel):
    data_url: str = Field(max_length=300_000)
    caption: str = Field(default="", max_length=160)

    @field_validator("data_url")
    @classmethod
    def valid_image(cls, value: str) -> str:
        match = re.fullmatch(r"data:image/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)", value)
        if not match:
            raise ValueError("Use a JPEG, PNG or WebP image")
        try:
            raw = base64.b64decode(match[1], validate=True)
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(raw)) as source:
                    if (
                        source.format not in {"JPEG", "PNG", "WEBP"}
                        or source.width * source.height > 16_000_000
                    ):
                        raise ValueError("Image is too large or unsupported")
                    picture = ImageOps.exif_transpose(source).convert("RGB")
                    picture.thumbnail((1600, 1600))
                    out = io.BytesIO()
                    picture.save(out, format="JPEG", quality=82, optimize=True)
            encoded = "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()
            if len(encoded) > 300_000:
                raise ValueError("Image is too large")
            return encoded
        except (
            OSError,
            binascii.Error,
            UnidentifiedImageError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ) as exc:
            raise ValueError("Invalid image") from exc


class SalonProfile(ProfileModel):
    introduction: str = Field(default="", max_length=200)
    about: str = Field(default="", max_length=5000)
    photos: list[SalonPhoto] = Field(default_factory=list, max_length=6)
    services: list[SalonService] = Field(default_factory=list, max_length=40)
    latitude: float | None = Field(default=None, ge=-85, le=85, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)

    @model_validator(mode="after")
    def coordinate_pair(self) -> SalonProfile:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Provide both map coordinates")
        return self


def public_profile(tenant) -> dict:
    """Never expose the private account, email, or photo data in directory payloads."""
    profile = tenant.public_profile or {}
    return {
        "slug": tenant.slug,
        "displayName": tenant.display_name,
        "logoUrl": f"/api/beautydocs-preview/salons/{tenant.slug}/logo"
        if tenant.logo_image
        else None,
        "city": tenant.city,
        "addressLine1": tenant.address_line1,
        "addressLine2": tenant.address_line2,
        "postalCode": tenant.postal_code,
        "phone": tenant.phone,
        "websiteUrl": tenant.website_url
        if tenant.website_url and tenant.website_url.startswith(("https://", "http://"))
        else None,
        "introduction": profile.get("introduction", ""),
        "about": profile.get("about", ""),
        "services": profile.get("services", []),
        "latitude": profile.get("latitude"),
        "longitude": profile.get("longitude"),
        "photos": [
            {
                "url": f"/api/beautydocs-preview/salons/{tenant.slug}/photos/{i}",
                "caption": photo.get("caption", ""),
            }
            for i, photo in enumerate(profile.get("photos", []))
        ],
    }
