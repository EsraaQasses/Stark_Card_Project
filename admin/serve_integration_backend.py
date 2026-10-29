"""Serve the adjacent backend with disposable test data, never its local DB."""
import json
import os
import sys
import tempfile
from pathlib import Path
root = Path(__file__).resolve().parents[2] / 'Stark_Card_Project-backend-v2' / 'stark_backend'
sys.path.insert(0, str(root))
os.environ.update(DJANGO_ENV='test', USE_SQLITE='1', PENDING_PURCHASE_POLL_ENABLED='false', DJANGO_SETTINGS_MODULE='stark_backend.settings')
from django.conf import settings
scratch = next(Path(tempfile.gettempdir()).glob('stark-admin-integration-*/session.json')).parent if '--reuse' in sys.argv else Path(tempfile.mkdtemp(prefix='stark-admin-integration-'))
settings.DATABASES['default']['NAME'] = str(scratch / 'isolated.sqlite3')
settings.MEDIA_ROOT = str(scratch / 'media')
settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
settings.CELERY_TASK_ALWAYS_EAGER = False
settings.CORS_ALLOW_ALL_ORIGINS = True
settings.SECURE_SSL_REDIRECT = False
for handler in settings.LOGGING.get('handlers', {}).values():
    if 'filename' in handler:
        handler['filename'] = str(scratch / Path(handler['filename']).name)
import django
django.setup()
from django.core.management import call_command
call_command('migrate', verbosity=0)
from users.models import User
from wallets.models import Wallet
from shipping.models import StandardShippingRequest, AgentAdminShippingRequest
from rest_framework_simplejwt.tokens import RefreshToken
admin = User.objects.filter(name='integration-admin').first() or User.objects.create_superuser(name='integration-admin', email='integration@example.test', password='Local-test-only-9!')
user = User.objects.filter(name='integration-customer').first() or User.objects.create_user(name='integration-customer', role='user')
agent = User.objects.filter(name='integration-agent').first() or User.objects.create_user(name='integration-agent', role='agent')
for currency, amount in [('USD', '12.34'), ('SYP', '5000')]:
    StandardShippingRequest.objects.get_or_create(user=user, amount=amount, currency=currency, wallet_currency=currency)
    AgentAdminShippingRequest.objects.get_or_create(agent=agent, amount=amount, currency=currency, wallet_currency=currency)
from users.models import CustomerCategory
CustomerCategory.objects.get_or_create(name='integration-category', display_name='Integration category', profit_percentage='5')
from users.authentication import issue_tokens
token, access = issue_tokens(admin)
session = {'access': str(access), 'refresh': str(token), 'user': {'id': admin.pk, 'name': admin.name, 'role': 'admin'}, 'customer_id': user.pk, 'scratch': str(scratch)}
(scratch / 'session.json').write_text(json.dumps(session), encoding='utf-8')
print('SESSION_FILE=' + str(scratch / 'session.json'), flush=True)
from django.core.wsgi import get_wsgi_application
from django.contrib.staticfiles.handlers import StaticFilesHandler
from wsgiref.simple_server import make_server
from django.urls import re_path
from django.views.static import serve
import importlib
urls = importlib.import_module(settings.ROOT_URLCONF)
urls.urlpatterns.insert(0, re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}))
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, WSGIRequestHandler
class ThreadedServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True
class QuietHandler(WSGIRequestHandler):
    def log_message(self, *args):
        pass
make_server('127.0.0.1', 8017, get_wsgi_application(), server_class=ThreadedServer, handler_class=QuietHandler).serve_forever()
