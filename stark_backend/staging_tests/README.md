# Staging tests

Run the Python tests and coverage locally after installing the test
requirements:

```powershell
$env:DJANGO_ENV = "test"
pytest --cov=. --cov-report=term-missing
```

The local contract tests check that the OpenAPI endpoint is available. The
Schemathesis test is opt-in and requires `STARK_STAGING_URL`; it should only
be run against a disposable staging environment.

Run the Postman smoke collection with Newman:

```powershell
newman run .\Stark-Together.postman_collection.json `
  -e .\Stark-Together.postman_environment.example.json
```

Run the Locust smoke/load test:

```powershell
$env:STARK_STAGING_URL = "https://staging.example.com"
locust -f .\locustfile.py --headless -u 5 -r 1 -t 1m
```

Set `STARK_ACCESS_TOKEN` for authenticated wallet requests. Do not put real
credentials or tokens in committed collection/environment files.
