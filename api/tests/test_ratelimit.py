from moneyflow_api.ratelimit import SlidingWindowRateLimiter
from tests.conftest import ALICE, BOB, HarnessFactory
from tests.fakes import SteppingClock


def test_allows_up_to_the_limit_then_blocks() -> None:
    clock = SteppingClock()
    limiter = SlidingWindowRateLimiter(limit=3, window_seconds=60, clock=clock)

    assert [limiter.hit("u") for _ in range(3)] == [None, None, None]
    assert limiter.hit("u") == 60


def test_window_slides() -> None:
    clock = SteppingClock()
    limiter = SlidingWindowRateLimiter(limit=2, window_seconds=60, clock=clock)
    limiter.hit("u")
    clock.value += 30
    limiter.hit("u")

    clock.value += 10
    assert limiter.hit("u") == 20
    clock.value += 20
    assert limiter.hit("u") is None


def test_rejected_hits_do_not_extend_the_block() -> None:
    clock = SteppingClock()
    limiter = SlidingWindowRateLimiter(limit=1, window_seconds=10, clock=clock)
    limiter.hit("u")
    for _ in range(5):
        limiter.hit("u")

    clock.value += 10
    assert limiter.hit("u") is None


def test_keys_are_independent_and_forgettable() -> None:
    limiter = SlidingWindowRateLimiter(limit=1, window_seconds=60, clock=SteppingClock())
    limiter.hit("a")

    assert limiter.hit("b") is None
    assert limiter.hit("a") is not None
    limiter.forget("a")
    assert limiter.hit("a") is None


def test_sweep_drops_idle_keys() -> None:
    clock = SteppingClock()
    limiter = SlidingWindowRateLimiter(limit=5, window_seconds=1, clock=clock)
    for index in range(999):
        limiter.hit(f"user-{index}")
    clock.value += 5

    limiter.hit("trigger")

    assert len(limiter._hits) == 1


def test_burst_over_30_per_minute_is_rate_limited(make_harness: HarnessFactory) -> None:
    clock = SteppingClock()
    harness = make_harness(rate_limiter=SlidingWindowRateLimiter(clock=clock))

    statuses = [harness.client.get("/api/me", headers=ALICE).status_code for _ in range(30)]
    blocked = harness.client.get("/api/me", headers=ALICE)

    assert statuses == [200] * 30
    assert blocked.status_code == 429
    assert blocked.json() == {
        "error": {
            "code": "rate_limited",
            "message": "Too many requests. Please slow down.",
            "retryAfterSeconds": 60,
        }
    }
    assert blocked.headers["Retry-After"] == "60"
    assert harness.client.get("/api/me", headers=BOB).status_code == 200

    clock.value += 61
    assert harness.client.get("/api/me", headers=ALICE).status_code == 200


def test_unauthenticated_requests_are_not_counted(make_harness: HarnessFactory) -> None:
    harness = make_harness(rate_limiter=SlidingWindowRateLimiter(limit=1, clock=SteppingClock()))
    for _ in range(3):
        assert harness.client.get("/api/me").status_code == 401

    assert harness.client.get("/api/me", headers=ALICE).status_code == 200
