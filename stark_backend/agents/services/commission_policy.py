"""Canonical effective agent commission policy."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from django.utils import timezone

from agents.models import AgentProductAssignment, AgentProfile


COMMISSION_POLICY_VERSION = "1.5"
ZERO = Decimal("0.00")
MAX_RATE = Decimal("99.99")


class CommissionPolicyError(ValueError):
    code = "COMMISSION_RATE_INVALID"


@dataclass(frozen=True)
class EffectiveCommissionRate:
    agent_id: Optional[int]
    product_id: Optional[int]
    effective_rate: Decimal
    source: str
    assignment_id: Optional[int]
    calculated_at: object
    policy_version: str = COMMISSION_POLICY_VERSION

    @property
    def rate_fraction(self):
        return self.effective_rate / Decimal("100")

    def to_snapshot(self):
        return {
            "agent_id": self.agent_id,
            "product_id": self.product_id,
            "effective_rate": str(self.effective_rate),
            "source": self.source,
            "assignment_id": self.assignment_id,
            "calculated_at": self.calculated_at.isoformat() if self.calculated_at else None,
            "policy_version": self.policy_version,
        }


def _validated_rate(value, *, code="COMMISSION_RATE_INVALID"):
    try:
        rate = Decimal(str(value))
    except Exception as exc:
        error = CommissionPolicyError("Commission rate must be a Decimal percentage.")
        error.code = code
        raise error from exc
    if not rate.is_finite() or rate < ZERO or rate >= Decimal("100"):
        error = CommissionPolicyError("Commission rate must be between 0 and 99.99%.")
        error.code = code
        raise error
    return rate.quantize(Decimal("0.01"))


class CommissionPolicy:
    """Resolve one effective rate without changing customer or wallet state."""

    @staticmethod
    def resolve(*, customer=None, agent=None, product=None):
        agent = agent or getattr(customer, "agent", None)
        agent_id = getattr(agent, "id", None)
        product_id = getattr(product, "id", None)
        if not agent_id:
            return EffectiveCommissionRate(
                agent_id=None, product_id=product_id, effective_rate=ZERO,
                source="none", assignment_id=None, calculated_at=timezone.now(),
            )

        if product_id:
            assignment = AgentProductAssignment.objects.filter(
                agent_id=agent_id, product_id=product_id, is_active=True,
            ).first()
            if assignment is not None:
                return EffectiveCommissionRate(
                    agent_id=agent_id, product_id=product_id,
                    effective_rate=_validated_rate(assignment.commission_percent, code="COMMISSION_ASSIGNMENT_INVALID"),
                    source="product_assignment", assignment_id=assignment.id,
                    calculated_at=timezone.now(),
                )

        profile = AgentProfile.objects.filter(user_id=agent_id).first()
        if profile is not None:
            return EffectiveCommissionRate(
                agent_id=agent_id, product_id=product_id,
                effective_rate=_validated_rate(profile.commission_rate),
                source="agent_profile", assignment_id=None, calculated_at=timezone.now(),
            )
        return EffectiveCommissionRate(
            agent_id=agent_id, product_id=product_id, effective_rate=ZERO,
            source="none", assignment_id=None, calculated_at=timezone.now(),
        )
