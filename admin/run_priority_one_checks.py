"""Run Django checks and regression tests only against an in-memory database."""
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2] / 'Stark_Card_Project-backend-v2' / 'stark_backend'
sys.path.insert(0, str(root))
os.environ['DJANGO_ENV'] = 'test'
os.environ['USE_SQLITE'] = '1'
os.environ['PENDING_PURCHASE_POLL_ENABLED'] = 'false'
os.environ['DJANGO_SETTINGS_MODULE'] = 'stark_backend.settings'
from django.conf import settings
settings.DATABASES['default']['NAME'] = ':memory:'
settings.DATABASES['default']['TEST'] = {'NAME': ':memory:'}
settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
settings.CELERY_TASK_ALWAYS_EAGER = False
import django
django.setup()
from django.core.management import call_command
call_command('check')
call_command('makemigrations', check=True, dry_run=True)
from django.test.runner import DiscoverRunner
runner = DiscoverRunner(verbosity=2, interactive=False)
failures = runner.run_tests(sys.argv[1:] or [
    'test_priority_one', 'shipping.test_listing_contract',
    'users.tests.test_customer_admin', 'users.tests.test_category_audit_atomicity',
])
raise SystemExit(bool(failures))
