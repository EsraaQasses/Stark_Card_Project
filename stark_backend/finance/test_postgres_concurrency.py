from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest import skipUnless

from django.db import close_old_connections, connection, connections
from django.test import TransactionTestCase

from finance.services import FinanceService, IdempotencyConflict
from transactions.models import Transaction
from users.models import User
from wallets.models import Wallet


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locks')
class PostgreSQLFinancialRaceTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(name='pg-race-user')
        self.wallet = Wallet.objects.get(user=self.user, currency='USD')
        self.wallet.available_balance = Decimal('100')
        self.wallet.save(update_fields=['available_balance'])

    def race(self, callback):
        barrier = Barrier(2)
        def worker(index):
            close_old_connections()
            try:
                with connections['default'].cursor() as cursor:
                    cursor.execute("SET lock_timeout = '10s'")
                barrier.wait(timeout=10)
                return callback(index)
            finally:
                connections['default'].close()
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(worker, index) for index in range(2)]
            return [future.result(timeout=25) for future in futures]

    def test_same_key_concurrent_withdrawal_reserves_once(self):
        ids = self.race(lambda index: FinanceService.withdraw(
            wallet_id=self.wallet.pk, amount='20', idempotency_key='race-withdraw').pk)
        self.assertEqual(ids[0], ids[1])
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, 80)
        self.assertEqual(self.wallet.pending_balance, 20)

    def test_concurrent_full_refunds_with_different_keys_credit_once(self):
        debit = FinanceService.withdraw(wallet_id=self.wallet.pk, amount='20', idempotency_key='original')
        FinanceService.approve(debit.pk)
        ids = self.race(lambda index: FinanceService.refund(
            transaction_id=debit.pk, idempotency_key=f'refund-race-{index}').pk)
        self.assertEqual(ids[0], ids[1])
        self.race(lambda index: FinanceService.approve(ids[0]).pk)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, 100)
        self.assertEqual(self.wallet.pending_balance, 0)
        self.assertEqual(Transaction.objects.filter(transaction_type='refund').count(), 1)

    def test_refund_key_cannot_replay_another_debit(self):
        a = FinanceService.withdraw(wallet_id=self.wallet.pk, amount='10', idempotency_key='a')
        b = FinanceService.withdraw(wallet_id=self.wallet.pk, amount='10', idempotency_key='b')
        FinanceService.approve(a.pk)
        FinanceService.approve(b.pk)
        FinanceService.refund(transaction_id=a.pk, idempotency_key='shared-refund')
        with self.assertRaises(IdempotencyConflict):
            FinanceService.refund(transaction_id=b.pk, idempotency_key='shared-refund')

    def test_opposing_transfers_lock_wallets_in_same_order(self):
        other = User.objects.create_user(name='pg-race-other')
        wallet = Wallet.objects.get(user=other, currency='USD')
        wallet.available_balance = 100
        wallet.save(update_fields=['available_balance'])
        def transfer(index):
            a, b = (self.wallet.pk, wallet.pk) if index == 0 else (wallet.pk, self.wallet.pk)
            return FinanceService.transfer(sender_wallet_id=a, recipient_wallet_id=b, amount='10',
                                           idempotency_key=f'opposing-{index}').pk
        self.race(transfer)
        self.wallet.refresh_from_db()
        wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, 100)
        self.assertEqual(wallet.available_balance, 100)
