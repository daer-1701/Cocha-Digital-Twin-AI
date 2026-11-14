from alembic import context
from cocha_api.core.config import get_settings
from cocha_api.db.models import Base
from cocha_api.db.session import get_engine


def include_object(obj, name, type_, reflected, compare_to):
    # PostGIS owns its own metadata tables; Alembic manages only application tables.
    if type_ == "table":
        return name in Base.metadata.tables
    return True


if context.is_offline_mode():
    context.configure(
        url=str(get_settings().database_url),
        target_metadata=Base.metadata,
        literal_binds=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    with get_engine().connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()
