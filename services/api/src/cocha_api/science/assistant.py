"""Server-side Gemini budget adapter. Paid calls are not enabled.

Price settings are placeholders. Official Google prices must be verified
before any real request. Tests use FakeProvider only.
"""

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


class PriceNotVerified(RuntimeError):
    """Token prices have not been checked against official documentation."""


@dataclass(frozen=True)
class FakeCompletion:
    text: str
    cost_usd: float


class FakeProvider:
    """Identified fixture provider. It does not contact Gemini."""

    provider_id = "fake"

    def __init__(
        self,
        *,
        text: str = "fixture-explanation",
        cost_usd: float = 0.0,
        fail: bool = False,
    ) -> None:
        self.text = text
        self.cost_usd = cost_usd
        self.fail = fail

    def complete(self, prompt: str) -> FakeCompletion:
        del prompt
        if self.fail:
            raise RuntimeError("fake provider failure")
        return FakeCompletion(text=self.text, cost_usd=self.cost_usd)


class BudgetLedger:
    """Atomic reservation ledger. In memory, or a gitignored JSON file."""

    def __init__(self, *, budget_usd: float, path: Path | None = None) -> None:
        if budget_usd <= 0:
            raise ValueError("budget_usd must be positive")
        self.budget_usd = budget_usd
        self.path = path
        self._lock = threading.Lock()
        self._spent = 0.0
        self._reserved: dict[str, float] = {}
        self._settled: set[str] = set()
        if path is not None and path.exists():
            self._load(path)

    def _load(self, path: Path) -> None:
        payload = json.loads(path.read_text(encoding="utf-8"))
        self._spent = float(payload["spent_usd"])
        self._reserved = {
            str(key): float(value) for key, value in payload.get("reserved", {}).items()
        }
        self._settled = {str(item) for item in payload.get("settled", [])}

    def _persist(self) -> None:
        if self.path is None:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "spent_usd": self._spent,
            "reserved": self._reserved,
            "settled": sorted(self._settled),
        }
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        temporary.replace(self.path)

    def totals(self) -> tuple[float, float]:
        with self._lock:
            return self._spent, sum(self._reserved.values())

    def reserve(self, request_id: str, amount_usd: float) -> bool:
        if amount_usd <= 0:
            raise ValueError("reserve amount must be positive")
        with self._lock:
            if request_id in self._settled or request_id in self._reserved:
                return True
            reserved = sum(self._reserved.values())
            if self._spent + reserved + amount_usd > self.budget_usd:
                return False
            self._reserved[request_id] = amount_usd
            self._persist()
            return True

    def reconcile(self, request_id: str, actual_usd: float | None) -> None:
        """Charge the actual cost, or the full reservation when the cost is unknown."""

        with self._lock:
            if request_id in self._settled:
                return
            reserved = self._reserved.pop(request_id, None)
            if reserved is None:
                return
            if actual_usd is None:
                charged = reserved
            elif actual_usd < 0:
                self._reserved[request_id] = reserved
                raise ValueError("cost cannot be negative")
            else:
                charged = actual_usd
            self._spent += charged
            self._settled.add(request_id)
            self._persist()


@dataclass(frozen=True)
class AskResult:
    status: Literal["ok", "rejected", "provider_error"]
    text: str | None
    reason: str | None
    request_id: str


def placeholder_token_reserve(*_args: object, **_kwargs: object) -> None:
    raise PriceNotVerified(
        "Token prices are placeholders and have not been checked against official Google pricing."
    )


def ask(
    *,
    provider: FakeProvider,
    ledger: BudgetLedger,
    prompt: str,
    request_id: str,
    reserve_usd: float,
) -> AskResult:
    if not isinstance(provider, FakeProvider):
        raise TypeError("Paid providers are disabled; use FakeProvider in tests")
    if not ledger.reserve(request_id, reserve_usd):
        return AskResult(
            status="rejected",
            text=None,
            reason="budget_exceeded",
            request_id=request_id,
        )
    try:
        completion = provider.complete(prompt)
    except Exception:
        ledger.reconcile(request_id, None)
        return AskResult(
            status="provider_error",
            text=None,
            reason="provider_failed_reservation_kept",
            request_id=request_id,
        )
    ledger.reconcile(request_id, completion.cost_usd)
    return AskResult(status="ok", text=completion.text, reason=None, request_id=request_id)


def read_ledger_totals(path: Path, budget_usd: float) -> tuple[float, float]:
    if not path.exists():
        return 0.0, 0.0
    ledger = BudgetLedger(budget_usd=budget_usd, path=path)
    return ledger.totals()
