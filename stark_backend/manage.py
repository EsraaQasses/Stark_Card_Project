#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    if len(sys.argv) >= 2 and sys.argv[1] == "test":
        labels = [arg for arg in sys.argv[2:] if not arg.startswith("-") and not arg.isdigit()]
        if not labels:
            sys.argv[2:2] = [
                "agents", "all_requests", "dashboard", "payment", "payment_methods",
                "qr_code", "shipping", "store", "system", "third_party_apis",
                "transactions", "users", "wallets", "finance",
            ]
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'stark_backend.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
