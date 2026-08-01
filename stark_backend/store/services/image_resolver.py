"""Canonical, non-networking product image resolution."""

from urllib.parse import urljoin, urlsplit

from django.conf import settings


class ProductImageResolver:
    PROVIDER_KEYS = ("image_url", "image", "thumbnail_url", "thumbnail")

    @classmethod
    def resolve(cls, product, request=None):
        for candidate in cls._local_candidates(product):
            resolved = cls._absolute(candidate, request)
            if resolved:
                return cls._result(resolved, "local", True, False)
        for candidate in cls._provider_candidates(product):
            resolved = cls._absolute(candidate, request)
            if resolved:
                return cls._result(resolved, "provider", True, False)
        resolved = cls._absolute(getattr(settings, "PRODUCT_IMAGE_PLACEHOLDER_URL", ""), request)
        if resolved:
            return cls._result(resolved, "placeholder", False, True)
        return cls._result(None, "none", False, False)

    @classmethod
    def _local_candidates(cls, product):
        image = getattr(product, "image", None)
        if not image or not getattr(image, "name", None):
            return []
        try:
            return [image.url]
        except (AttributeError, ValueError, OSError):
            return []

    @classmethod
    def _provider_candidates(cls, product):
        external = product if product.__class__.__name__ == "ExternalProduct" else getattr(product, "external_product", None)
        if external and getattr(external, "provider_status", "active") != "active":
            return []
        data = getattr(external, "external_data", None) if external else None
        candidates = []
        if isinstance(data, dict):
            candidates.extend(data.get(key) for key in cls.PROVIDER_KEYS)
            original = data.get("original_data")
            if isinstance(original, dict):
                candidates.extend(original.get(key) for key in cls.PROVIDER_KEYS)
        return [candidate for candidate in candidates if isinstance(candidate, str) and candidate.strip()]

    @classmethod
    def _absolute(cls, candidate, request):
        if not isinstance(candidate, str):
            return None
        candidate = candidate.strip()
        if not candidate or any(char.isspace() for char in candidate):
            return None
        parsed = urlsplit(candidate)
        if parsed.scheme and parsed.scheme.lower() not in {"http", "https"}:
            return None
        if parsed.scheme and not parsed.netloc:
            return None
        if parsed.scheme and parsed.netloc:
            return candidate if len(candidate) <= 2048 else None
        if request is not None:
            try:
                candidate = request.build_absolute_uri(candidate)
            except (AttributeError, ValueError):
                candidate = None
        else:
            media_base = getattr(settings, "MEDIA_BASE_URL", None)
            candidate = urljoin(str(media_base).rstrip("/") + "/", candidate.lstrip("/")) if media_base else None
        if not candidate or len(candidate) > 2048:
            return None
        parsed = urlsplit(candidate)
        return candidate if parsed.scheme.lower() in {"http", "https"} and parsed.netloc else None

    @staticmethod
    def _result(url, source, available, fallback):
        return {
            "image_url": url,
            "image_source": source,
            "image_available": bool(available),
            "image_is_fallback": bool(fallback),
        }
