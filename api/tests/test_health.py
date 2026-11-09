from fastapi.testclient import TestClient

from moneyflow_api import __version__


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}


def test_docs_hidden_in_production() -> None:
    from moneyflow_api.config import Settings
    from moneyflow_api.main import create_app

    app = create_app(Settings(env="production"))
    with TestClient(app) as prod_client:
        assert prod_client.get("/api/docs").status_code == 404
        assert prod_client.get("/api/health").status_code == 200
