import factory
from factory.django import DjangoModelFactory

from users.models import User


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ("name",)

    full_name = factory.Sequence(lambda n: f"Test User {n}")
    name = factory.Sequence(lambda n: f"test_user_{n}")
    email = factory.LazyAttribute(lambda user: f"{user.name}@example.test")
    phone = factory.Sequence(lambda n: f"0999000{n:04d}")
    role = "user"
    password = factory.PostGenerationMethodCall("set_password", "TestPassword123!")
