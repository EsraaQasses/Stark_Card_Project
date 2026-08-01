# Agent shipping flow smoke test
from decimal import Decimal
from django.core.management.base import BaseCommand
from rest_framework.test import APIRequestFactory, force_authenticate

from users.models import User
from agents.models import AgentProfile
from wallets.models import ExchangeRate, Wallet
from wallets.services import WalletService
from all_requests.models import Request
from shipping.models import Shipping
from shipping.views import ShippingViewSet
from transactions.models import Transaction


class Command(BaseCommand):
    help = "Run a smoke test for agent-handled shipping approval flow."

    def handle(self, *args, **options):
        self.stdout.write("== AGENT SHIPPING FLOW TEST START ==")

        rate = ExchangeRate.objects.order_by("-updated_at").first()
        if not rate:
            rate = ExchangeRate.objects.create(usd_to_syp=Decimal("116"))
        self.stdout.write(f"Exchange rate OK: 1 USD = {rate.usd_to_syp} SYP")

        admin, _ = User.objects.get_or_create(
            name="agent_flow_admin",
            defaults={
                "full_name": "Agent Flow Admin",
                "email": "agent_flow_admin@example.com",
                "role": "admin",
                "is_active": True,
            },
        )
        if admin.role != "admin":
            admin.role = "admin"
            admin.save(update_fields=["role"])

        agent, _ = User.objects.get_or_create(
            name="agent_flow_agent",
            defaults={
                "full_name": "Agent Flow Agent",
                "email": "agent_flow_agent@example.com",
                "role": "agent",
                "is_active": True,
            },
        )
        if agent.role != "agent":
            agent.role = "agent"
            agent.save(update_fields=["role"])

        user_with_agent, _ = User.objects.get_or_create(
            name="agent_flow_user_with_agent",
            defaults={
                "full_name": "Agent Flow User (Agent)",
                "email": "agent_flow_user_with_agent@example.com",
                "role": "user",
                "is_active": True,
                "agent": agent,
            },
        )
        if user_with_agent.agent_id != agent.id:
            user_with_agent.agent = agent
            user_with_agent.save(update_fields=["agent"])

        user_without_agent, _ = User.objects.get_or_create(
            name="agent_flow_user_without_agent",
            defaults={
                "full_name": "Agent Flow User (No Agent)",
                "email": "agent_flow_user_without_agent@example.com",
                "role": "user",
                "is_active": True,
            },
        )
        if user_without_agent.agent_id is not None:
            user_without_agent.agent = None
            user_without_agent.save(update_fields=["agent"])

        agent_profile, _ = AgentProfile.objects.get_or_create(user=agent)
        agent_profile.coverage_limit_usd = Decimal("100.00")
        agent_profile.coverage_limit_syp = Decimal("0.00")
        agent_profile.save(update_fields=["coverage_limit_usd", "coverage_limit_syp"])

        agent_wallet = WalletService.get_or_create_wallet(agent, "USD")
        user_agent_wallet = WalletService.get_or_create_wallet(user_with_agent, "USD")
        user_no_agent_wallet = WalletService.get_or_create_wallet(user_without_agent, "USD")

        Wallet.objects.filter(id=agent_wallet.id).update(available_balance=Decimal("0.00"), pending_balance=Decimal("0.00"))
        Wallet.objects.filter(id=user_agent_wallet.id).update(available_balance=Decimal("0.00"), pending_balance=Decimal("0.00"))
        Wallet.objects.filter(id=user_no_agent_wallet.id).update(available_balance=Decimal("0.00"), pending_balance=Decimal("0.00"))

        # Clear previous test requests
        Request.objects.filter(title__startswith="Agent Flow Smoke").delete()

        req_agent = Request.objects.create(
            user=agent,
            request_type="payment",
            status="pending",
            title="Agent Flow Smoke - Agent Request",
            description="Agent request",
            amount=Decimal("10.00"),
            currency="USD",
        )
        req_user_with_agent = Request.objects.create(
            user=user_with_agent,
            request_type="payment",
            status="pending",
            title="Agent Flow Smoke - User With Agent",
            description="User with agent request",
            amount=Decimal("50.00"),
            currency="USD",
        )
        req_user_without_agent = Request.objects.create(
            user=user_without_agent,
            request_type="payment",
            status="pending",
            title="Agent Flow Smoke - User Without Agent",
            description="User without agent request",
            amount=Decimal("20.00"),
            currency="USD",
        )

        ship_agent = Shipping.objects.get(request=req_agent)
        ship_with_agent = Shipping.objects.get(request=req_user_with_agent)
        ship_without_agent = Shipping.objects.get(request=req_user_without_agent)

        factory = APIRequestFactory()

        list_view = ShippingViewSet.as_view({"get": "list"})
        list_req = factory.get("/api/shipping/")
        force_authenticate(list_req, user=admin)
        list_response = list_view(list_req)
        if isinstance(list_response.data, list):
            list_data = list_response.data
        else:
            list_data = list_response.data.get("results", list_response.data)

        expected_order = [ship_agent.id, ship_without_agent.id, ship_with_agent.id]
        id_set = set(expected_order)
        actual_order = [item["id"] for item in list_data if item["id"] in id_set]
        if actual_order != expected_order:
            raise RuntimeError(f"Admin list ordering failed. Expected {expected_order}, got {actual_order}")
        self.stdout.write("Admin list ordering OK")

        update_view = ShippingViewSet.as_view({"post": "update_status"})

        # Agent approves shipping for their user (transfer under the hood)
        agent_req = factory.post("/api/shipping/{}/update_status/".format(ship_with_agent.id), {"status": "approved"})
        force_authenticate(agent_req, user=agent)
        agent_resp = update_view(agent_req, pk=ship_with_agent.id)
        if agent_resp.status_code != 200:
            raise RuntimeError(f"Agent approval failed: {agent_resp.data}")

        agent_wallet.refresh_from_db()
        user_agent_wallet.refresh_from_db()
        if agent_wallet.available_balance != Decimal("-50.00"):
            raise RuntimeError(f"Agent wallet balance incorrect: {agent_wallet.available_balance}")
        if user_agent_wallet.available_balance != Decimal("50.00"):
            raise RuntimeError(f"User wallet balance incorrect: {user_agent_wallet.available_balance}")

        transfer_tx = Transaction.objects.filter(
            user=agent,
            transaction_type="transfer",
            recipient=user_with_agent,
            amount=Decimal("-50.00"),
        ).first()
        if not transfer_tx:
            raise RuntimeError("Transfer transaction not found for agent-funded approval")
        self.stdout.write("Agent approval transfer OK")

        # Admin approves shipping for user without agent (deposit)
        admin_req = factory.post("/api/shipping/{}/update_status/".format(ship_without_agent.id), {"status": "approved"})
        force_authenticate(admin_req, user=admin)
        admin_resp = update_view(admin_req, pk=ship_without_agent.id)
        if admin_resp.status_code != 200:
            raise RuntimeError(f"Admin approval failed: {admin_resp.data}")

        user_no_agent_wallet.refresh_from_db()
        if user_no_agent_wallet.available_balance != Decimal("20.00"):
            raise RuntimeError(f"Admin deposit balance incorrect: {user_no_agent_wallet.available_balance}")

        deposit_tx = Transaction.objects.filter(
            user=user_without_agent,
            transaction_type="deposit",
            amount=Decimal("20.00"),
        ).first()
        if not deposit_tx:
            raise RuntimeError("Deposit transaction not found for admin approval")
        self.stdout.write("Admin approval deposit OK")

        self.stdout.write("== AGENT SHIPPING FLOW TEST PASSED ==")
