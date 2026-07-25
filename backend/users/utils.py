import random
import string
from django.apps import apps

def generate_agent_code():
    User = apps.get_model('users', 'User')
    while True:
        code = "AGT-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not User.objects.filter(agent_code=code).exists():
            return code
