from rest_framework.pagination import PageNumberPagination


class RequestPagination(PageNumberPagination):
    page_size = 25
    page_query_param = "page"
    page_size_query_param = "page_size"
    max_page_size = 100
