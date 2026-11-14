"""Budget ledger and FakeProvider. No Gemini calls."""

import json
import logging
import threading
from pathlib import Path

import pytest
from cocha_api.science.assistant import (
    BudgetLedger,
    FakeProvider,
    PriceNotVerified,
    ask,
    placeholder_token_reserve,
)


def test_parallel_reservations_cannot_exceed_the_budget():
    ledger = BudgetLedger(budget_usd=1.0)
    results: list[bool] = []
    lock = threading.Lock()

    def reserve(index: int) -> None:
        allowed = ledger.reserve(f"request-{index}", 1.0)
        with lock:
            results.append(allowed)

    threads = [threading.Thread(target=reserve, args=(index,)) for index in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert results.count(True) == 1
    spent, reserved = ledger.totals()
    assert spent == 0
    assert reserved == pytest.approx(1.0)


def test_unknown_cost_keeps_the_reservation_and_reconcile_is_idempotent():
    ledger = BudgetLedger(budget_usd=4.0)
    assert ledger.reserve("kept", 0.4)
    ledger.reconcile("kept", None)
    ledger.reconcile("kept", None)
    spent, reserved = ledger.totals()
    assert spent == pytest.approx(0.4)
    assert reserved == 0
    assert ledger.reserve("kept", 0.4) is True
    spent_again, _reserved = ledger.totals()
    assert spent_again == pytest.approx(0.4)


def test_fake_provider_ask_and_budget_rejection(caplog: pytest.LogCaptureFixture):
    caplog.set_level(logging.DEBUG)
    secret = "super-secret-gemini-key"
    ledger = BudgetLedger(budget_usd=0.05)
    rejected = ask(
        provider=FakeProvider(),
        ledger=ledger,
        prompt=f"print {secret}",
        request_id="too-big",
        reserve_usd=1.0,
    )
    assert rejected.status == "rejected"
    accepted = ask(
        provider=FakeProvider(text="fixture-explanation", cost_usd=0.01),
        ledger=BudgetLedger(budget_usd=4.0),
        prompt=f"print {secret}",
        request_id="ok",
        reserve_usd=0.02,
    )
    assert accepted.status == "ok"
    assert accepted.text == "fixture-explanation"
    assert secret not in (accepted.text or "")
    assert secret not in caplog.text


def test_provider_failure_charges_the_conservative_reservation():
    ledger = BudgetLedger(budget_usd=4.0)
    result = ask(
        provider=FakeProvider(fail=True),
        ledger=ledger,
        prompt="fixture",
        request_id="fail",
        reserve_usd=0.3,
    )
    assert result.status == "provider_error"
    spent, reserved = ledger.totals()
    assert spent == pytest.approx(0.3)
    assert reserved == 0


def test_paid_provider_and_unverified_prices_are_blocked():
    class OtherProvider:
        def complete(self, prompt: str) -> None:
            del prompt

    with pytest.raises(TypeError):
        ask(
            provider=OtherProvider(),  # type: ignore[arg-type]
            ledger=BudgetLedger(budget_usd=4.0),
            prompt="x",
            request_id="x",
            reserve_usd=0.01,
        )
    with pytest.raises(PriceNotVerified):
        placeholder_token_reserve(input_tokens=10, output_tokens=10)


def test_ledger_file_round_trip_has_no_secrets(tmp_path: Path):
    path = tmp_path / "ledger.json"
    secret = "super-secret-gemini-key"
    ledger = BudgetLedger(budget_usd=4.0, path=path)
    assert ledger.reserve("a", 0.5)
    ledger.reconcile("a", 0.2)
    reloaded = BudgetLedger(budget_usd=4.0, path=path)
    spent, reserved = reloaded.totals()
    assert spent == pytest.approx(0.2)
    assert reserved == 0
    raw = path.read_text(encoding="utf-8")
    assert secret not in raw
    assert json.loads(raw)["spent_usd"] == pytest.approx(0.2)
