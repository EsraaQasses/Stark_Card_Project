import tempfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User
from .models import PaymentMethod, PaymentMethodField, PaymentMethodImage
from .serializers import PaymentMethodCreateSerializer


def image(name='test.png'):
    stream = BytesIO()
    Image.new('RGB', (4, 4), 'red').save(stream, format='PNG')
    return SimpleUploadedFile(name, stream.getvalue(), content_type='image/png')


class PaymentMediaTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        settings = override_settings(MEDIA_ROOT=self.temp.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.admin = User.objects.create_user(name='media-admin', role='admin')
        self.user = User.objects.create_user(name='media-user')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.method = PaymentMethod.objects.create(
            title='Bank', name='bank', instructions='Scan and transfer',
            account_details='Account', icon_url=image('old.png'), qr_image=image('qr.png'),
        )
        self.url = f'/api/payment-methods/admin/payment-methods/{self.method.id}/'

    def files(self):
        return {str(p.relative_to(self.temp.name)) for p in Path(self.temp.name).rglob('*') if p.is_file()}

    def test_create_and_user_read_images_instructions_currency_description(self):
        response = self.client.post('/api/payment-methods/admin/payment-methods/', {
            'name': 'new', 'title': 'New', 'instructions': 'Transfer', 'account_details': '123',
            'currency': 'SYP', 'description': 'Local transfer', 'icon_url': image(), 'qr_image': image('newqr.png'),
            'instruction_image': image('instructions.png'),
            'fields': '[{"field_name":"Reference","field_key":"ref","input_type":"text"}]',
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.client.force_authenticate(self.user)
        data = self.client.get('/api/payment-methods/user/payment-methods/').data
        method = next(row for row in data if row['name'] == 'new')
        self.assertEqual(method['currency'], 'SYP')
        self.assertEqual(method['description'], 'Local transfer')
        self.assertEqual(method['instructions'], 'Transfer')
        self.assertTrue(method['icon_url'].startswith('http://testserver/media/'))
        self.assertTrue(method['qr_image'])
        self.assertTrue(method['instruction_image'])
        self.assertEqual(method['fields'][0]['field_key'], 'ref')

    def test_replace_and_clear_only_remove_old_files_after_commit(self):
        old = self.method.icon_url.path
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(self.url, {'icon_url': image('replacement.png')}, format='multipart')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertTrue(Path(old).exists())
        self.assertFalse(Path(old).exists())
        self.method.refresh_from_db()
        qr = self.method.qr_image.path
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.patch(self.url, {'qr_image': None}, format='json').status_code, 200)
        self.assertFalse(Path(qr).exists())

    def test_failed_nested_save_preserves_old_images_fields_and_cleans_new_uploads(self):
        field = PaymentMethodField.objects.create(payment_method=self.method, field_name='Old', field_key='old', input_type='text')
        before = self.files()
        serializer = PaymentMethodCreateSerializer(self.method, data={
            'icon_url': image('fail.png'), 'qr_image': image('failqr.png'), 'instruction_image': image('fail-instructions.png'),
            'fields': [{'field_name': 'New', 'field_key': 'new', 'input_type': 'text'}],
        }, partial=True)
        serializer.is_valid(raise_exception=True)
        with patch.object(PaymentMethodField.objects, 'create', side_effect=IntegrityError('save failed')):
            with self.assertRaises(IntegrityError):
                serializer.save()
        self.method.refresh_from_db()
        self.assertTrue(self.method.icon_url.name.endswith('old.png'))
        self.assertTrue(self.method.fields.filter(pk=field.pk).exists())
        self.assertEqual(self.files(), before)

    def test_gallery_upload_replace_reorder_delete_and_ownership(self):
        data = self.client.post(self.url + 'gallery/', {'images': [image('a.png'), image('b.png')]}, format='multipart')
        self.assertEqual(data.status_code, 201, data.data)
        a, b = [row['id'] for row in data.data['additional_images']]
        response = self.client.post(self.url + 'gallery-order/', {'ids': [b, a]}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(self.method.additional_images.values_list('pk', flat=True)), [b, a])
        self.assertEqual(self.client.post(self.url + 'gallery-order/', {'ids': [a, a]}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.url + 'gallery-order/', {'ids': [a, 9999]}, format='json').status_code, 400)
        old = PaymentMethodImage.objects.get(pk=a).image.path
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.patch(self.url + f'gallery/{a}/', {'image': image('replace.png')}, format='multipart').status_code, 200)
        self.assertFalse(Path(old).exists())
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(self.url + f'gallery/{a}/').status_code, 204)
        self.assertFalse(self.method.additional_images.filter(pk=a).exists())
        self.assertEqual(self.client.delete(self.url + 'gallery/9999/').status_code, 404)
        other = PaymentMethod.objects.create(title='Other', name='other', instructions='', account_details='')
        foreign = PaymentMethodImage.objects.create(payment_method=other, image=image('foreign.png'))
        self.assertEqual(self.client.delete(self.url + f'gallery/{foreign.pk}/').status_code, 404)
        self.assertTrue(PaymentMethodImage.objects.filter(pk=foreign.pk).exists())

    def test_gallery_batch_failure_rolls_back_rows_and_files(self):
        before = self.files()
        original_save = PaymentMethodImage.save
        calls = []
        def fail_second(entry, *args, **kwargs):
            calls.append(entry)
            if len(calls) == 2:
                raise IntegrityError('second image failed')
            return original_save(entry, *args, **kwargs)
        with patch.object(PaymentMethodImage, 'save', fail_second):
            response = self.client.post(self.url + 'gallery/', {'images': [image('a.png'), image('b.png')]}, format='multipart')
        self.assertEqual(response.status_code, 500)
        self.assertEqual(self.method.additional_images.count(), 0)
        self.assertEqual(self.files(), before)

    def test_permissions_and_invalid_images_do_not_mutate_media(self):
        before = self.files()
        self.assertEqual(self.client.patch(self.url, {'currency': 'EUR'}, format='json').status_code, 400)
        bad = SimpleUploadedFile('bad.png', b'not an image', content_type='image/png')
        self.assertEqual(self.client.patch(self.url, {'qr_image': bad}, format='multipart').status_code, 400)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.patch(self.url, {'title': 'No'}, format='json').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/payment-methods/user/payment-methods/').status_code, 401)
        self.assertEqual(self.files(), before)

    def test_destroy_cleans_all_images_after_commit(self):
        PaymentMethodImage.objects.create(payment_method=self.method, image=image('gallery.png'))
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(self.url).status_code, 204)
        self.assertEqual(self.files(), set())
