from django.apps import AppConfig

class ThirdPartyApisConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'third_party_apis'
    verbose_name = 'Third Party APIs'
    
    def ready(self):
        try:
            from . import signals
        except ImportError:
            pass
        
        # Start background worker for async task processing
        try:
            from .tasks import start_background_worker
            start_background_worker()
        except Exception as e:
            import logging
            logging.warning(f"Could not start background worker: {e}")

        # Start pending purchase polling scheduler
        try:
            from .tasks import start_pending_purchase_scheduler
            start_pending_purchase_scheduler()
        except Exception as e:
            import logging
            logging.warning(f"Could not start pending purchase scheduler: {e}")
