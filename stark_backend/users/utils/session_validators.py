from rest_framework import serializers
from ..authentication import cleanup_expired_auth_sessions
from ..models import AdminLoginSession

class SessionValidatorMixin:
    """Mixin for validating admin login sessions"""
    
    def validate_session(self, session_token, required_steps=None):
        """Validate admin session with required steps"""
        cleanup_expired_auth_sessions()
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
        return cleanup_expired_auth_sessions(user=user)
