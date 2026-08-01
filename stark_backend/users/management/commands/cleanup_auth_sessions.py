from django.core.management.base import BaseCommand

from users.authentication import cleanup_expired_auth_sessions


class Command(BaseCommand):
    help = "Remove expired temporary user and admin authentication sessions."

    def handle(self, *args, **options):
        deleted = cleanup_expired_auth_sessions()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} expired authentication sessions."))
