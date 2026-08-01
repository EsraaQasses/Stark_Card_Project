# users/services/role_service.py - COMPLETE FIXED VERSION
from decimal import Decimal
from django.core.exceptions import ValidationError
import logging

# Import from your app
from ..models import User, AdminSecurity
from wallets.models import Wallet
from agents.models import AgentProfile
from ..utils.audit_logger import AuditLogger
from ..utils import generate_agent_code  # Import generate_agent_code

logger = logging.getLogger(__name__)

class RoleService:
    @staticmethod
    def promote_to_agent(user, promoted_by=None):
        """Promote user to agent"""
        if user.role == "admin":
            raise ValidationError("Cannot demote admin to agent")
        
        if user.role == "agent":
            # Already agent, just ensure agent profile exists
            AgentProfile.objects.get_or_create(user=user)
            return user, False
        
        # Store original role
        original_role = user.role
        
        # Update role
        user.role = "agent"
        user.is_staff = False
        user.is_superuser = False
        # Ensure agents are never connected to another agent
        user.agent = None
        
        # Generate agent code if not exists
        if not user.agent_code:
            user.agent_code = generate_agent_code()
        
        user.save()
        
        # Create/update agent profile
        agent_profile, created = AgentProfile.objects.get_or_create(user=user)
        if created or not agent_profile.commission_rate:
            agent_profile.commission_rate = Decimal('0.00')
            agent_profile.total_earnings = Decimal('0.00')
            agent_profile.total_earnings_usd = Decimal('0.00')
            agent_profile.total_earnings_syp = Decimal('0.00')
            agent_profile.save()
        
        # ✅ FIX: Wallet is already created by User.save() signal
        # Just ensure it exists and update balances
        wallet, _ = Wallet.objects.get_or_create(user=user)
        wallet.update_balances()
        
        # Audit log
        AuditLogger.log(
            request=None,
            action='ROLE_CHANGE',
            resource_type='user',
            resource_id=user.id,
            details={
                'from_role': original_role,
                'to_role': 'agent',
                'agent_code': user.agent_code,
                'promoted_by': promoted_by.id if promoted_by else None
            }
        )
        
        logger.info(f"User {user.name} promoted to agent with code {user.agent_code}")
        return user, True
    
    @staticmethod
    def promote_to_admin(user, promoted_by=None, make_superuser=True):
        """Promote user to admin"""
        if user.role == "admin":
            # Already admin, just ensure admin security exists
            AdminSecurity.objects.get_or_create(user=user)
            return user, False
        
        if user.is_banned:
            raise ValidationError("Cannot promote banned user to admin")
        
        # Store original role
        original_role = user.role
        
        # Update role
        user.role = "admin"
        user.is_staff = True
        user.is_superuser = make_superuser
        user.save()
        
        # Create admin security
        admin_security, created = AdminSecurity.objects.get_or_create(user=user)
        
        # ✅ FIX: Ensure wallet exists for admin
        wallet, _ = Wallet.objects.get_or_create(user=user)
        wallet.update_balances()
        
        # Audit log
        AuditLogger.log(
            request=None,
            action='ROLE_CHANGE',
            resource_type='user',
            resource_id=user.id,
            details={
                'from_role': original_role,
                'to_role': 'admin',
                'is_staff': True,
                'is_superuser': make_superuser,
                'promoted_by': promoted_by.id if promoted_by else None
            }
        )
        
        logger.info(f"User {user.name} promoted to admin")
        return user, True
    
    @staticmethod
    def demote_to_user(user, demoted_by=None):
        """Demote agent or admin to regular user"""
        if user.role == "user":
            return user, False
        
        original_role = user.role
        
        # Update role
        user.role = "user"
        user.is_staff = False
        user.is_superuser = False
        
        if original_role == "agent":
            user.agent_code = None
            # Agent profile will be deleted separately if needed
        elif original_role == "admin":
            # Admin security remains but user is no longer admin
            pass
        
        user.save()
        
        # ✅ FIX: Wallet remains unchanged (still exists)
        wallet, _ = Wallet.objects.get_or_create(user=user)
        wallet.update_balances()
        
        # Audit log
        AuditLogger.log(
            request=None,
            action='ROLE_CHANGE',
            resource_type='user',
            resource_id=user.id,
            details={
                'from_role': original_role,
                'to_role': 'user',
                'demoted_by': demoted_by.id if demoted_by else None
            }
        )
        
        logger.info(f"User {user.name} demoted from {original_role} to user")
        return user, True
