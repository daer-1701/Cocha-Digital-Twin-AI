from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from cocha_api.db.models import Dataset
from cocha_api.db.session import get_session
from cocha_api.schemas.catalog import DatasetResponse

router = APIRouter(prefix="/v1/datasets", tags=["datasets"])


@router.get("", response_model=list[DatasetResponse])
def list_datasets(
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    query = select(Dataset).order_by(Dataset.created_at, Dataset.id).limit(limit).offset(offset)
    return session.scalars(query).all()
