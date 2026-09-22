from __future__ import annotations

import re

_NIP_WEIGHTS = (6, 5, 7, 2, 3, 4, 5, 6, 7)


def normalize_polish_nip(value: str) -> str:
    return re.sub(r"[\s-]", "", value)


def is_valid_polish_nip(value: str) -> bool:
    nip = normalize_polish_nip(value)
    if re.fullmatch(r"\d{10}", nip) is None:
        return False

    checksum = sum(int(nip[index]) * weight for index, weight in enumerate(_NIP_WEIGHTS)) % 11
    return checksum != 10 and checksum == int(nip[-1])
