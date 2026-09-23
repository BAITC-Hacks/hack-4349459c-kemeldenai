import pytest


@pytest.fixture(autouse=True)
def offline_ai(monkeypatch):
    """Never spend provider credits while running the test suite."""
    monkeypatch.setenv("OPENAI_API_KEY", "")
