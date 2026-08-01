# payment/test_purchase_flow.py
import os
import sys
import json
import django
import requests
from decimal import Decimal

# Add project to path
PROJECT_PATH = r"C:\Users\M S I\Desktop\Stark-card_Server\stark_backend"
if PROJECT_PATH not in sys.path:
    sys.path.append(PROJECT_PATH)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "stark_backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.core.cache import cache
from users.models import UserIdentity
from wallets.models import Wallet
from transactions.models import Transaction
from third_party_apis.models import ThirdPartyAPI
from store.models import Section, ExternalProduct, StoreProduct, Product, ProductRequirement

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000/api")

# Test user
USERNAME = os.getenv("TEST_USERNAME", "syriatel_buyer")
PASSWORD = os.getenv("TEST_PASSWORD", "TestPass123!")
EMAIL = os.getenv("TEST_EMAIL", "syriatel.buyer@test.com")

# Product test data
PRODUCT_NAME = os.getenv("TEST_PRODUCT_NAME", "تحويل وحدات سيريتل")
PHONE = os.getenv("TEST_PHONE", "0982416135")
QUANTITY = int(os.getenv("TEST_QUANTITY", "4026"))
PRICE = Decimal(os.getenv("TEST_PRICE", "402.60"))

# API configs (override with env vars if needed)
ALAAEDDING_TOKEN = os.getenv("ALAAEDDING_TOKEN", "CHANGE_ME_ALAAEDDIN_TOKEN")
ALAAEDDING_URL = os.getenv("ALAAEDDING_URL", "https://www.alaaeddin.net/")
STARK_TOKEN = os.getenv("STARK_TOKEN", "CHANGE_ME_STARK_TOKEN")
STARK_URL = os.getenv("STARK_URL", "https://api.stark-card.com/")
STARK_EXTERNAL_ID = os.getenv("STARK_EXTERNAL_ID")
STARK_PRODUCT_NAME = os.getenv("STARK_PRODUCT_NAME", PRODUCT_NAME)
STARK_BASE_PRICE = Decimal(os.getenv("STARK_BASE_PRICE", "0.10"))


def ensure_api_configs():
    print("Setting up API configs...")

    def upsert_api(provider, name, base_url, token, priority, description):
        api_qs = ThirdPartyAPI.objects.filter(provider=provider)
        if api_qs.exists():
            api = api_qs.order_by("id").first()
            api.name = name
            api.base_url = base_url
            api.is_active = True
            api.priority = priority
            api.description = description
            api.set_api_key(token)
            api.save()
            return api

        api = ThirdPartyAPI.objects.create(
            provider=provider,
            name=name,
            base_url=base_url,
            is_active=True,
            priority=priority,
            description=description,
        )
        api.set_api_key(token)
        api.save()
        return api

    alaa = upsert_api(
        provider="alaaeddin",
        name="Alaaeddin Production",
        base_url=ALAAEDDING_URL,
        token=ALAAEDDING_TOKEN,
        priority=2,
        description="Alaaeddin API",
    )

    stark = upsert_api(
        provider="stark-card",
        name="Stark-Card Production",
        base_url=STARK_URL,
        token=STARK_TOKEN,
        priority=1,
        description="Stark-Card API",
    )

    return alaa, stark


def ensure_user():
    print("Setting up test user...")
    User = get_user_model()
    user, created = User.objects.get_or_create(
        name=USERNAME,
        defaults={
            "full_name": "Syriatel Buyer",
            "email": EMAIL,
            "role": "user",
            "is_active": True,
        },
    )

    if created:
        user.set_password(PASSWORD)
        user.save()
    else:
        if not user.check_password(PASSWORD):
            user.set_password(PASSWORD)
            user.save()

    UserIdentity.objects.get_or_create(
        user=user,
        provider="email",
        identifier=user.email or EMAIL,
        defaults={"is_verified": True},
    )
    UserIdentity.objects.filter(user=user).update(is_verified=True)

    return user


def ensure_wallet_balance(user, required_balance=Decimal("1000.00")):
    print("Setting up wallet balance...")
    wallet, _ = Wallet.objects.get_or_create(user=user)

    # Update from transactions first
    wallet.update_balances()

    if wallet.available_balance < required_balance:
        diff = required_balance - wallet.available_balance
        Transaction.objects.create(
            user=user,
            wallet=wallet,
            transaction_type="deposit",
            amount=diff,
            status="approved",
            note="Test deposit for purchase flow",
        )
        wallet.update_balances()
        cache.delete(f"wallet_data_{user.id}")

    wallet.refresh_from_db()
    print(f"Wallet available: {wallet.available_balance} USD")
    return wallet


def ensure_product(stark_api):
    print("Setting up section/external product/store product...")
    section, _ = Section.objects.get_or_create(
        name_en="Mobile Transfers",
        name_ar="تحويلات الجوال",
        defaults={"description": "Mobile balance transfers", "is_active": True},
    )

    def is_int_string(value):
        try:
            int(str(value))
            return True
        except (TypeError, ValueError):
            return False

    def find_external_product():
        qs = ExternalProduct.objects.filter(
            api_config=stark_api,
            is_active=True,
            name__icontains="سيريتل",
        )
        if not qs.exists():
            from third_party_apis.services.api_service import APIService
            sync_result = APIService.sync_products_from_api(stark_api.id)
            print("Synced Stark products:", sync_result)
            qs = ExternalProduct.objects.filter(
                api_config=stark_api,
                is_active=True,
                name__icontains="سيريتل",
            )
        if not qs.exists():
            return None
        # Stark connector expects numeric external_id
        numeric = [p for p in qs if is_int_string(p.external_id)]
        return numeric[0] if numeric else None

    external_product = find_external_product()
    if not external_product and STARK_EXTERNAL_ID:
        if not is_int_string(STARK_EXTERNAL_ID):
            raise RuntimeError("STARK_EXTERNAL_ID must be numeric for Stark-Card purchases.")
        external_product, _ = ExternalProduct.objects.get_or_create(
            api_config=stark_api,
            external_id=str(STARK_EXTERNAL_ID),
            defaults={
                "name": STARK_PRODUCT_NAME,
                "description": STARK_PRODUCT_NAME,
                "base_price": STARK_BASE_PRICE,
                "category": "mobile",
                "required_fields_json": ["phone_number", "quantity"],
                "is_active": True,
            },
        )

    if not external_product:
        raise RuntimeError(
            "No Stark-Card external product found for Syriatel with numeric external_id. "
            "Set STARK_EXTERNAL_ID to a valid numeric product id from Stark-Card."
        )

    base_price = Decimal(str(external_product.base_price or STARK_BASE_PRICE))
    store_price = PRICE

    store_product, _ = StoreProduct.objects.get_or_create(
        section=section,
        external_product=external_product,
        defaults={
            "name": external_product.name,
            "description": external_product.description or external_product.name,
            "price": store_price,
            "is_active": True,
        },
    )

    user_product, _ = Product.objects.get_or_create(
        section=section,
        external_product=external_product,
        defaults={
            "api_config": stark_api,
            "name_en": "Syriatel Units Transfer",
            "name_ar": external_product.name,
            "description_en": external_product.description or "",
            "description_ar": external_product.description or "",
            "product_type": "amount_based",
            "currency": "USD",
            "base_price": base_price,
            "min_amount": Decimal(str(QUANTITY)),
            "max_amount": Decimal(str(QUANTITY)),
            "is_active": True,
        },
    )

    if user_product.requirements.count() == 0:
        ProductRequirement.objects.get_or_create(
            product=user_product,
            field_name="phone_number",
            defaults={"field_type": "phone", "is_required": True, "order": 1},
        )
        ProductRequirement.objects.get_or_create(
            product=user_product,
            field_name="quantity",
            defaults={"field_type": "number", "is_required": True, "order": 2},
        )

    print(f"StoreProduct ID: {store_product.id}")
    return store_product


def login(session):
    print("Logging in...")
    resp = session.post(
        f"{BASE_URL}/users/login/",
        json={"name": USERNAME, "password": PASSWORD},
    )
    print("Login status:", resp.status_code)
    if not resp.ok:
        print(resp.text)
        resp.raise_for_status()
    data = resp.json()
    token = data.get("access")
    if not token:
        raise RuntimeError("Login did not return access token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    return token


def run_flow(store_product):
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", "Accept": "application/json"})

    login(session)

    print("Fetching sections...")
    sections = session.get(f"{BASE_URL}/store/user/sections/")
    print("Sections status:", sections.status_code)
    if sections.ok:
        payload = sections.json()
        print("Sections sample:", payload[:2] if isinstance(payload, list) else payload)
    else:
        print(sections.text)

    print("Searching user products...")
    products = session.get(
        f"{BASE_URL}/store/user/products/",
        params={"search": PRODUCT_NAME},
    )
    print("Products status:", products.status_code)
    if products.ok:
        payload = products.json()
        if isinstance(payload, dict) and "results" in payload:
            print("Products count:", len(payload["results"]))
        elif isinstance(payload, list):
            print("Products count:", len(payload))
        else:
            print("Products payload:", payload)
    else:
        print(products.text)

    print("Checking wallet balance (payment endpoint)...")
    wallet_resp = session.get(f"{BASE_URL}/payment/wallet/balance/")
    print("Wallet status:", wallet_resp.status_code)
    print("Wallet response:", wallet_resp.text)

    print("Sending purchase request...")
    purchase_payload = {
        "store_product_id": store_product.id,
        "user_inputs": {
            "phone_number": PHONE,
            "quantity": QUANTITY,
        },
        "amount": str(PRICE),
    }
    purchase_resp = session.post(
        f"{BASE_URL}/store/user/purchases/",
        json=purchase_payload,
    )

    print("Purchase status:", purchase_resp.status_code)
    print("Purchase response:", purchase_resp.text)


def main():
    alaa, stark = ensure_api_configs()
    user = ensure_user()
    ensure_wallet_balance(user)
    store_product = ensure_product(stark)
    run_flow(store_product)


if __name__ == "__main__":
    main()
