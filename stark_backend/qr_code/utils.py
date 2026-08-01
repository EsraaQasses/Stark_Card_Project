import qrcode
from io import BytesIO
from django.core.files import File
from django.conf import settings
import json

def generate_user_qr_code(user):
    """
    Generate QR code containing user information
    """
    # Prepare user data for QR code
    # Wallet IDs help transfers by wallet or phone.
    wallet_id = None
    wallet_ids = {}
    try:
        from wallets.models import Wallet
        wallets = Wallet.objects.filter(user=user)
        for w in wallets:
            wallet_ids[w.currency.lower()] = w.id
        wallet_id = wallet_ids.get("syp") or wallet_ids.get("usd")
    except Exception:
        wallet_ids = {}
        wallet_id = None

    user_data = {
        'name': user.name,
        'email': user.email,
        'phone': user.phone,
        'user_id': user.id,
        'wallet_id': wallet_id,
        'wallet_ids': wallet_ids,
    }
    if getattr(user, "role", None) == "agent":
        if not user.agent_code:
            try:
                from users.utils import generate_agent_code
                user.agent_code = generate_agent_code()
                user.save(update_fields=["agent_code"])
            except Exception:
                pass
        user_data["agent_code"] = user.agent_code
    
    # Convert to JSON string
    qr_data = json.dumps(user_data, ensure_ascii=False)
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    # Create QR code image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to BytesIO buffer
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    
    return buffer, qr_data
