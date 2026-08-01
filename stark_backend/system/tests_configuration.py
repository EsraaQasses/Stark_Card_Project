import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase


PROJECT_DIR = Path(__file__).resolve().parents[1]
SECRET_KEY_ENV = "SECRET" + "_KEY"
FERNET_KEY_ENV = "THIRD_PARTY_API_FERNET" + "_KEY"

DEV_SECRET = "devconfigvalue" * 4
DEV_FERNET = "devfernetvalue" * 3
PROD_SECRET = "productionconfigvalue" * 3
PROD_FERNET = "productionfernetvalue" * 3


def run_settings_import(overrides, code="import importlib; importlib.import_module('stark_backend.settings')"):
    env = os.environ.copy()
    env.pop("DJANGO_ENV", None)
    env.update(overrides)
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=PROJECT_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


class EnvironmentConfigurationTests(SimpleTestCase):
    def test_missing_django_env_fails_fast(self):
        result = run_settings_import({})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_ENV must be set", result.stderr + result.stdout)

    def test_invalid_django_env_fails_fast(self):
        result = run_settings_import({"DJANGO_ENV": "invalid"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_ENV must be one of", result.stderr + result.stdout)

    def test_development_env_keeps_shell_debug_override(self):
        result = run_settings_import(
            {
                "DJANGO_ENV": "development",
                "DEBUG": "False",
                "SECRET_KEY": DEV_SECRET,
                "THIRD_PARTY_API_FERNET_KEY": DEV_FERNET,
            },
            code=(
                "import importlib; "
                "settings = importlib.import_module('stark_backend.settings'); "
                "print(settings.DEBUG)"
            ),
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("False", result.stdout)

    def test_test_env_uses_shell_values_over_dotenv(self):
        result = run_settings_import(
            {
                "DJANGO_ENV": "test",
                "DEBUG": "False",
                "SECRET_KEY": DEV_SECRET,
                "THIRD_PARTY_API_FERNET_KEY": DEV_FERNET,
                "EMAIL_HOST_USER": "shell-test@example.com",
                "ALLOWED_HOSTS": "localhost,127.0.0.1",
                "CORS_ALLOWED_ORIGINS": "http://localhost:3000",
                "CSRF_TRUSTED_ORIGINS": "http://localhost:3000",
                "USE_SQLITE": "1",
            },
            code=(
                "import importlib; "
                "settings = importlib.import_module('stark_backend.settings'); "
                "print(settings.EMAIL_HOST_USER)"
            ),
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("shell-test@example.com", result.stdout)

    def test_production_rejects_sqlite(self):
        result = run_settings_import(
            {
                "DJANGO_ENV": "production",
                "DEBUG": "False",
                "USE_SQLITE": "1",
                "SECRET_KEY": PROD_SECRET,
                "THIRD_PARTY_API_FERNET_KEY": PROD_FERNET,
            }
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("USE_SQLITE must be False", result.stderr + result.stdout)

    def test_production_rejects_invalid_boolean(self):
        result = run_settings_import(
            {
                "DJANGO_ENV": "production",
                "DEBUG": "False",
                "USE_SQLITE": "maybe",
                SECRET_KEY_ENV: PROD_SECRET,
                FERNET_KEY_ENV: PROD_FERNET,
            }
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be a valid boolean value", result.stderr + result.stdout)

    def test_production_rejects_wildcard_allowed_hosts(self):
        result = run_settings_import(
            {
                "DJANGO_ENV": "production",
                "DEBUG": "False",
                "USE_SQLITE": "0",
                "ALLOWED_HOSTS": "*",
                "SECRET_KEY": PROD_SECRET,
                "THIRD_PARTY_API_FERNET_KEY": PROD_FERNET,
            }
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must not contain '*'", result.stderr + result.stdout)

    def test_production_rejects_invalid_db_port(self):
        result = run_settings_import(
            {
                "DJANGO_ENV": "production",
                "DEBUG": "False",
                "USE_SQLITE": "0",
                "ALLOWED_HOSTS": "stark-card-app.com",
                "CORS_ALLOWED_ORIGINS": "https://stark-card-app.com",
                "CSRF_TRUSTED_ORIGINS": "https://stark-card-app.com",
                "SECRET_KEY": PROD_SECRET,
                "THIRD_PARTY_API_FERNET_KEY": PROD_FERNET,
                "EMAIL_HOST_USER": "noreply@example.com",
                "EMAIL_HOST_PASSWORD": "placeholder-password",
                "DB_ENGINE": "django.db.backends.postgresql",
                "DB_NAME": "stark_test_plan_v2",
                "DB_USER": "postgres",
                "DB_PASSWORD": "placeholder-password",
                "DB_HOST": "127.0.0.1",
                "DB_PORT": "invalid",
            }
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DB_PORT must be an integer", result.stderr + result.stdout)

    def test_production_rejects_placeholder_secret(self):
        result = run_settings_import(
            {
                "DJANGO_ENV": "production",
                "DEBUG": "False",
                "USE_SQLITE": "0",
                "ALLOWED_HOSTS": "stark-card-app.com",
                "CORS_ALLOWED_ORIGINS": "https://stark-card-app.com",
                "CSRF_TRUSTED_ORIGINS": "https://stark-card-app.com",
                "SECRET_KEY": "django-insecure-placeholder",
                "THIRD_PARTY_API_FERNET_KEY": PROD_FERNET,
                "EMAIL_HOST_USER": "noreply@example.com",
                "EMAIL_HOST_PASSWORD": "placeholder-password",
                "DB_ENGINE": "django.db.backends.postgresql",
                "DB_NAME": "stark_test_plan_v2",
                "DB_USER": "postgres",
                "DB_PASSWORD": "placeholder-password",
                "DB_HOST": "127.0.0.1",
                "DB_PORT": "5433",
            }
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be replaced with a real value", result.stderr + result.stdout)
