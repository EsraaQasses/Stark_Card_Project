# third_party_apis/management/commands/sync_alaaeddin_products.py
import logging
from django.core.management.base import BaseCommand
from third_party_apis.services.api_service import APIService
from third_party_apis.models import ThirdPartyAPI

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Sync products from Alaaeddin API to local database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--api-id',
            type=int,
            help='Specific API configuration ID to sync',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force sync even if API is not active',
        )

    def handle(self, *args, **options):
        api_id = options.get('api_id')
        force = options.get('force', False)
        
        try:
            if api_id:
                # Sync specific API
                api_configs = ThirdPartyAPI.objects.filter(id=api_id)
            else:
                # Sync all active Alaaeddin APIs
                api_configs = ThirdPartyAPI.objects.filter(provider='alaaeddin', is_active=True)
                if not api_configs.exists() and force:
                    api_configs = ThirdPartyAPI.objects.filter(provider='alaaeddin')
            
            if not api_configs.exists():
                self.stdout.write(
                    self.style.WARNING('No Alaaeddin API configurations found')
                )
                return
            
            total_synced = 0
            total_updated = 0
            
            for api_config in api_configs:
                if not api_config.is_active and not force:
                    self.stdout.write(
                        self.style.WARNING(f'Skipping inactive API: {api_config.name}')
                    )
                    continue
                
                self.stdout.write(f'Syncing products from: {api_config.name}')
                
                result = APIService.sync_products_from_api(api_config.id)
                
                if result['success']:
                    synced = result['synced_count']
                    updated = result['updated_count']
                    total_synced += synced
                    total_updated += updated
                    
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  ✅ Synced: {synced} new, {updated} updated '
                            f'({result["active_products"]}/{result["total_products"]} active)'
                        )
                    )
                else:
                    self.stdout.write(
                        self.style.ERROR(f'  ❌ Failed: {result["error"]}')
                    )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'🎉 Sync completed! Total: {total_synced} new, {total_updated} updated'
                )
            )
            
        except Exception as e:
            logger.error(f"Product sync command failed: {e}")
            self.stdout.write(
                self.style.ERROR(f'Sync failed: {e}')
            )