from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User
from wallets.models import Wallet
from transactions.models import Transaction

class AdminDebtReportTests(TestCase):
    def test_debt_report_excludes_pending_debits_and_separates_currencies(self):
        admin=User.objects.create_user(name='debt-admin',role='admin')
        user=User.objects.create_user(name='debt-customer',role='user')
        for currency,balance,reserved in [('USD','-20','-5'),('SYP','-1000','-200')]:
            wallet=Wallet.objects.get(user=user,currency=currency)
            Wallet.objects.filter(pk=wallet.pk).update(available_balance=balance)
            Transaction.objects.create(user=user,wallet=wallet,currency=currency,amount=reserved,transaction_type='purchase',status='pending',amount_usd=0,amount_syp=0)
        client=APIClient();client.force_authenticate(admin)
        response=client.get('/api/finance/reports/financial/',{'period':'daily','date':'2026-10-27'})
        self.assertEqual(response.status_code,200,response.data)
        exposure=response.data['negative_balances_excluding_pending']
        self.assertEqual(Decimal(exposure['amounts']['USD']),Decimal('15'))
        self.assertEqual(Decimal(exposure['amounts']['SYP']),Decimal('800'))
        self.assertEqual(exposure['debtor_count'],1)
        self.assertFalse(exposure['is_confirmed_receivable'])
        self.assertTrue(exposure['excludes_pending_debits'])
        client.force_authenticate(user)
        self.assertEqual(client.get('/api/finance/reports/financial/').status_code,403)
