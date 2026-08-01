from rest_framework_simplejwt.views import TokenRefreshView

from ..authentication import VersionedTokenRefreshSerializer


class VersionedTokenRefreshView(TokenRefreshView):
    serializer_class = VersionedTokenRefreshSerializer
