"""Single source of truth for phone normalization + validation.

Côte d'Ivoire renumbered in 2021 to 10-digit national numbers whose leading 0
is PART of the number. E.164 for CI is therefore `+225` + the full 10 digits,
0 included:  0707050154 -> +2250707050154  (13 digits after the '+').

Foreign numbers (+33, +1, ...) are kept intact and never prefixed with +225.
"""
import re

_STRIP_RE = re.compile(r"[\s\-.()]")
# Collapse accidental double country codes: +225+225, +225225, 225225, 00225225…
_DOUBLE_CC_RE = re.compile(r"^\+?(?:00)?225(?:\+?225)+")


def normalize_phone(phone: str) -> str:
    """Best-effort canonicalization to E.164.

    - CI local 10-digit (leading 0 kept):  0707050154 -> +2250707050154
    - 225 / 00225 / +225 prefixes         -> +225…      (0 preserved)
    - already international (+33, +1, …)   -> unchanged
    - anything else                        -> returned as-is (validation rejects)
    """
    if not phone:
        return phone

    p = _STRIP_RE.sub("", phone.strip())
    p = _DOUBLE_CC_RE.sub("+225", p)

    if p.startswith("00"):
        p = "+" + p[2:]                       # 00225… -> +225…
    if p.startswith("225") and not p.startswith("+"):
        p = "+" + p                           # 225XXXXXXXXXX -> +225XXXXXXXXXX
    if p.startswith("+"):
        return p                              # international (CI or foreign) — keep the 0
    if p.startswith("0") and len(p) == 10:
        return "+225" + p                     # CI local -> keep the full 10-digit number
    return p


def is_valid_e164(phone: str) -> bool:
    """True if `phone` is a plausible E.164 number.

    CI (+225): exactly 10 national digits (13 total). Foreign: 8–15 digits.
    Meant to be called AFTER normalize_phone.
    """
    if not phone or not phone.startswith("+"):
        return False
    digits = phone[1:]
    if not digits.isdigit():
        return False
    if phone.startswith("+225"):
        return len(digits) == 13              # 225 + 10 national digits
    return 8 <= len(digits) <= 15             # generic E.164 bound for foreign numbers


def normalize_ci_momo(number: str) -> str:
    """Canonicalize a MoMo number to the LOCAL 10-digit form (e.g. 0545521606).

    Accepts the way people actually type it — +225…, 225…, 00225…, spaces,
    dashes, dots — and converts to local. Never returns an E.164 form: MoMo
    transfers in CI use the local number. If the input can't be reduced to a
    10-digit local number it is returned best-effort (validation then rejects).

      +2250545521606  -> 0545521606
      2250545521606   -> 0545521606
      00225 0545521606 -> 0545521606
      0545521606      -> 0545521606
    """
    if not number:
        return number
    d = _STRIP_RE.sub("", number.strip()).replace("+", "")
    if d.startswith("00225"):
        d = d[5:]
    elif d.startswith("225") and len(d) == 13:   # 225 + 10 local digits
        d = d[3:]
    return d


def is_valid_ci_momo(number: str) -> bool:
    """True if `number` is a valid LOCAL Ivorian Mobile Money number.

    Exactly 10 digits starting with 0. Call AFTER normalize_ci_momo.
    """
    if not number:
        return False
    digits = _STRIP_RE.sub("", number.strip())
    return digits.isdigit() and len(digits) == 10 and digits.startswith("0")
