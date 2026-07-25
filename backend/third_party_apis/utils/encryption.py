import os
import logging
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger(__name__)

class EncryptionHelper:
    def __init__(self):
        self.fernet = None
        self._initialize_fernet()
    
    def _initialize_fernet(self):
        """Initialize Fernet with the key from settings"""
        try:
            self.fernet_key = getattr(settings, 'THIRD_PARTY_API_FERNET_KEY', None)
            if not self.fernet_key:
                logger.error("THIRD_PARTY_API_FERNET_KEY not found in settings")
                return
            
            # Validate key format
            if len(self.fernet_key) != 44:
                logger.error(f"Fernet key must be 44 characters, got {len(self.fernet_key)}")
                return
                
            self.fernet = Fernet(self.fernet_key.encode())
            logger.info("Fernet encryption initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Fernet: {e}")
            self.fernet = None

    def encrypt_text(self, text):
        """Encrypt text, return None if encryption fails"""
        if text is None or self.fernet is None:
            return None
        try:
            encrypted_bytes = self.fernet.encrypt(text.encode())
            return encrypted_bytes.decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return None

    def decrypt_text(self, encrypted_text):
        """Decrypt text, return None if decryption fails"""
        if encrypted_text is None or self.fernet is None:
            return None
        try:
            decrypted_bytes = self.fernet.decrypt(encrypted_text.encode())
            return decrypted_bytes.decode()
        except InvalidToken:
            logger.error("Decryption failed: Invalid token (wrong key?)")
            return None
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return None

# Use lazy initialization
_encryption_helper = None

def get_encryption_helper():
    global _encryption_helper
    if _encryption_helper is None:
        _encryption_helper = EncryptionHelper()
    return _encryption_helper

def encrypt_text(text):
    return get_encryption_helper().encrypt_text(text)

def decrypt_text(encrypted_text):
    return get_encryption_helper().decrypt_text(encrypted_text)
