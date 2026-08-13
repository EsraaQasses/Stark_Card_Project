import pytest


@pytest.mark.contract
def test_openapi_schema_is_available(api_client):
    response = api_client.get("/api/schema/")

    assert response.status_code == 200
    schema = response.json()
    assert schema["openapi"].startswith("3.")
    assert any(path.startswith("/api/users/") for path in schema["paths"])
    assert any(path.startswith("/api/wallets/") for path in schema["paths"])


@pytest.mark.contract
def test_openapi_schema_documents_authentication(api_client):
    schema = api_client.get("/api/schema/").json()

    assert "components" in schema
    assert "securitySchemes" in schema["components"]
