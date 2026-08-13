import os

import pytest


schemathesis = pytest.importorskip("schemathesis")


@pytest.mark.contract
@pytest.mark.staging
def test_staging_openapi_contract():
    base_url = os.getenv("STARK_STAGING_URL")
    if not base_url:
        pytest.skip("Set STARK_STAGING_URL to run staging contract tests")

    schema_url = f"{base_url.rstrip('/')}/api/schema/"
    schema = schemathesis.openapi.from_url(schema_url)

    @schema.parametrize()
    def run_case(case):
        response = case.call(base_url=base_url)
        case.validate_response(response)

    run_case()
