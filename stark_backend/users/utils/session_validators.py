from rest_framework import serializers
from django.utils import timezone
from ..models import AdminLoginSession

class SessionValidatorMixin:
    """Mixin for validating admin login sessions"""
    
    def validate_session(self, session_token, required_steps=None):
        """Validate admin session with required steps"""
        try:
            session = AdminLoginSession.objects.get(session_token=session_token)
            
            if session.is_expired():
                session.delete()
                raise serializers.ValidationError("Session expired")
            
            if required_steps:
                for step in required_steps:
                    step_field = f"step_{step}_completed"
                    if not getattr(session, step_field, False):
                        raise serializers.ValidationError(f"Step {step} not completed")
            
            return session
        except AdminLoginSession.DoesNotExist:
            raise serializers.ValidationError("Invalid session")
            
    def cleanup_expired_sessions(self, user=None):
        """Clean up expired sessions"""
        query = AdminLoginSession.objects.filter(expires_at__lt=timezone.now())
        if user:
            query = query.filter(user=user)
        deleted_count = query.delete()[0]
        return deleted_count