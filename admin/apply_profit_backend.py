"""Apply the reviewed new feature without overwriting concurrent backend edits."""
from pathlib import Path
import hashlib
import json

root = Path(r'C:\Users\alaan\Desktop\Stark\Stark_Card_Project-backend-v2\stark_backend')
stage = Path(__file__).resolve().parent / 'backend_profit_matrix'
manifest = json.loads((stage/'manifest.json').read_text())
for name, expected in manifest.items():
    if hashlib.sha256((root/name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Backend changed concurrently; refusing to overwrite: '+name)
new_files = {'store/profit_matrix.py':'profit_matrix.py', 'store/test_profit_matrix.py':'test_profit_matrix.py',
             'store/migrations/0016_product_category_profit.py':'0016_product_category_profit.py'}
for name in new_files:
    if (root/name).exists():
        raise RuntimeError('New target already exists: '+name)
models = (root/'store/models.py').read_bytes() + (stage/'model_addition.txt').read_bytes()
urls = (root/'store/urls.py').read_bytes()
urls = b'from .profit_matrix import ProductProfitMatrixView\n' + urls
urls = urls.replace(b'urlpatterns = [', b"urlpatterns = [\n    path('admin/profit-matrix/', ProductProfitMatrixView.as_view(), name='admin-product-profit-matrix'),", 1)
categories = (root/'users/views/categories.py').read_bytes()
categories = b'from rest_framework.exceptions import ValidationError\n' + categories
marker = b'    def perform_destroy(self, instance):'
newline = b'\r\n' if b'\r\n' in categories else b'\n'
categories = categories.replace(marker, marker + newline + b"        if instance.product_profit_rates.exists():" + newline + b"            raise ValidationError({'detail': 'This category has product rate history. Deactivate it instead of deleting it.'})", 1)
for name, content in {'store/models.py':models, 'store/urls.py':urls, 'users/views/categories.py':categories}.items():
    (root/name).write_bytes(content)
for name, source in new_files.items():
    (root/name).write_bytes((stage/source).read_bytes())
print('Applied profit matrix model, migration, API, tests and category history guard.')
