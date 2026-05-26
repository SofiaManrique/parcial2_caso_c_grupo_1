"""Sanitización de texto libre para prevenir Stored XSS (OWASP A03)."""
import bleach

ALLOWED_TAGS: list[str] = []
ALLOWED_ATTRS: dict[str, list[str]] = {}


def sanitize_text(value: str | None) -> str:
    """Elimina todo HTML del texto. Para campos como observaciones y descripciones."""
    if not value:
        return ""
    return bleach.clean(value, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True).strip()
