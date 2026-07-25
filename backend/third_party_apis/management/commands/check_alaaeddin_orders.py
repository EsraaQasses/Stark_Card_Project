# third_party_apis/management/commands/check_alaaeddin_orders.py
import logging
from django.core.management.base import BaseCommand
from third_party_apis.services.api_service import APIService
from third_party_apis.models import ThirdPartyAPI, APITransaction
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Check and update status of pending Alaaeddin orders'

    def add_arguments(self, parser):
        parser.add_argument(
            '--hours',
            type=int,
            default=24,
            help='Check orders from last N hours (default: 24)',
        )
        parser.add_argument(
            '--api-id',
            type=int,
            help='Specific API configuration ID to check',
        )

    def handle(self, *args, **options):
        hours = options['hours']
        api_id = options.get('api_id')
        
        try:
            # Get transactions from the last N hours
            since_time = timezone.now() - timedelta(hours=hours)
            
            if api_id:
                transactions = APITransaction.objects.filter(
                    api_config_id=api_id,
                    created_at__gte=since_time,
                    endpoint_used='/api/purchase'
                )
            else:
                transactions = APITransaction.objects.filter(
                    api_config__provider='alaaeddin',
                    created_at__gte=since_time,
                    endpoint_used='/api/purchase'
                )
            
            self.stdout.write(f'Checking {transactions.count()} purchase transactions from last {hours} hours')
            
            updated_count = 0
            error_count = 0
            
            for transaction in transactions:
                external_order_id = transaction.external_transaction_id
                if not external_order_id:
                    continue
                
                self.stdout.write(f'Checking order: {external_order_id}')
                
                result = APIService.update_order_status(
                    transaction.api_config_id, 
                    external_order_id
                )
                
                if result['success']:
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'  ✅ Updated: {external_order_id}')
                    )
                else:
                    error_count += 1
                    self.stdout.write(
                        self.style.WARNING(f'  ⚠️ Failed: {external_order_id} - {result["error"]}')
                    )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'🎉 Order status check completed! Updated: {updated_count}, Errors: {error_count}'
                )
            )
            
        except Exception as e:
            logger.error(f"Order status check failed: {e}")
            self.stdout.write(
                self.style.ERROR(f'Order check failed: {e}')
            )