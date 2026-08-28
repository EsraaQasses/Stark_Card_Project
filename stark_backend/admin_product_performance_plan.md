# Admin Product Performance Plan

## Goal

Make the admin product list fast without changing product detail, create, update, purchase, or requirements behavior.

## Execution Order

- [x] Document the plan and frontend handoff.
- [ ] Measure the current list response, query count, and payload size.
- [x] Add bounded pagination to `GET /api/store/admin/products/`.
- [x] Add a lightweight admin list serializer.
- [x] Remove detail-only computed fields from list responses.
- [x] Keep full product data on `GET /api/store/admin/products/{id}/`.
- [x] Optimize list-only queryset loading.
- [x] Verify and extend search and existing filters.
- [x] Review existing database indexes; no migration was needed.
- [x] Add regression and query-count performance tests.
- [ ] Run focused tests and compare before/after measurements.

## Safety Rules

- Preserve the existing endpoint path and authentication.
- Preserve the full detail serializer for retrieve, create, update, and custom actions.
- Make list changes conditional on the `list` action.
- Do not remove fields from detail responses.
- Use migrations for database changes.
- Validate each stage before starting the next stage.

## Frontend Handoff

### Endpoint

```text
GET /api/store/admin/products/?page=1&page_size=50
```

The response is paginated:

```json
{
  "count": 125,
  "next": "https://api.example.com/api/store/admin/products/?page=2&page_size=50",
  "previous": null,
  "results": []
}
```

### List Behavior

- Use `results` for the current page.
- Use `count` for the total number of products.
- Follow `next` and `previous` for pagination.
- Use server-side filters such as `is_active`, `section_id`, `product_type`, and `currency` where supported.
- Do not expect full pricing calculations, available external products, requirements, or customization details in the list response.
- Fetch full product details only when opening or editing a product:

```text
GET /api/store/admin/products/{id}/
```

### List Fields

The lightweight list response contains the product identity and fields needed for the admin table, including ID, names, section, currency, base price, product type, active state, external product reference, and image metadata.

### Compatibility

Product detail, create, update, toggle, requirements, and purchase flows retain their existing response behavior. The frontend should not treat the list response as a full product object.

## Measurement Checklist

Record before and after:

- Response time.
- Database query count.
- Response byte size.
- Number of products returned.
- Query count as product count increases.

Test with at least 100, 500, and 1,000 products when possible.
