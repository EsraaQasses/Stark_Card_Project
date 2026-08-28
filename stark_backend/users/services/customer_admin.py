"""Authorized customer administration commands and read-only aggregation."""

from decimal import Decimal, InvalidOperation

from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from agents.models import AgentProfile
from finance.services import FinanceService
from payment.models import Payment
from shipping.models import AgentAdminShippingRequest, AgentShippingRequest, Shipping, StandardShippingRequest
from transactions.models import Transaction
from wallets.models import Wallet
from ..models import AuditLog, CustomerBalanceAdjustment, CustomerCategory, PasswordResetChallenge, User, UserLoginSession
from .password_reset import invalidate_user_authentication, issue_challenge
from .role_service import RoleService


class CustomerAdminError(ValueError):
    code = "CUSTOMER_ADMIN_ERROR"


class PermissionDenied(CustomerAdminError):
    code = "CUSTOMER_ADMIN_FORBIDDEN"


class IdempotencyConflict(CustomerAdminError):
    code = "IDEMPOTENCY_CONFLICT"


class CustomerAdministrationService:
    """Single command boundary; views are intentionally thin adapters."""

    @staticmethod
    def _require_admin(actor):
        if not actor or not actor.is_authenticated or actor.role != "admin":
            raise PermissionDenied("An authenticated administrator is required.")

    @staticmethod
    def _require_superuser(actor):
        CustomerAdministrationService._require_admin(actor)
        if not actor.is_superuser:
            raise PermissionDenied("A full administrator is required for this action.")

    @staticmethod
    def _target(user_id):
        return User.objects.select_for_update().get(pk=user_id)

    @staticmethod
    def _audit(actor, action, target, details, request=None):
        meta = {
            "actor_id": actor.id if actor else None,
            "target_id": getattr(target, "id", target),
            **(details or {}),
        }
        AuditLog.objects.create(
            user=actor,
            action=action,
            resource_type="user",
            resource_id=getattr(target, "id", target),
            details=meta,
            ip_address=(request.META.get("REMOTE_ADDR") if request else None),
            user_agent=(request.META.get("HTTP_USER_AGENT", "")[:500] if request else ""),
        )

    @classmethod
    @transaction.atomic
    def set_banned(cls, actor, user_id, banned, reason, request=None):
        cls._require_admin(actor)
        target = cls._target(user_id)
        if target.id == actor.id or (target.role == "admin" and not actor.is_superuser):
            raise PermissionDenied("This administrator cannot modify that account.")
        previous = target.is_banned
        target.is_banned = bool(banned)
        target.save(update_fields=["is_banned"])
        cls._audit(actor, "CUSTOMER_ADMIN_ACTION", target, {
            "command": "ban" if banned else "unban", "reason": reason or "", "before": previous, "after": target.is_banned,
        }, request)
        return target

    @classmethod
    @transaction.atomic
    def set_active(cls, actor, user_id, active, reason, request=None):
        cls._require_admin(actor)
        target = cls._target(user_id)
        if target.id == actor.id or (target.role == "admin" and not actor.is_superuser):
            raise PermissionDenied("This administrator cannot modify that account.")
        previous = target.is_active
        target.is_active = bool(active)
        target.save(update_fields=["is_active"])
        cls._audit(actor, "CUSTOMER_ADMIN_ACTION", target, {
            "command": "activate" if active else "deactivate", "reason": reason or "", "before": previous, "after": target.is_active,
        }, request)
        return target

    @classmethod
    @transaction.atomic
    def assign_category(cls, actor, user_id, category_id, notes="", request=None):
        cls._require_admin(actor)
        target = cls._target(user_id)
        category = CustomerCategory.objects.select_for_update().get(pk=category_id) if category_id else None
        previous = target.category_id
        if category:
            target.assign_category(category, actor, notes)
        else:
            target.remove_category()
        cls._audit(actor, "CUSTOMER_ADMIN_ACTION", target, {
            "command": "assign_category" if category else "remove_category", "before_category_id": previous,
            "after_category_id": category.id if category else None, "notes": notes or "",
        }, request)
        return target

    @classmethod
    @transaction.atomic
    def assign_agent(cls, actor, user_id, agent_id, request=None):
        cls._require_admin(actor)
        target = cls._target(user_id)
        agent = User.objects.select_for_update().get(pk=agent_id) if agent_id else None
        if target.id == actor.id or target.role != "user":
            raise PermissionDenied("Only regular customers can receive an agent assignment.")
        if agent and (agent.role != "agent" or agent.id == target.id):
            raise ValidationError("agent_id must identify a different agent account.")
        previous = target.agent_id
        target.agent = agent
        target.save(update_fields=["agent"])
        cls._audit(actor, "CUSTOMER_ADMIN_ACTION", target, {
            "command": "assign_agent" if agent else "remove_agent", "before_agent_id": previous,
            "after_agent_id": agent.id if agent else None,
        }, request)
        return target

    @classmethod
    @transaction.atomic
    def change_role(cls, actor, user_id, role, make_superuser=False, request=None):
        cls._require_superuser(actor)
        target = cls._target(user_id)
        if target.id == actor.id or role not in {"user", "agent", "admin"}:
            raise PermissionDenied("Invalid target or role change.")
        previous = target.role
        if role == "agent":
            RoleService.promote_to_agent(target, actor)
        elif role == "admin":
            RoleService.promote_to_admin(target, actor, bool(make_superuser))
        else:
            RoleService.demote_to_user(target, actor)
        target.refresh_from_db()
        cls._audit(actor, "CUSTOMER_ADMIN_ACTION", target, {
            "command": "change_role", "before_role": previous, "after_role": target.role,
            "make_superuser": bool(make_superuser),
        }, request)
        return target

    @classmethod
    def send_password_reset(cls, actor, user_id, reason, request=None):
        cls._require_admin(actor)
        if not isinstance(reason, str) or len(reason.strip()) < 10:
            raise ValidationError("A reason of at least 10 characters is required.")
        with transaction.atomic():
            target = cls._target(user_id)
            if target.id == actor.id or (target.role == "admin" and not actor.is_superuser):
                raise PermissionDenied("This administrator cannot reset that account.")
            issue_challenge(target, request)
            cls._audit(actor, "CUSTOMER_ADMIN_ACTION", target, {
                "command": "send_password_reset", "reason": reason.strip()[:500],
            }, request)
        return {"accepted": True}

    @classmethod
    @transaction.atomic
    def revoke_sessions(cls, actor, user_id, reason, request=None):
        cls._require_admin(actor)
        target = cls._target(user_id)
        if target.id == actor.id or (target.role == "admin" and not actor.is_superuser):
            raise PermissionDenied("This administrator cannot revoke that account's sessions.")
        previous_epoch = target.auth_version
        target.auth_version += 1
        target.save(update_fields=["auth_version"])
        token_count = OutstandingToken.objects.filter(user=target).count()
        invalidate_user_authentication(target)
        cls._audit(actor, "SESSION_REVOKE", target, {
            "reason": reason or "", "previous_auth_version": previous_epoch,
            "new_auth_version": target.auth_version, "tokens_seen": token_count,
        }, request)
        return {"revoked": True, "auth_version": target.auth_version, "tokens_seen": token_count}

    @classmethod
    @transaction.atomic
    def request_adjustment(cls, actor, user_id, amount, currency, reason, idempotency_key, request=None):
        cls._require_admin(actor)
        if not idempotency_key or not isinstance(reason, str) or len(reason.strip()) < 10:
            raise ValidationError("A unique idempotency key and reason of at least 10 characters are required.")
        try:
            delta = Decimal(str(amount))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValidationError("amount must be a Decimal value.") from exc
        currency = str(currency or "").upper()
        if currency not in {"USD", "SYP"} or not delta.is_finite() or delta == 0:
            raise ValidationError("currency and non-zero amount are required.")
        existing = CustomerBalanceAdjustment.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            if (existing.target_user_id, existing.amount, existing.currency, existing.reason) != (user_id, delta, currency, reason.strip()):
                raise IdempotencyConflict("Idempotency key conflicts with a different adjustment.")
            return existing
        target = cls._target(user_id)
        wallet = Wallet.objects.select_for_update().get(user=target, currency=currency)
        adjustment = CustomerBalanceAdjustment.objects.create(
            target_user=target, requested_by=actor, wallet=wallet, amount=delta,
            currency=currency, reason=reason.strip(), idempotency_key=idempotency_key,
        )
        operation_key = f"customer-adjustment:{adjustment.id}"
        context = {"customer_balance_adjustment_id": adjustment.id, "actor_id": actor.id, "reason": adjustment.reason}
        if adjustment.amount > 0:
            tx = FinanceService.deposit(wallet_id=adjustment.wallet_id, amount=adjustment.amount,
                                        transaction_type="deposit", note=f"Admin adjustment #{adjustment.id}",
                                        idempotency_key=operation_key, operation_context=context)
        else:
            tx = FinanceService.withdraw(wallet_id=adjustment.wallet_id, amount=abs(adjustment.amount),
                                         transaction_type="withdrawal", note=f"Admin adjustment #{adjustment.id}",
                                         idempotency_key=operation_key, operation_context=context)
        tx = FinanceService.approve(tx.id, admin_user=actor)
        adjustment.status = "approved"
        adjustment.approved_by = actor
        adjustment.transaction = tx
        adjustment.decision_reason = "Approved by administrator"
        adjustment.decided_at = timezone.now()
        adjustment.save(update_fields=["status", "approved_by", "transaction", "decision_reason", "decided_at"])
        cls._audit(actor, "BALANCE_ADJUSTMENT", target, {
            "command": "apply", "adjustment_id": adjustment.id, "transaction_id": tx.id,
            "amount": str(delta), "currency": currency, "reason": reason.strip(), "status": "approved",
        }, request)
        return adjustment

    @classmethod
    @transaction.atomic
    def decide_adjustment(cls, actor, adjustment_id, approve, reason="", request=None):
        cls._require_admin(actor)
        adjustment = CustomerBalanceAdjustment.objects.select_for_update().select_related("target_user", "wallet").get(pk=adjustment_id)
        if adjustment.status != "pending":
            return adjustment
        if not approve:
            adjustment.status = "rejected"
            adjustment.approved_by = actor
            adjustment.decision_reason = reason or "Rejected by administrator"
            adjustment.decided_at = timezone.now()
            adjustment.save(update_fields=["status", "approved_by", "decision_reason", "decided_at"])
            cls._audit(actor, "BALANCE_ADJUSTMENT", adjustment.target_user, {
                "command": "reject", "adjustment_id": adjustment.id, "reason": adjustment.decision_reason,
            }, request)
            return adjustment

        operation_key = f"customer-adjustment:{adjustment.id}"
        context = {"customer_balance_adjustment_id": adjustment.id, "actor_id": actor.id, "reason": adjustment.reason}
        if adjustment.amount > 0:
            tx = FinanceService.deposit(wallet_id=adjustment.wallet_id, amount=adjustment.amount,
                                        transaction_type="deposit", note=f"Admin adjustment #{adjustment.id}",
                                        idempotency_key=operation_key, operation_context=context)
        else:
            tx = FinanceService.withdraw(wallet_id=adjustment.wallet_id, amount=abs(adjustment.amount),
                                         transaction_type="withdrawal", note=f"Admin adjustment #{adjustment.id}",
                                         idempotency_key=operation_key, operation_context=context)
        tx = FinanceService.approve(tx.id)
        adjustment.status = "approved"
        adjustment.approved_by = actor
        adjustment.transaction = tx
        adjustment.decision_reason = reason or "Approved by administrator"
        adjustment.decided_at = timezone.now()
        adjustment.save(update_fields=["status", "approved_by", "transaction", "decision_reason", "decided_at"])
        cls._audit(actor, "BALANCE_ADJUSTMENT", adjustment.target_user, {
            "command": "approve", "adjustment_id": adjustment.id, "transaction_id": tx.id,
            "amount": str(adjustment.amount), "currency": adjustment.currency,
        }, request)
        return adjustment

    @classmethod
    def aggregate(cls, actor, user_id, limit=25):
        cls._require_admin(actor)
        limit = max(1, min(int(limit or 25), 100))
        user = User.objects.select_related("category", "agent", "category_assigned_by").get(pk=user_id)
        wallets = Wallet.objects.filter(user=user).order_by("currency")
        transactions = Transaction.objects.filter(user=user).order_by("-created_at")[:limit]
        payments = Payment.objects.filter(user=user).select_related("store_product").order_by("-created_at")[:limit]
        requests = user.requests.order_by("-created_at")[:limit]
        shipping = Shipping.objects.filter(user=user).order_by("-created_at")[:limit]
        standard = StandardShippingRequest.objects.filter(user=user).order_by("-created_at")[:limit]
        agent_shipping = AgentShippingRequest.objects.filter(user=user).order_by("-created_at")[:limit]
        admin_shipping = AgentAdminShippingRequest.objects.filter(agent=user).order_by("-created_at")[:limit]
        audit = AuditLog.objects.filter(resource_type="user", resource_id=user.id).select_related("user").order_by("-created_at")[:limit]
        return {
            "profile": {"id": user.id, "name": user.name, "full_name": user.full_name, "email": user.email, "phone": user.phone,
                        "role": user.role, "is_active": user.is_active, "is_banned": user.is_banned, "date_joined": user.date_joined,
                        "last_login": user.last_login},
            "wallets": [{"id": w.id, "currency": w.currency, "available": str(w.available_balance), "pending": str(w.pending_balance),
                         "total": str(w.total_balance)} for w in wallets],
            "recent_transactions": [{"id": tx.id, "type": tx.transaction_type, "status": tx.status, "amount": str(tx.amount),
                                      "currency": tx.currency, "created_at": tx.created_at, "operation_context": tx.operation_context} for tx in transactions],
            "purchases": [{"id": p.id, "status": p.status, "final_price": str(p.final_price), "currency": p.currency,
                           "product": getattr(p.store_product, "name", None), "created_at": p.created_at} for p in payments],
            "requests": [{"id": r.id, "type": r.request_type, "status": r.status, "title": r.title, "amount": str(r.amount) if r.amount is not None else None,
                          "currency": r.currency, "created_at": r.created_at} for r in requests],
            "shipping": [{"source": "shipping", "id": s.id, "status": s.status, "amount": str(s.amount), "currency": s.currency, "created_at": s.created_at} for s in shipping]
                + [{"source": "standard", "id": s.id, "status": s.status, "amount": str(s.amount), "currency": s.currency, "created_at": s.created_at} for s in standard]
                + [{"source": "agent", "id": s.id, "status": s.status, "amount": str(s.amount), "currency": s.currency, "created_at": s.created_at} for s in agent_shipping]
                + [{"source": "admin_agent", "id": s.id, "status": s.status, "amount": str(s.amount), "currency": s.currency, "created_at": s.created_at} for s in admin_shipping],
            "agent": None if not user.agent else {"id": user.agent.id, "name": user.agent.name, "full_name": user.agent.full_name},
            "customer_category": None if not user.category else {"id": user.category.id, "name": user.category.name, "display_name": user.category.display_name,
                                                                    "profit_percentage": str(user.category.profit_percentage), "assigned_at": user.category_assigned_at,
                                                                    "assigned_by": user.category_assigned_by_id, "notes": user.category_notes},
            "security": {"auth_version": user.auth_version, "active_login_sessions": UserLoginSession.objects.filter(user=user, expires_at__gt=timezone.now()).count(),
                         "reset_challenges": PasswordResetChallenge.objects.filter(user=user, consumed_at__isnull=True, expires_at__gt=timezone.now()).count(),
                         "outstanding_tokens": OutstandingToken.objects.filter(user=user).count(), "is_verified": bool(user.is_verified) if hasattr(user, "is_verified") else None},
            "audit_history": [{"id": a.id, "action": a.action, "actor_id": a.user_id, "details": a.details, "created_at": a.created_at} for a in audit],
            "history_limit": limit,
        }
