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
    user_data = {
        'name': user.name,
        'email': user.email,
        'phone': user.phone,
        'user_id': user.id
    }
    
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