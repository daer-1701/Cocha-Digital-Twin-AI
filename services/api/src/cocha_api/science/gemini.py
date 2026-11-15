"""Evidence-grounded Gemini adapter with a central budget. Live calls are off.

The HTTP shape follows the Gemini API v1beta generateContent method
(x-goog-api-key header, contents/systemInstruction/generationConfig body,
usageMetadata token counts). Re-verify model, endpoint and prices against
official Google documentation before setting GEMINI_CALLS_ENABLED=true.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import threading
import urllib.error
import urllib.request
from collections import OrderedDict
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal, Protocol

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from cocha_api.db.models import AssistantRequest
from cocha_api.schemas.explorer import Snapshot

EvidenceKind = Literal["observation", "estimate", "scenario", "demo"]
ReserveOutcome = Literal["reserved", "duplicate", "exceeded"]
# Prefer [E1]; also accept (E1) so a near-miss format still grounds known evidence.
CITATION = re.compile(r"\[(E\d{1,3})\]|\((E\d{1,3})\)")
# Arbitrary constant shared by every API host for the budget advisory lock.
BUDGET_LOCK_KEY = 0x0C0C4A


class LiveCallsDisabled(RuntimeError):
    """Raised before any network access when paid calls are not authorized."""


class ProviderFailure(RuntimeError):
    """Provider call failed; the message is a short code without secrets."""


@dataclass(frozen=True)
class EvidenceItem:
    id: str
    kind: EvidenceKind
    title: str
    source: str
    text: str


@dataclass(frozen=True)
class Completion:
    text: str
    input_tokens: int | None
    output_tokens: int | None


class TextProvider(Protocol):
    provider_id: str

    def generate(
        self, *, system: str, user: str, max_output_tokens: int, timeout_seconds: float
    ) -> Completion: ...


SYSTEM_INSTRUCTION = (
    "Eres el asistente de Cocha Digital Twin AI. Responde en español usando solo la "
    "evidencia numerada del bloque Evidencia. Toda respuesta debe citar al menos un "
    "identificador con el formato exacto [E1], [E2], etc.; no uses (E1), E1: ni otras "
    "variantes. Si la evidencia no basta, dilo citando la limitación aplicable. "
    "No completes con conocimiento externo. LST es temperatura de superficie terrestre, "
    "no temperatura del aire. Una asociación no demuestra causalidad. Los datos 'demo' "
    "son sintéticos. No inventes cifras, límites oficiales ni predicciones."
)


def snapshot_evidence(snapshot: Snapshot | None) -> list[EvidenceItem]:
    """Pilot-window scene means and declared limitations, newest scene first."""

    if snapshot is None:
        return []
    items: list[EvidenceItem] = []
    for scene in sorted(snapshot.scenes, key=lambda s: s.acquired_at, reverse=True):
        lst = "sin dato" if scene.lst_mean is None else f"{scene.lst_mean:.2f} °C"
        ndvi = "sin dato" if scene.ndvi_mean is None else f"{scene.ndvi_mean:.3f}"
        items.append(
            EvidenceItem(
                id=f"E{len(items) + 1}",
                kind="observation",
                title=f"Escena {scene.id} ({scene.acquired_at.date().isoformat()})",
                source=scene.source_url,
                text=(
                    f"Ventana piloto '{snapshot.area_name}', no distrito. LST media "
                    f"(superficie) {lst}; NDVI medio {ndvi}; fracción válida "
                    f"{scene.valid_fraction:.2f}; producto {snapshot.product_version}."
                ),
            )
        )
    for limitation in snapshot.limitations:
        items.append(
            EvidenceItem(
                id=f"E{len(items) + 1}",
                kind="observation",
                title="Limitación declarada",
                source=snapshot.method,
                text=limitation,
            )
        )
    return items


def district_series_evidence(
    session: Session,
    *,
    district_number: int,
    boundary_version: str,
    start_id: int = 1,
) -> list[EvidenceItem]:
    """Accepted official zonal rows for one district; IDs continue from start_id."""

    from cocha_api.db.models import District, DistrictIndicator

    rows = session.execute(
        select(DistrictIndicator, District.number, District.name, District.source_url)
        .join(District, DistrictIndicator.district_id == District.id)
        .where(
            DistrictIndicator.publication_status == "accepted",
            District.number == district_number,
            District.boundary_version == boundary_version,
            DistrictIndicator.boundary_version == boundary_version,
        )
        .order_by(
            DistrictIndicator.variable,
            DistrictIndicator.statistic,
            DistrictIndicator.period_start,
            DistrictIndicator.id,
        )
        .limit(40)
    ).all()
    items: list[EvidenceItem] = []
    for index, (row, number, name, source_url) in enumerate(rows, start=start_id):
        value = "sin dato" if row.value is None else f"{row.value}"
        coverage = "n/d" if row.valid_fraction is None else f"{row.valid_fraction:.4f}"
        provenance = row.provenance if isinstance(row.provenance, dict) else {}
        scene = provenance.get("scene_id") or "escena no declarada"
        source = str(provenance.get("source_url") or source_url or "serie oficial aceptada")
        items.append(
            EvidenceItem(
                id=f"E{index}",
                kind="estimate",
                title=(
                    f"{name} · {row.variable} · {row.period_start.isoformat()}"
                    f"–{row.period_end.isoformat()}"
                ),
                source=source,
                text=(
                    f"Indicador zonal aceptado del distrito {number} "
                    f"(versión {boundary_version}). Estadístico {row.statistic}; "
                    f"valor {value} {row.units or ''}; cobertura válida {coverage}; "
                    f"escena {scene}. LST es superficie, no aire. La cobertura usa el "
                    f"área completa del polígono oficial."
                ),
            )
        )
    if not items:
        items.append(
            EvidenceItem(
                id=f"E{start_id}",
                kind="observation",
                title=f"Distrito {district_number} sin serie aceptada",
                source=boundary_version,
                text=(
                    f"No hay indicadores aceptados en district_indicators para el "
                    f"distrito {district_number} y la versión {boundary_version}. "
                    "No sustituir con la media de la ventana piloto Landsat."
                ),
            )
        )
    return items


def evidence_block(items: list[EvidenceItem], max_chars: int) -> tuple[str, list[EvidenceItem]]:
    """Serialize evidence until max_chars; returns the text and the items included."""

    lines: list[str] = []
    included: list[EvidenceItem] = []
    used = 0
    for item in items:
        line = f"[{item.id}] ({item.kind}) {item.title}. Fuente: {item.source}. {item.text}"
        if used + len(line) + 1 > max_chars:
            break
        lines.append(line)
        included.append(item)
        used += len(line) + 1
    return "\n".join(lines), included


def build_user_prompt(question: str, evidence_text: str) -> str:
    return f"Evidencia:\n{evidence_text}\n\nPregunta:\n{question.strip()}"


def cited_ids(answer: str, evidence: list[EvidenceItem]) -> tuple[list[str], list[str]]:
    """Return (valid citations in order, unknown citation ids)."""

    known = {item.id for item in evidence}
    valid: list[str] = []
    unknown: list[str] = []
    for group in CITATION.findall(answer):
        match = group[0] or group[1]
        if not match:
            continue
        target = valid if match in known else unknown
        if match not in target:
            target.append(match)
    return valid, unknown


def cost_usd(
    completion: Completion, input_per_million: float, output_per_million: float
) -> float | None:
    if completion.input_tokens is None or completion.output_tokens is None:
        return None
    return (
        completion.input_tokens * input_per_million + completion.output_tokens * output_per_million
    ) / 1_000_000


def cache_key(model: str, system: str, user: str, max_output_tokens: int) -> str:
    payload = json.dumps([model, system, user, max_output_tokens], ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class AnswerCache:
    """Per-process LRU of grounded answers. Shared caching needs the ledger replay."""

    def __init__(self, max_entries: int) -> None:
        self.max_entries = max_entries
        self._items: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> dict[str, Any] | None:
        with self._lock:
            value = self._items.get(key)
            if value is not None:
                self._items.move_to_end(key)
            return value

    def put(self, key: str, value: dict[str, Any]) -> None:
        if self.max_entries <= 0:
            return
        with self._lock:
            self._items[key] = value
            self._items.move_to_end(key)
            while len(self._items) > self.max_entries:
                self._items.popitem(last=False)


class CentralBudgetLedger:
    """PostgreSQL ledger: an advisory transaction lock serializes every host."""

    def __init__(self, session: Session, *, budget_usd: float, model: str) -> None:
        if not math.isfinite(budget_usd) or budget_usd <= 0:
            raise ValueError("budget_usd must be positive")
        self.session = session
        self.budget = Decimal(str(budget_usd))
        self.model = model

    def _lock(self) -> None:
        self.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": BUDGET_LOCK_KEY})

    def committed_usd(self) -> Decimal:
        total = self.session.scalar(
            select(
                func.coalesce(
                    func.sum(
                        func.coalesce(AssistantRequest.charged_usd, AssistantRequest.reserved_usd)
                    ),
                    0,
                )
            )
        )
        return Decimal(total or 0)

    def existing(self, request_id: str) -> AssistantRequest | None:
        return self.session.get(AssistantRequest, request_id)

    def reserve(self, request_id: str, amount_usd: float) -> ReserveOutcome:
        """Only 'reserved' authorizes a provider call; 'duplicate' must replay or wait."""

        amount = Decimal(str(amount_usd))
        if amount <= 0:
            raise ValueError("reserve amount must be positive")
        self._lock()
        if self.existing(request_id) is not None:
            self.session.commit()
            return "duplicate"
        if self.committed_usd() + amount > self.budget:
            self.session.commit()
            return "exceeded"
        self.session.execute(
            insert(AssistantRequest)
            .values(
                request_id=request_id,
                model=self.model,
                status="reserved",
                reserved_usd=amount,
            )
            .on_conflict_do_nothing(index_elements=["request_id"])
        )
        self.session.commit()
        return "reserved"

    def reconcile(
        self,
        request_id: str,
        *,
        actual_usd: float | None,
        input_tokens: int | None,
        output_tokens: int | None,
        response: dict[str, Any] | None,
    ) -> None:
        """Settle once. Unknown cost keeps the full reservation as charged."""

        self._lock()
        row = self.session.get(AssistantRequest, request_id, with_for_update=True)
        if row is None or row.status == "settled":
            self.session.commit()
            return
        if actual_usd is not None and (not math.isfinite(actual_usd) or actual_usd < 0):
            raise ValueError("cost must be finite and nonnegative")
        row.charged_usd = row.reserved_usd if actual_usd is None else Decimal(str(actual_usd))
        row.input_tokens = input_tokens
        row.output_tokens = output_tokens
        row.response = response
        row.status = "settled"
        row.settled_at = datetime.now(UTC)
        self.session.commit()


class GeminiHttpProvider:
    """Real provider. Construction fails unless calls were explicitly enabled."""

    provider_id = "gemini"

    def __init__(self, *, api_key: str, model: str, base_url: str, calls_enabled: bool) -> None:
        if not calls_enabled:
            raise LiveCallsDisabled("GEMINI_CALLS_ENABLED is false")
        if not api_key.strip():
            raise LiveCallsDisabled("GEMINI_API_KEY is not configured")
        if not base_url.startswith("https://"):
            raise LiveCallsDisabled("Gemini base URL must use HTTPS")
        self._api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    def generate(
        self, *, system: str, user: str, max_output_tokens: int, timeout_seconds: float
    ) -> Completion:
        body = json.dumps(
            {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": {
                    "maxOutputTokens": max_output_tokens,
                    "temperature": 0.2,
                    # Leave room for the visible answer after thinking tokens.
                    "thinkingConfig": {"thinkingBudget": 256},
                },
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/models/{self.model}:generateContent",
            data=body,
            method="POST",
            headers={"Content-Type": "application/json", "x-goog-api-key": self._api_key},
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                payload = json.loads(response.read(2_000_000))
        except urllib.error.HTTPError as error:
            raise ProviderFailure(f"http_{error.code}") from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise ProviderFailure("network_or_timeout") from None
        except (ValueError, json.JSONDecodeError):
            raise ProviderFailure("invalid_json") from None
        return parse_generate_content(payload)


def parse_generate_content(payload: object) -> Completion:
    """Validate the provider response at the boundary."""

    if not isinstance(payload, dict):
        raise ProviderFailure("invalid_shape")
    candidates = payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ProviderFailure("no_candidates")
    content = candidates[0].get("content") if isinstance(candidates[0], dict) else None
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list):
        raise ProviderFailure("no_parts")
    # Thinking models may return thought parts first; only visible text answers users.
    texts = [
        part.get("text")
        for part in parts
        if isinstance(part, dict) and part.get("thought") is not True
    ]
    answer = "".join(item for item in texts if isinstance(item, str)).strip()
    if not answer:
        # Fallback: some payloads omit the thought flag but still interleave scratch text.
        texts = [part.get("text") for part in parts if isinstance(part, dict)]
        answer = "".join(item for item in texts if isinstance(item, str)).strip()
    if not answer:
        raise ProviderFailure("empty_answer")
    usage = payload.get("usageMetadata")
    usage = usage if isinstance(usage, dict) else {}

    def count(key: str) -> int | None:
        value = usage.get(key)
        return value if isinstance(value, int) and value >= 0 else None

    prompt_tokens = count("promptTokenCount")
    output = count("candidatesTokenCount")
    thoughts = count("thoughtsTokenCount") or 0
    return Completion(
        text=answer,
        input_tokens=prompt_tokens,
        output_tokens=None if output is None else output + thoughts,
    )


class FakeTextProvider:
    """Identified test/demo provider. Never contacts Gemini."""

    provider_id = "fake"

    def __init__(self, *, text: str = "Respuesta de prueba [E1].", fail: bool = False) -> None:
        self.text = text
        self.fail = fail
        self.calls = 0

    def generate(
        self, *, system: str, user: str, max_output_tokens: int, timeout_seconds: float
    ) -> Completion:
        del system, max_output_tokens, timeout_seconds
        self.calls += 1
        if self.fail:
            raise ProviderFailure("fake_failure")
        return Completion(text=self.text, input_tokens=len(user) // 4, output_tokens=50)
