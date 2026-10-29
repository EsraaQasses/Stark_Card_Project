"""Loopback-only fixture server backed by a new isolated temporary database."""
import json
import os
import sys
import tempfile
from datetime import timedelta
from pathlib import Path

root = Path(__file__).resolve().parents[2] / 'Stark_Card_Project-backend-v2' / 'stark_backend'
sys.path.insert(0, str(root))
os.environ.update(DJANGO_ENV='test', USE_SQLITE='1', PENDING_PURCHASE_POLL_ENABLED='false', DJANGO_SETTINGS_MODULE='stark_backend.settings')
from django.conf import settings
scratch = Path(tempfile.mkdtemp(prefix='stark-profit-matrix-'))
settings.DATABASES['default']['NAME'] = str(scratch/'isolated.sqlite3')
settings.MEDIA_ROOT = str(scratch/'media')
settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
settings.CELERY_TASK_ALWAYS_EAGER = False
settings.CORS_ALLOW_ALL_ORIGINS = True
settings.SECURE_SSL_REDIRECT = False
for handler in settings.LOGGING.get('handlers', {}).values():
    if 'filename' in handler:
        handler['filename'] = str(scratch/Path(handler['filename']).name)
import django
django.setup()
from django.core.management import call_command
call_command('migrate', verbosity=0)
from users.authentication import issue_tokens
from users.models import User, CustomerCategory
from store.models import Product, Section, ExternalProduct
from third_party_apis.models import ThirdPartyAPI
admin = User.objects.create_superuser(name='profit-matrix-admin', email='matrix@example.test', password='Isolated-fixture-only-9!')
for name, display, rate, active in [('retail','زبون','10',True),('wholesale','جملة','1',True),('vip','VIP','0.25',True),('inactive','قديمة','2',False)]:
    CustomerCategory.objects.create(name=name, display_name=display, profit_percentage=rate, is_active=active)
sections = [Section.objects.create(name_en='Cards', name_ar='بطاقات'), Section.objects.create(name_en='Games', name_ar='ألعاب')]
providers = [ThirdPartyAPI.objects.create(name='Fixture active provider', provider='stark-card', base_url='https://provider.invalid', is_active=True), ThirdPartyAPI.objects.create(name='Fixture disabled provider', provider='stark-card', base_url='https://disabled.invalid', is_active=False)]
external = ExternalProduct.objects.create(api_config=providers[1], external_id='matrix-disabled', name='Fixture disabled external', base_price=1, is_active=False, administrator_disabled=True)
for index in range(1, 33):
    Product.objects.create(name_en=f'Matrix product {index:03d}', name_ar=f'منتج {index:03d}', section=sections[index % 2],
        api_config=providers[index % 2], external_product=external if index == 1 else None,
        product_type='amount_based', currency='USD' if index % 2 else 'SYP', base_price='2.50',
        min_amount=1, max_amount=100, product_profit_percentage='3.50', is_active=index % 3 != 0)
refresh, access = issue_tokens(admin)
access.set_exp(lifetime=timedelta(hours=2))
state = {'cookies': [], 'origins': [{'origin':'http://127.0.0.1:5179','localStorage':[
    {'name':'access_token','value':str(access)}, {'name':'refresh_token','value':str(refresh)},
    {'name':'user','value':json.dumps({'id':admin.pk,'name':admin.name,'role':'admin'})}, {'name':'i18nextLng','value':'en'},
]}]}
Path('profit-matrix-browser-state.json').write_text(json.dumps(state), encoding='utf-8')
print('ISOLATED_FIXTURE='+str(scratch), flush=True)
from django.core.wsgi import get_wsgi_application
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, WSGIRequestHandler, make_server
class ThreadedServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True
class QuietHandler(WSGIRequestHandler):
    def log_message(self, *args):
        pass
make_server('127.0.0.1',8018,get_wsgi_application(),server_class=ThreadedServer,handler_class=QuietHandler).serve_forever()
