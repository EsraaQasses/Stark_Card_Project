"""Run PostgreSQL-only tests on a new disposable cluster; retain all databases."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path
scratch = Path(tempfile.mkdtemp(prefix='stark-admin-pg-'))
binaries = Path(r'C:\Program Files\PostgreSQL\18\bin')
cluster = scratch / 'cluster'
port = '55447'
flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
def run(*args):
    with (scratch/'commands.log').open('a', encoding='utf-8') as output:
        return subprocess.run([str(args[0]), *map(str,args[1:])], check=True, creationflags=flags, stdout=output, stderr=subprocess.STDOUT, text=True)
run(binaries/'initdb.exe', '-D', cluster, '-U', 'stark_test', '--auth=trust', '--encoding=UTF8', '--no-locale')
started = False
try:
    run(binaries/'pg_ctl.exe', '-D', cluster, '-l', scratch/'postgres.log', '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start')
    started = True
    root = Path(__file__).resolve().parents[2] / 'Stark_Card_Project-backend-v2' / 'stark_backend'
    sys.path.insert(0,str(root))
    os.environ.update(DJANGO_ENV='test', USE_SQLITE='1', PENDING_PURCHASE_POLL_ENABLED='false', DJANGO_SETTINGS_MODULE='stark_backend.settings')
    from django.conf import settings
    settings.DATABASES['default'] = {'ENGINE':'django.db.backends.postgresql','NAME':'postgres','USER':'stark_test','PASSWORD':'','HOST':'127.0.0.1','PORT':port,'TEST':{'NAME':'stark_admin_isolated_test'}}
    settings.MEDIA_ROOT = str(scratch/'media')
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
    settings.CELERY_TASK_ALWAYS_EAGER = False
    for handler in settings.LOGGING.get('handlers',{}).values():
        if 'filename' in handler: handler['filename'] = str(scratch/Path(handler['filename']).name)
    import django
    django.setup()
    from django.test.runner import DiscoverRunner
    print('ISOLATED_POSTGRES_CLUSTER=' + str(cluster), flush=True)
    failures=DiscoverRunner(keepdb=True,interactive=False,verbosity=2).run_tests(['finance.test_postgres_concurrency','finance.tests','finance.test_phase_1_2_final','shipping.test_listing_contract'])
finally:
    if started: run(binaries/'pg_ctl.exe','-D',cluster,'-m','fast','-w','stop')
    print('Cluster stopped; files and test database retained: '+str(scratch),flush=True)
raise SystemExit(bool(failures))
