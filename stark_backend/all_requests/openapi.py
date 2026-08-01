from drf_spectacular.utils import OpenApiParameter, OpenApiTypes


REQUEST_FILTER_PARAMETERS = [
    OpenApiParameter("status", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False,
                     enum=["pending", "shipping", "in_progress", "objection", "completed", "rejected"]),
    OpenApiParameter("request_type", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False,
                     enum=["payment", "cashout", "support", "refund", "other"]),
    OpenApiParameter("user", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("agent", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("reviewer", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("provider", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("currency", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False, enum=["USD", "SYP"]),
    OpenApiParameter("created_from", OpenApiTypes.DATETIME, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("created_to", OpenApiTypes.DATETIME, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("amount_min", OpenApiTypes.NUMBER, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("amount_max", OpenApiTypes.NUMBER, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("search", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("ordering", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("page", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    OpenApiParameter("page_size", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
]

SHIPPING_FILTER_PARAMETERS = [
    parameter
    for parameter in REQUEST_FILTER_PARAMETERS
    if parameter.name != "request_type"
]
SHIPPING_FILTER_PARAMETERS = [
    OpenApiParameter(
        "status", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False,
        enum=["pending", "approved", "rejected", "processing", "failed"],
    ) if parameter.name == "status" else parameter
    for parameter in SHIPPING_FILTER_PARAMETERS
]
CASHOUT_FILTER_PARAMETERS = [
    parameter for parameter in REQUEST_FILTER_PARAMETERS if parameter.name not in {"request_type", "reviewer", "status"}
]
CASHOUT_FILTER_PARAMETERS.insert(
    0,
    OpenApiParameter(
        "status", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False,
        enum=["pending", "approved", "rejected", "failed", "cancelled"],
    ),
)
