from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from moneyflow_api.config import Settings
from moneyflow_api.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(env="test", cors_origins=["http://testserver"])


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as c:
        yield c
