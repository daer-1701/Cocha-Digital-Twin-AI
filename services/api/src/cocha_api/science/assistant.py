"""Server-side Gemini budget adapter. Paid calls are not enabled.

Token prices for gemini-3.6-flash were checked on 2026-11-14. Live requests
stay disabled until an explicit authorization. Tests use FakeProvider only.
"""

import json
import math
import os
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


class PriceNotVerified(RuntimeError):
    """Live Gemini calls stay blocked even when token prices have been checked."""


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
    """Atomic ledger shared by processes using the same local JSON/lock files.

    A filesystem lock covers reload, read/modify/write and atomic replacement.
    Multiple hosts must use a central transactional store before enabling paid calls.
    """

    def __init__(self, *, budget_usd: float, path: Path | None = None) -> None:
        if not math.isfinite(budget_usd) or budget_usd <= 0:
            raise ValueError("budget_usd must be positive")
        self.budget_usd = budget_usd
        self.path = path
        self._lock = threading.Lock()
        self._spent = 0.0
        self._reserved: dict[str, float] = {}
        self._settled: set[str] = set()

    @contextmanager
    def _transaction(self) -> Iterator[None]:
        with self._lock:
            if self.path is None:
                yield
                return
            self.path.parent.mkdir(parents=True, exist_ok=True)
            # Lock a stable sibling: the ledger itself is replaced on every write.
            with self.path.with_suffix(self.path.suffix + ".lock").open("a+b") as handle:
                if os.name == "nt":
                    import msvcrt

                    # Byte 0 may lie past EOF; writing a placeholder races with the holder.
                    handle.seek(0)
                    msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
                else:
                    import fcntl

                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
                try:
                    if self.path.exists():
                        self._load(self.path)
                    yield
                finally:
                    if os.name == "nt":
                        handle.seek(0)
                        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

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
        with self._transaction():
            return self._spent, sum(self._reserved.values())

    def reserve(self, request_id: str, amount_usd: float) -> bool:
        if not math.isfinite(amount_usd) or amount_usd <= 0:
            raise ValueError("reserve amount must be positive")
        with self._transaction():
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

        with self._transaction():
            if request_id in self._settled:
                return
            if actual_usd is not None and (not math.isfinite(actual_usd) or actual_usd < 0):
                raise ValueError("cost must be finite and nonnegative")
            reserved = self._reserved.pop(request_id, None)
            if reserved is None:
                return
            if actual_usd is None:
                charged = reserved
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
        "Live Gemini calls are not authorized. Verified token prices do not enable a request."
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
