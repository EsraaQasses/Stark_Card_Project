"""Locked, outage-safe provider catalog synchronization."""

import uuid
from decimal import Decimal, InvalidOperation
from contextlib import suppress

from django.core.cache import cache
from django.db import connection, transaction
from django.utils import timezone

from store.models import ExternalProduct, Product, StoreProduct
from system.models import Notification
from users.models import User
from third_party_apis.models import ProductSyncResult, ProductSyncRun, ThirdPartyAPI
from third_party_apis.utils.connectors import ConnectorFactory


class ProductSyncBusy(Exception):
    code = "PRODUCT_SYNC_ALREADY_RUNNING"


class ProductSynchronizationService:
    LOCK_TTL = 60 * 30

    @staticmethod
    def _status(raw):
        if raw is None:
            return "active"
        value = str(raw).strip().lower()
        if value in {"active", "enabled", "available", "on", "1", "true", "yes"}:
            return "active"
        if value in {"removed", "deleted", "gone"}:
            return "removed"
        if value in {"inactive", "disabled", "off", "0", "false", "no"}:
            return "inactive"
        return "unavailable"

    @staticmethod
    def _cache_invalidate():
        key = "store:catalog:version"
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=None)
        cache.delete_many(("store_products", "user_products", "featured_products", "store_sections"))

    @staticmethod
    def _alert(api_config, message, code):
        for user in User.objects.filter(role__in={"admin", "sub_admin"}):
            Notification.objects.create(
                recipient=user, title=f"Provider sync failed: {api_config.name}",
                message=f"{code}: {message}", icon="sync_error",
            )

    @classmethod
    def synchronize(cls, api_id, *, force=False):
        api_config = ThirdPartyAPI.objects.get(pk=api_id)
        lock_key = f"product-sync:{api_config.provider}:{api_config.id}"
        token = uuid.uuid4().hex
        advisory_lock = False
        if connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_try_advisory_lock(hashtext(%s))", [lock_key])
                advisory_lock = bool(cursor.fetchone()[0])
            if not advisory_lock:
                raise ProductSyncBusy(f"Synchronization already running for {api_config.name}")
        if not cache.add(lock_key, token, timeout=cls.LOCK_TTL):
            if advisory_lock:
                with suppress(Exception):
                    with connection.cursor() as cursor:
                        cursor.execute("SELECT pg_advisory_unlock(hashtext(%s))", [lock_key])
            raise ProductSyncBusy(f"Synchronization already running for {api_config.name}")

        run = ProductSyncRun.objects.create(
            api_config=api_config, provider=api_config.provider,
            run_key=f"{api_config.id}:{timezone.now().isoformat()}:{token}",
        )
        try:
            connector = ConnectorFactory.get_connector(api_config)
            products = connector.get_products()
            if products is None or products == []:
                return cls._finish_unavailable(run, "PROVIDER_EMPTY_RESPONSE", "Provider returned no catalog data")

            valid = []
            partial = False
            for data in products:
                if not isinstance(data, dict) or not data.get("external_id") or not data.get("name"):
                    partial = True
                    ProductSyncResult.objects.create(
                        run=run, external_id=str((data or {}).get("external_id") or "unknown"),
                        status="invalid", message="Provider item missing external_id or name",
                    )
                    continue
                try:
                    base_price = Decimal(str(data.get("base_price", "0")))
                    if not base_price.is_finite() or base_price < 0:
                        raise InvalidOperation
                except (InvalidOperation, TypeError, ValueError):
                    partial = True
                    ProductSyncResult.objects.create(
                        run=run, external_id=str(data.get("external_id")), status="invalid",
                        message="Provider item has invalid base_price",
                    )
                    continue
                valid.append((data, base_price))

            seen_ids = {str(data["external_id"]) for data, _ in valid}
            changed = False
            counts = {"synced": 0, "updated": 0, "unchanged": 0, "removed": 0}
            with transaction.atomic():
                for data, base_price in valid:
                    status = cls._status(data.get("status"))
                    external, created = ExternalProduct.objects.select_for_update().get_or_create(
                        api_config=api_config, external_id=str(data["external_id"]),
                        defaults={"name": data["name"], "description": data.get("description") or "", "base_price": base_price},
                    )
                    old = (external.name, external.base_price, external.provider_status, external.external_data)
                    external.name = data["name"]
                    external.description = data.get("description") or ""
                    external.base_price = base_price
                    external.category = data.get("category", "general")
                    external.required_fields_json = data.get("required_fields", [])
                    external.external_data = data.get("external_data") or data
                    external.provider_status = status
                    external.is_active = status == "active"
                    external.last_sync_error_code = ""
                    external.last_sync_error = ""
                    external.save()
                    current = (external.name, external.base_price, external.provider_status, external.external_data)
                    item_changed = created or old != current
                    changed = changed or item_changed
                    counts["synced" if created else "updated" if item_changed else "unchanged"] += 1
                    for local in StoreProduct.objects.select_for_update().filter(external_product=external):
                        local.provider_status = status
                        if not local.administrator_disabled:
                            local.is_active = status == "active"
                        local.save(update_fields=["provider_status", "is_active", "updated_at"])
                    for local in Product.objects.select_for_update().filter(external_product=external):
                        local.provider_status = status
                        if not local.administrator_disabled:
                            local.is_active = status == "active"
                        local.save(update_fields=["provider_status", "is_active", "updated_at"])
                    ProductSyncResult.objects.create(
                        run=run, external_product=external, external_id=str(data["external_id"]),
                        status=status, changed=item_changed,
                    )

                if not partial:
                    missing = ExternalProduct.objects.select_for_update().filter(
                        api_config=api_config,
                    ).exclude(external_id__in=seen_ids).exclude(provider_status="removed")
                    for external in missing:
                        external.provider_status = "removed"
                        external.is_active = False
                        external.save(update_fields=["provider_status", "is_active", "last_synced"])
                        StoreProduct.objects.filter(external_product=external, administrator_disabled=False).update(
                            provider_status="removed", is_active=False
                        )
                        Product.objects.filter(external_product=external, administrator_disabled=False).update(
                            provider_status="removed", is_active=False
                        )
                        ProductSyncResult.objects.create(
                            run=run, external_product=external, external_id=external.external_id,
                            status="removed", changed=True, message="Provider omitted product from complete response",
                        )
                        counts["removed"] += 1
                        changed = True

            run.status = "partial" if partial else "succeeded"
            run.synced_count = counts["synced"]
            run.updated_count = counts["updated"]
            run.unchanged_count = counts["unchanged"]
            run.removed_count = counts["removed"]
            run.finished_at = timezone.now()
            run.save(update_fields=["status", "synced_count", "updated_count", "unchanged_count", "removed_count", "finished_at"])
            if changed:
                cls._cache_invalidate()
            return {"success": True, "run_id": run.id, "synced_count": counts["synced"], "updated_count": counts["updated"],
                    "total_products": len(products), "valid_products": len(valid), "active_products": sum(1 for d, _ in valid if cls._status(d.get("status")) == "active")}
        except Exception as exc:
            return cls._finish_unavailable(run, "PROVIDER_SYNC_FAILED", str(exc))
        finally:
            if advisory_lock:
                with suppress(Exception):
                    with connection.cursor() as cursor:
                        cursor.execute("SELECT pg_advisory_unlock(hashtext(%s))", [lock_key])
            if cache.get(lock_key) == token:
                cache.delete(lock_key)

    @classmethod
    def _finish_unavailable(cls, run, code, message):
        with transaction.atomic():
            products = list(ExternalProduct.objects.select_for_update().filter(api_config=run.api_config))
            for external in products:
                external.provider_status = "unavailable"
                external.last_sync_error_code = code
                external.last_sync_error = message
                external.save(update_fields=["provider_status", "last_sync_error_code", "last_sync_error", "last_synced"])
                StoreProduct.objects.filter(external_product=external).update(provider_status="unavailable")
                Product.objects.filter(external_product=external).update(provider_status="unavailable")
                ProductSyncResult.objects.create(
                    run=run, external_product=external, external_id=external.external_id,
                    status="unavailable", changed=True, message=message,
                )
        run.status = "unavailable"
        run.error_code = code
        run.error_message = message
        run.unavailable_count = 1
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error_code", "error_message", "unavailable_count", "finished_at"])
        cls._alert(run.api_config, message, code)
        cls._cache_invalidate()
        return {"success": False, "run_id": run.id, "error_code": code, "error": message, "synced_count": 0, "updated_count": 0,
                "total_products": 0, "valid_products": 0}
