from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
import uuid

from users.models import User
from wallets.models import Wallet
from transactions.models import Transaction
from third_party_apis.models import ThirdPartyAPI
from third_party_apis.utils.connectors import ConnectorFactory

PLAYER_ID = '52084028929'
TARGET_TOPUP_USD = Decimal('100.00')


class Command(BaseCommand):
    help = 'Top up rania wallet and purchase PUBG 300 UC via Stark-Card API'

    def add_arguments(self, parser):
        parser.add_argument('--topup', type=str, help='Top-up amount in USD (default 100.00)')
        parser.add_argument('--player', type=str, help='PUBG Player ID (default preset)')

    def handle(self, *args, **options):
        topup = Decimal(options['topup']) if options.get('topup') else TARGET_TOPUP_USD
        player = options.get('player') or PLAYER_ID

        # 1) Find user 'rania'
        user = User.objects.filter(name='rania').first()
        if not user:
            self.stderr.write('❌ User "rania" not found')
            return

        # 2) Ensure wallet exists and top-up deposit
        wallet, _ = Wallet.objects.get_or_create(user=user)
        Transaction.objects.create(
            user=user,
            wallet=wallet,
            transaction_type='deposit',
            amount=topup,
            status='approved',
            note=f'Auto top-up for PUBG purchase test {timezone.now().isoformat()}'
        )
        wallet.update_balances()
        self.stdout.write(f'✅ Wallet: available={wallet.available_balance} pending={wallet.pending_balance}')

        # 3) Get stark-card API connector
        api = ThirdPartyAPI.objects.filter(provider='stark-card', is_active=True).first()
        if not api:
            self.stderr.write('❌ No active stark-card API configured')
            return

        connector = ConnectorFactory.get_connector(api)
        bal = connector.get_balance()
        self.stdout.write(f'ℹ️ Stark-Card balance response: {bal}')

        products = connector.get_products()
        self.stdout.write(f'ℹ️ Stark-Card products: {len(products)}')
        if not products:
            self.stderr.write('❌ No products returned')
            return

        # 4) Select PUBG 300 UC product
        def norm(s):
            return (s or '').lower()

        # Build list of PUBG candidates
        pubg_list = [p for p in products if ('pubg' in norm(p.get('name')) or 'ببجي' in norm(p.get('name')) or 'uc' in norm(p.get('name')))]
        if not pubg_list:
            self.stderr.write('❌ No PUBG/UC products found')
            return

        # Prefer product with '300' in name
        candidates = [p for p in pubg_list if '300' in norm(p.get('name'))]
        # If none, extend by any product whose quantity rules include 300
        for p in pubg_list:
            if p in candidates:
                continue
            rules = p.get('quantity_rules') or {}
            if rules.get('type') == 'specific':
                vals = rules.get('values') or []
                for v in vals:
                    try:
                        if int(v) == 300:
                            candidates.append(p)
                            break
                    except Exception:
                        continue
            elif rules.get('type') == 'range':
                mn = rules.get('min', 1)
                mx = rules.get('max', 1)
                if mn <= 300 <= mx:
                    candidates.append(p)
        # Fallback to full pubg list
        if not candidates:
            candidates = pubg_list

        attempt = 0
        for product in candidates:
            attempt += 1
            self.stdout.write(f'🎯 Attempt {attempt}: {product.get("name")} | external_id: {product.get("external_id")}')

            # Choose quantity
            rules = product.get('quantity_rules') or {}
            qty = 1
            qtype = rules.get('type')
            if qtype == 'specific':
                vals = rules.get('values') or []
                found = None
                for v in vals:
                    try:
                        if int(v) == 300:
                            found = v
                            break
                    except Exception:
                        continue
                qty = found if found is not None else (vals[0] if vals else 1)
            elif qtype == 'range':
                mn = rules.get('min', 1)
                mx = rules.get('max', 1)
                qty = 300 if mn <= 300 <= mx else mn
            else:
                qty = rules.get('value', 1)
            self.stdout.write(f'🧮 Chosen quantity: {qty}')

            # Build user inputs
            user_inputs = {}
            for f in product.get('required_fields') or []:
                fname = f.get('field_name') or ''
                lname = fname.lower()
                if 'player' in lname or 'id' in lname:
                    user_inputs[fname] = player
                elif 'phone' in lname or 'رقم الهاتف' in lname:
                    user_inputs[fname] = player
                elif 'username' in lname or 'user' in lname:
                    user_inputs[fname] = player
                else:
                    user_inputs[fname] = player
            self.stdout.write(f'📝 User inputs: {user_inputs}')

            # Execute purchase
            payload = {
                'external_id': product.get('external_id'),
                'quantity': qty,
                'user_inputs': user_inputs
            }

            self.stdout.write('🚀 Executing Stark-Card purchase ...')
            res = connector.execute_purchase(payload, user_data={'user_id': user.id}, transaction_data={'order_uuid': str(uuid.uuid4())})
            self.stdout.write(f'🧾 Purchase response: {res}')

            if res.get('success'):
                try:
                    amount = Decimal(str(product.get('base_price') or '0'))
                    tx = Transaction.objects.create(
                        user=user,
                        wallet=wallet,
                        transaction_type='purchase',
                        amount=-amount,
                        status='approved',
                        note=f'PUBG 300 UC purchase via Stark-Card | order_uuid={res.get("order_uuid")}'
                    )
                    wallet.update_balances()
                    self.stdout.write(f'✅ Recorded purchase tx id={tx.id}. Wallet available now={wallet.available_balance}')
                except Exception as e:
                    self.stderr.write(f'⚠️ Failed to record purchase transaction: {e}')
                break
        else:
            self.stderr.write('❌ All PUBG candidates failed to purchase')
