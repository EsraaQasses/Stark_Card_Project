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