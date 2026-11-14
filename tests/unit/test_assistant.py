"""Budget ledger and FakeProvider. No Gemini calls."""

import json
import logging
import multiprocessing
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


def _reserve_in_process(path, index, barrier, results):
    ledger = BudgetLedger(budget_usd=4.0, path=Path(path))
    barrier.wait(timeout=20)
    results.put(ledger.reserve(f"process-{index}", 3.0))


def test_processes_share_a_single_file_budget(tmp_path: Path):
    context = multiprocessing.get_context("spawn")
    barrier = context.Barrier(4)
    results = context.Queue()
    path = tmp_path / "ledger.json"
    processes = [
        context.Process(target=_reserve_in_process, args=(str(path), i, barrier, results))
        for i in range(4)
    ]
    try:
        for process in processes:
            process.start()
        allowed = [results.get(timeout=30) for _ in processes]
        for process in processes:
            process.join(timeout=10)
            assert process.exitcode == 0
        assert allowed.count(True) == 1
        assert BudgetLedger(budget_usd=4.0, path=path).totals() == (0.0, 3.0)
    finally:
        for process in processes:
            if process.is_alive():
                process.terminate()
                process.join()
        results.close()


def test_stale_instances_reload_reservations_and_reconciliation(tmp_path: Path):
    path = tmp_path / "ledger.json"
    first = BudgetLedger(budget_usd=4.0, path=path)
    second = BudgetLedger(budget_usd=4.0, path=path)
    assert first.reserve("first", 3.0)
    assert not second.reserve("second", 3.0)
    second.reconcile("first", 1.0)
    first.reconcile("first", 1.0)
    assert first.totals() == second.totals() == (1.0, 0.0)
    assert first.reserve("second", 3.0)
    assert second.totals() == (1.0, 3.0)


@pytest.mark.parametrize("amount", [float("nan"), float("inf"), -1.0])
def test_nonfinite_or_negative_amounts_do_not_corrupt_the_budget(amount):
    ledger = BudgetLedger(budget_usd=4.0)
    with pytest.raises(ValueError):
        ledger.reserve("bad", amount)
    assert ledger.reserve("ok", 1.0)
    with pytest.raises(ValueError):
        ledger.reconcile("ok", amount)
    assert ledger.totals() == (0.0, 1.0)
