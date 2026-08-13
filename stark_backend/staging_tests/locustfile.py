import os

from locust import HttpUser, between, task


class StarkApiUser(HttpUser):
    wait_time = between(1, 3)
    host = os.getenv("STARK_STAGING_URL", "http://127.0.0.1:8000")

    @task(3)
    def schema(self):
        self.client.get("/api/schema/", name="GET /api/schema/")

    @task(1)
    def wallets(self):
        token = os.getenv("STARK_ACCESS_TOKEN")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self.client.get("/api/wallets/", headers=headers, name="GET /api/wallets/")
