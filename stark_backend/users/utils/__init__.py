# users/utils/__init__.py
from .audit_logger import AuditLogger
from .email_service import EmailService
from .session_validators import SessionValidatorMixin

def generate_agent_code():
    """Generate a unique agent code"""
    import random
    import string
    from ..models import User
    while True:
        code = "AGT-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not User.objects.filter(agent_code=code).exists():
            return code

__all__ = ['AuditLogger', 'EmailService', 'SessionValidatorMixin', 'generate_agent_code']