from rest_framework.response import Response
from rest_framework import status

def check_ban_middleware(get_response):
    def middleware(request):
        if request.user.is_authenticated and hasattr(request.user, "is_banned") and request.user.is_banned:
            return Response({'error': 'Your account has been banned.'}, status=status.HTTP_403_FORBIDDEN)
        return get_response(request)
    return middleware
