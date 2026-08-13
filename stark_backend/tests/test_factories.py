import pytest

from tests.factories import UserFactory


@pytest.mark.django_db
def test_user_factory_creates_a_test_user():
    user = UserFactory()

    assert user.pk is not None
    assert user.name.startswith("test_user_")
    assert user.check_password("TestPassword123!")
