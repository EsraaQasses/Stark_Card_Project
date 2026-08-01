from django.core.management.base import BaseCommand
from rest_framework.test import APIRequestFactory, force_authenticate

from users.models import User
from agents.views import AgentConnectView


class Command(BaseCommand):
    help = "Run a smoke test for agent connect flow (list/QR/switch/admin override)."

    def handle(self, *args, **options):
        self.stdout.write("== AGENT CONNECT FLOW TEST START ==")

        admin, _ = User.objects.get_or_create(
            name="agent_connect_admin",
            defaults={
                "full_name": "Agent Connect Admin",
                "email": "agent_connect_admin@example.com",
                "role": "admin",
                "is_active": True,
            },
        )
        if admin.role != "admin":
            admin.role = "admin"
            admin.save(update_fields=["role"])

        agent_a, _ = User.objects.get_or_create(
            name="agent_connect_agent_a",
            defaults={
                "full_name": "Agent Connect Agent A",
                "email": "agent_connect_agent_a@example.com",
                "role": "agent",
                "is_active": True,
            },
        )
        if agent_a.role != "agent":
            agent_a.role = "agent"
            agent_a.save(update_fields=["role"])

        agent_b, _ = User.objects.get_or_create(
            name="agent_connect_agent_b",
            defaults={
                "full_name": "Agent Connect Agent B",
                "email": "agent_connect_agent_b@example.com",
                "role": "agent",
                "is_active": True,
            },
        )
        if agent_b.role != "agent":
            agent_b.role = "agent"
            agent_b.save(update_fields=["role"])

        user, _ = User.objects.get_or_create(
            name="agent_connect_user",
            defaults={
                "full_name": "Agent Connect User",
                "email": "agent_connect_user@example.com",
                "role": "user",
                "is_active": True,
            },
        )
        if user.role != "user":
            user.role = "user"
            user.save(update_fields=["role"])

        user.agent = None
        user.save(update_fields=["agent"])

        factory = APIRequestFactory()
        connect_view = AgentConnectView.as_view()

        # Connect by agent_id
        req = factory.post("/api/agents/agent/connect/", {"agent_id": agent_a.id})
        force_authenticate(req, user=user)
        resp = connect_view(req)
        if resp.status_code != 200:
            raise RuntimeError(f"Connect by agent_id failed: {resp.data}")
        user.refresh_from_db()
        if user.agent_id != agent_a.id:
            raise RuntimeError("Agent assignment by id failed")
        self.stdout.write("Connect by agent_id OK")

        # Connect by agent_code (idempotent)
        req = factory.post("/api/agents/agent/connect/", {"agent_code": agent_a.agent_code})
        force_authenticate(req, user=user)
        resp = connect_view(req)
        if resp.status_code != 200:
            raise RuntimeError(f"Connect by agent_code failed: {resp.data}")
        self.stdout.write("Connect by agent_code OK")

        # Switch by user (allow_switch)
        req = factory.post("/api/agents/agent/connect/", {"agent_id": agent_b.id, "allow_switch": True})
        force_authenticate(req, user=user)
        resp = connect_view(req)
        if resp.status_code != 200:
            raise RuntimeError(f"User switch failed: {resp.data}")
        user.refresh_from_db()
        if user.agent_id != agent_b.id:
            raise RuntimeError("User switch did not update agent")
        self.stdout.write("User switch OK")

        # Admin override for another user
        other_user, _ = User.objects.get_or_create(
            name="agent_connect_user_2",
            defaults={
                "full_name": "Agent Connect User 2",
                "email": "agent_connect_user_2@example.com",
                "role": "user",
                "is_active": True,
            },
        )
        other_user.agent = None
        other_user.save(update_fields=["agent"])

        req = factory.post(
            "/api/agents/agent/connect/",
            {"user_id": other_user.id, "agent_id": agent_a.id},
        )
        force_authenticate(req, user=admin)
        resp = connect_view(req)
        if resp.status_code != 200:
            raise RuntimeError(f"Admin override failed: {resp.data}")
        other_user.refresh_from_db()
        if other_user.agent_id != agent_a.id:
            raise RuntimeError("Admin override did not assign agent")
        self.stdout.write("Admin override OK")

        self.stdout.write("== AGENT CONNECT FLOW TEST PASSED ==")
