"""Integration checks for the approved product profit override contract."""
from decimal import Decimal
from django.test import TestCase
from store.models import Product, ProductCategoryProfit, Section
from store.services.pricing import PricingPolicy
from users.models import CustomerCategory, User


class ProductMatrixPricingTests(TestCase):
    def setUp(self):
        self.category = CustomerCategory.objects.create(
            name="matrix-pricing", display_name="Matrix Pricing",
            profit_percentage=Decimal("2.00"), is_default=True,
        )
        self.user = User.objects.create_user(
            name="matrix-pricing-user", password="TestPassword123!", role="user",
            category=self.category,
        )
        self.product = Product.objects.create(
            section=Section.objects.create(name_en="Matrix", name_ar="Matrix"),
            name_en="Matrix product", name_ar="Matrix product", product_type="amount_based",
            currency="USD", base_price=Decimal("100.00"),
            min_amount=Decimal("1"), max_amount=Decimal("200"),
            product_profit_percentage=Decimal("5.00"), is_active=True,
        )

    def test_blank_cell_inherits_base_product_profit(self):
        self.assertEqual(PricingPolicy.effective_product_profit_percentage(self.product, self.user), Decimal("5.00"))
        ProductCategoryProfit.objects.create(product=self.product, customer_category=self.category, profit_percentage=None)
        self.assertEqual(PricingPolicy.effective_product_profit_percentage(self.product, self.user), Decimal("5.00"))

    def test_override_replaces_base_product_profit_and_adds_category(self):
        ProductCategoryProfit.objects.create(product=self.product, customer_category=self.category, profit_percentage=Decimal("8.00"))
        rate = PricingPolicy.effective_product_profit_percentage(self.product, self.user)
        self.assertEqual(rate, Decimal("8.00"))
        calculation = PricingPolicy.native_final_amount(
            Decimal("100"), self.user, include_agent_adjustment=False,
            product_profit_percentage=rate,
        )
        self.assertEqual(calculation[-1], Decimal("110.000000000000"))

    def test_zero_override_is_not_missing(self):
        ProductCategoryProfit.objects.create(product=self.product, customer_category=self.category, profit_percentage=Decimal("0.00"))
        self.assertEqual(PricingPolicy.effective_product_profit_percentage(self.product, self.user), Decimal("0.00"))

    def test_unassigned_user_uses_default_category(self):
        self.user.category = None
        self.user.save(update_fields=["category"])
        ProductCategoryProfit.objects.create(product=self.product, customer_category=self.category, profit_percentage=Decimal("3.00"))
        self.assertEqual(PricingPolicy.effective_product_profit_percentage(self.product, self.user), Decimal("3.00"))
