-- Least-privilege roles for a production-like database. TEMPLATE: not executed.
-- Run as the database owner after `alembic upgrade head`, replacing passwords
-- through your secret manager (never commit them). Review before use.

-- Owns the schema and runs Alembic. Used only by the migration job.
CREATE ROLE cocha_migrator LOGIN PASSWORD :'migrator_password';
-- API process: reads everything, writes only the assistant budget ledger.
CREATE ROLE cocha_api LOGIN PASSWORD :'api_password';
-- Offline workers and operator scripts: write processing results as drafts.
CREATE ROLE cocha_worker LOGIN PASSWORD :'worker_password';

GRANT CONNECT ON DATABASE cocha TO cocha_api, cocha_worker;
GRANT USAGE ON SCHEMA public TO cocha_api, cocha_worker;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO cocha_api, cocha_worker;
GRANT INSERT, UPDATE ON assistant_requests TO cocha_api;

GRANT INSERT, UPDATE ON processing_runs, district_indicators, trend_results,
    model_runs, scenario_runs, stations, observations, assets TO cocha_worker;

-- Tables created by future migrations need explicit grants as well.
ALTER DEFAULT PRIVILEGES FOR ROLE cocha_migrator IN SCHEMA public
    GRANT SELECT ON TABLES TO cocha_api, cocha_worker;

-- Nobody but the migrator may change the schema or delete history.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
