from decimal import Decimal, ROUND_DOWN

from django.test import TestCase

from agents.models import AgentProductAssignment, AgentProfile
from agents.services.commission_policy import CommissionPolicy
from store.models import Product, Section
from store.services.pricing import PricingPolicy
from users.models import User


class CommissionPolicyTests(TestCase):
    def setUp(self):
        self.agent = User.objects.create_user(
            name="policy-agent", email="policy-agent@example.com", password="Password-9!", role="agent"
        )
        self.user = User.objects.create_user(
            name="policy-user", email="policy-user@example.com", password="Password-9!", role="user"
        )
        self.user.agent = self.agent
        self.user.save(update_fields=["agent"])
        AgentProfile.objects.create(user=self.agent, commission_rate=Decimal("10.00"))
        section = Section.objects.create(name_en="Test", name_ar="اختبار")
        self.product = Product.objects.create(
            section=section, name_en="Product", name_ar="منتج", base_price=Decimal("20"), currency="USD"
        )

    def test_product_assignment_overrides_profile(self):
        assignment = AgentProductAssignment.objects.create(
            agent=self.agent, product=self.product, commission_percent=Decimal("12.50")
        )
        result = CommissionPolicy.resolve(customer=self.user, product=self.product)
        self.assertEqual(result.effective_rate, Decimal("12.50"))
        self.assertEqual(result.source, "product_assignment")
        self.assertEqual(result.assignment_id, assignment.id)

    def test_zero_assignment_is_explicit_override(self):
        AgentProductAssignment.objects.create(
            agent=self.agent, product=self.product, commission_percent=Decimal("0.00")
        )
        result = CommissionPolicy.resolve(customer=self.user, product=self.product)
        self.assertEqual(result.effective_rate, Decimal("0.00"))
        self.assertEqual(result.source, "product_assignment")

    def test_inactive_assignment_falls_back_to_profile(self):
        AgentProductAssignment.objects.create(
            agent=self.agent, product=self.product, commission_percent=Decimal("0.00"), is_active=False
        )
        result = CommissionPolicy.resolve(customer=self.user, product=self.product)
        self.assertEqual(result.effective_rate, Decimal("10.00"))
        self.assertEqual(result.source, "agent_profile")

    def test_pricing_snapshot_contains_effective_policy(self):
        AgentProductAssignment.objects.create(
            agent=self.agent, product=self.product, commission_percent=Decimal("10.00")
        )
        result = PricingPolicy.calculate(
            native_base_amount=Decimal("20"), native_currency="USD", wallet_currency="USD",
            user=self.user, product=self.product, product_id=self.product.id,
        )
        snapshot = result.to_snapshot()
        self.assertEqual(snapshot["agent_commission_source"], "product_assignment")
        self.assertEqual(snapshot["agent_commission_rate"], "10.00")
        self.assertEqual(snapshot["agent_assignment_id"], AgentProductAssignment.objects.get().id)
        self.assertEqual(
            result.expected_agent_commission_amount,
            (result.wallet_charge_amount * Decimal("0.10")).quantize(Decimal("0.0001"), rounding=ROUND_DOWN),
        )
