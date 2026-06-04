import os
import sys
import pathlib

_GATEWAY_DIR  = pathlib.Path(__file__).parent.parent
_GENERATED_DIR = _GATEWAY_DIR / "generated"
if str(_GENERATED_DIR) not in sys.path:
    sys.path.insert(0, str(_GENERATED_DIR))

import pytest
from starlette.testclient import TestClient

from tests.mock_services import start_mock_servers

MOVIES_TEST_PORT = 59051
REVIEWS_TEST_PORT = 59052


@pytest.fixture(scope="session")
def mock_servers():
    movies_srv, reviews_srv = start_mock_servers(MOVIES_TEST_PORT, REVIEWS_TEST_PORT)
    yield
    movies_srv.stop(grace=0)
    reviews_srv.stop(grace=0)


@pytest.fixture(scope="session")
def client(mock_servers):
    os.environ["MOVIES_SERVICE_ADDR"] = f"localhost:{MOVIES_TEST_PORT}"
    os.environ["REVIEWS_SERVICE_ADDR"] = f"localhost:{REVIEWS_TEST_PORT}"

    import importlib
    import main as gw_main
    importlib.reload(gw_main)

    with TestClient(gw_main.app, raise_server_exceptions=True) as c:
        yield c
