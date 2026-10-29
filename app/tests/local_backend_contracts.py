"""Exercise the real local Django auth/read contracts against an in-memory test DB.
No backend files, existing databases, live providers, or running server are used.
Usage: <backend venv python> -B tests/local_backend_contracts.py --backend <backend root>
"""
import argparse
import contextlib
import importlib
import io
import json
import logging
import os
from pathlib import Path
import secrets
import socket
import sys
import tempfile
import types
from unittest.mock import patch


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend', required=True)
    args = parser.parse_args()
    backend = Path(args.backend).resolve()
    if not (backend / 'manage.py').is_file():
        raise RuntimeError('Expected an explicit local Django project directory')
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(backend))
    # Independent generated test values; no real dotenv credentials or SMTP are used.
    os.environ.update({
        'DJANGO_ENV': 'test', 'USE_SQLITE': 'true', 'DEBUG': 'false',
        'SECRET_KEY': secrets.token_urlsafe(64),
        'THIRD_PARTY_API_FERNET_KEY': __import__('base64').urlsafe_b64encode(secrets.token_bytes(32)).decode(),
        'EMAIL_BACKEND': 'django.core.mail.backends.locmem.EmailBackend',
        'EMAIL_HOST_USER': '', 'EMAIL_HOST_PASSWORD': '', 'EXPO_ACCESS_TOKEN': '',
        'ALLOWED_HOSTS': 'testserver,localhost,127.0.0.1',
    })
    logging.disable(logging.CRITICAL)
    captured = io.StringIO()
    results = []
    def require(condition, name):
        if not condition:
            raise AssertionError(name)
        results.append({'test': name, 'status': 'passed'})
    def deny_network(*_args, **_kwargs):
        raise RuntimeError('Outbound networking is disabled in isolated contract tests')
    with tempfile.TemporaryDirectory(prefix='stark-mobile-contracts-') as scratch:
        with contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured), patch.object(socket.socket, 'connect', deny_network):
            base = importlib.import_module('stark_backend.settings')
            isolated = types.ModuleType('mobile_isolated_settings')
            for name in dir(base):
                if name.isupper():
                    setattr(isolated, name, getattr(base, name))
            isolated.DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
            isolated.CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
            isolated.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
            isolated.MEDIA_ROOT = scratch
            isolated.LOGGING = {'version': 1, 'disable_existing_loggers': True}
            isolated.PASSWORD_HASHERS = ['django.contrib.auth.hashers.PBKDF2PasswordHasher']
            sys.modules['mobile_isolated_settings'] = isolated
            os.environ['DJANGO_SETTINGS_MODULE'] = 'mobile_isolated_settings'
            import django
            django.setup()
            from django.conf import settings
            from django.core.management import call_command
            from django.db import connection
            from django.contrib.auth import get_user_model
            from rest_framework.test import APIClient
            require(settings.DATABASES['default']['NAME'] == ':memory:', 'memory database enforced before migrations')
            call_command('migrate', interactive=False, verbosity=0)
            require(connection.settings_dict['NAME'] == ':memory:', 'migration connection remains isolated')
            User = get_user_model()
            from users.models import UserIdentity
            for role in ['user', 'agent']:
                password = secrets.token_urlsafe(24)
                name = 'mobile_isolated_' + role
                user = User.objects.create_user(name=name, password=password, role=role, full_name='Isolated Mobile Test')
                UserIdentity.objects.create(user=user, provider='email', identifier=name+'@example.invalid', is_verified=True)
                client = APIClient()
                response = client.post('/api/users/login/', {'name': name, 'password': password}, format='json', secure=True)
                require(response.status_code == 200, role + ': real password login view HTTP ' + str(response.status_code))
                payload = response.json()
                require(bool(payload.get('access') and payload.get('refresh')), role + ': JWT pair returned')
                client.credentials(HTTP_AUTHORIZATION='Bearer ' + payload['access'])
                me = client.get('/api/users/me/', secure=True)
                require(me.status_code == 200, role + ': authenticated profile read')
                require(me.json().get('id') == user.id, role + ': profile belongs to signed-in account')
                history = client.get('/api/payment/payment/', secure=True)
                require(history.status_code == 200, role + ': authenticated history read')
                records = history.json()
                require(records == [] or records.get('results') == [], role + ': new account sees no other payments')
                refresh = APIClient().post('/api/users/token/refresh/', {'refresh': payload['refresh']}, format='json', secure=True)
                require(refresh.status_code == 200 and bool(refresh.json().get('access')), role + ': real token refresh')
                if role == 'user':
                    from decimal import Decimal
                    from users.models import CustomerCategory
                    from store.models import Section, Product
                    section = Section.objects.create(name_en='Isolated', name_ar='اختبار')
                    for currency in ['USD', 'SYP']:
                        product = Product.objects.create(section=section, name_en='Isolated '+currency, name_ar='اختبار',
                            product_type='amount_based', currency=currency, base_price=Decimal('10'),
                            min_amount=Decimal('1'), max_amount=Decimal('100'))
                        observed = []
                        for percent in ['10', '20']:
                            category, _ = CustomerCategory.objects.get_or_create(name='isolated-'+percent,
                                defaults={'display_name':'Isolated', 'profit_percentage':Decimal(percent)})
                            user.category = category
                            user.save(update_fields=['category'])
                            price = client.get(f'/api/store/user/products/{product.id}/price_calculator/',
                                {'amount':'1', 'wallet_currency':currency}, secure=True)
                            require(price.status_code == 200, currency+': real backend category calculator '+percent)
                            observed.append(Decimal(str(price.json()['wallet_user_final_price'])))
                        require(observed[1] > observed[0], currency+': refreshed price follows changed customer category')
                rejected = APIClient().post('/api/users/login/', {'name': name, 'password': 'wrong-test-password'}, format='json', secure=True)
                require(rejected.status_code in [400, 401], role + ': incorrect password rejected')
            unauthenticated = APIClient().get('/api/payment/payment/', secure=True)
            require(unauthenticated.status_code == 401, 'unauthenticated history access rejected')
            connection.close()
    report = {'date': '2026-10-30', 'mode': 'real_django_views_in_process', 'database': 'sqlite_memory',
              'external_network': 'disabled', 'device_test': False, 'tests': results, 'passed': len(results)}
    output = Path(__file__).resolve().parent / 'local-backend-results.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'passed': len(results), 'mode': report['mode'], 'report': str(output)}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not print settings, passwords, token responses, or captured server logs.
        print(json.dumps({'status': 'failed', 'type': type(error).__name__, 'reason': str(error)[:300]}))
        raise SystemExit(1)
