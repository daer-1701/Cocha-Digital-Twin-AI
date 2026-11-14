"""Processing-run lifecycle for offline workers. No queue and no HTTP execution.

States: queued -> running -> completed | failed | interrupted. A failed or
interrupted run with the same idempotency key is retried in place while
attempt < max_attempts. Completed runs are never re-executed. 'recorded' is the
legacy label from register_processing_run and is treated as terminal.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal
from uuid import UUID, uuid4

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from cocha_api.db.models import ProcessingRun

TERMINAL = frozenset({"completed", "recorded"})
RETRYABLE = frozenset({"failed", "interrupted"})
StartDecision = Literal["started", "retrying", "already_completed", "already_running", "exhausted"]


@dataclass(frozen=True)
class StartOutcome:
    decision: StartDecision
    run_id: UUID
    attempt: int

    @property
    def should_execute(self) -> bool:
        return self.decision in {"started", "retrying"}


def idempotency_key(kind: str, *parts: str) -> str:
    digest = hashlib.sha256("\x1f".join((kind, *parts)).encode("utf-8")).hexdigest()
    return f"{kind}:{digest[:48]}"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def _is_stale(run: ProcessingRun, now: datetime, stale_after: timedelta) -> bool:
    beat = run.heartbeat_at or run.started_at
    return beat is None or now - beat > stale_after


def start_run(
    session: Session,
    *,
    kind: str,
    key: str,
    parameters: dict[str, Any] | None = None,
    git_commit: str | None = None,
    environment_version: str | None = None,
    notes: str | None = None,
    max_attempts: int = 3,
    stale_after: timedelta = timedelta(hours=1),
) -> StartOutcome:
    """Claim a run for this key and commit the decision before any work starts."""

    if max_attempts < 1:
        raise ValueError("max_attempts must be positive")
    now = _now()
    existing = session.scalars(
        select(ProcessingRun).where(ProcessingRun.idempotency_key == key).with_for_update()
    ).one_or_none()
    if existing is None:
        run = ProcessingRun(
            id=uuid4(),
            kind=kind,
            status="running",
            idempotency_key=key,
            attempt=1,
            git_commit=git_commit,
            environment_version=environment_version,
            parameters=parameters,
            started_at=now,
            heartbeat_at=now,
            notes=notes,
        )
        session.add(run)
        try:
            session.commit()
        except IntegrityError:
            # Another worker inserted the same key first; re-evaluate its row.
            session.rollback()
            return start_run(
                session,
                kind=kind,
                key=key,
                parameters=parameters,
                git_commit=git_commit,
                environment_version=environment_version,
                notes=notes,
                max_attempts=max_attempts,
                stale_after=stale_after,
            )
        return StartOutcome("started", run.id, 1)

    if existing.status in TERMINAL:
        session.rollback()
        return StartOutcome("already_completed", existing.id, existing.attempt)
    if existing.status in {"running", "queued"} and not _is_stale(existing, now, stale_after):
        session.rollback()
        return StartOutcome("already_running", existing.id, existing.attempt)
    if existing.attempt >= max_attempts:
        if existing.status == "running":
            existing.status = "interrupted"
            existing.error_code = "stale_heartbeat"
            existing.finished_at = now
            session.commit()
        else:
            session.rollback()
        return StartOutcome("exhausted", existing.id, existing.attempt)
    existing.attempt += 1
    existing.status = "running"
    existing.error_code = None
    existing.started_at = now
    existing.heartbeat_at = now
    existing.finished_at = None
    if parameters is not None:
        existing.parameters = parameters
    session.commit()
    return StartOutcome("retrying", existing.id, existing.attempt)


def heartbeat(session: Session, run_id: UUID) -> None:
    session.execute(
        update(ProcessingRun)
        .where(ProcessingRun.id == run_id, ProcessingRun.status == "running")
        .values(heartbeat_at=_now())
    )
    session.commit()


def finish_run(
    session: Session,
    run_id: UUID,
    *,
    status: Literal["completed", "failed"],
    error_code: str | None = None,
    parameters: dict[str, Any] | None = None,
    notes: str | None = None,
) -> None:
    """Close a running run. Error codes are short labels, never raw exception text."""

    run = session.get(ProcessingRun, run_id, with_for_update=True)
    if run is None or run.status != "running":
        session.rollback()
        raise RuntimeError("Run is not running; it may have been marked interrupted")
    run.status = status
    run.error_code = error_code if status == "failed" else None
    run.finished_at = _now()
    run.heartbeat_at = run.finished_at
    if parameters is not None:
        run.parameters = parameters
    if notes is not None:
        run.notes = notes
    session.commit()


def recover_stale(
    session: Session, *, stale_after: timedelta, apply: bool, now: datetime | None = None
) -> list[UUID]:
    """List (or mark) running runs whose heartbeat expired as interrupted."""

    moment = now or _now()
    threshold = moment - stale_after
    stale = (
        ProcessingRun.status == "running",
        or_(
            ProcessingRun.heartbeat_at < threshold,
            ProcessingRun.heartbeat_at.is_(None) & (ProcessingRun.started_at < threshold),
            ProcessingRun.heartbeat_at.is_(None) & ProcessingRun.started_at.is_(None),
        ),
    )
    ids = list(session.scalars(select(ProcessingRun.id).where(*stale).with_for_update()))
    if apply and ids:
        session.execute(
            update(ProcessingRun)
            .where(ProcessingRun.id.in_(ids), ProcessingRun.status == "running")
            .values(status="interrupted", error_code="stale_heartbeat", finished_at=moment)
        )
        session.commit()
    else:
        session.rollback()
    return ids


def publish_file(temporary: Path, destination: Path) -> str:
    """Publish a finished artifact atomically and return its SHA-256.

    The temporary file must live on the same filesystem. An existing destination
    with the same checksum makes the call idempotent; a different one is refused.
    """

    if temporary.parent.resolve() != destination.parent.resolve():
        raise ValueError("temporary and destination must share a directory")
    # Windows rejects fsync on read-only handles.
    with temporary.open("r+b") as handle:
        os.fsync(handle.fileno())
    checksum = file_sha256(temporary)
    if destination.exists():
        if file_sha256(destination) == checksum:
            temporary.unlink()
            return checksum
        raise FileExistsError(f"{destination.name} exists with a different checksum")
    # A hard link fails if the destination appeared meanwhile; replace() would overwrite it.
    os.link(temporary, destination)
    temporary.unlink()
    return checksum
