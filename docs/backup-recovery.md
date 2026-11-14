# Backup, restauración y recuperación (EF10)

Actualizado: **14 de noviembre de 2026**. Responsable: Eduardo.

## Herramienta

`scripts/database_archive.py`

| Comando | Comportamiento |
| --- | --- |
| `backup <destino.dump>` | `pg_dump` custom vía Compose; manifiesto `.json` con SHA-256; no sobrescribe |
| `restore <archivo> --database xxx_restore_test` | Solo DB nueva con sufijo `_restore_test`; verifica checksum |

Los dumps pueden contener datos municipales restringidos: fuera de Git
(`.gitignore`: `*.dump`, `*.backup`), permisos de archivo restringidos.

## Ensayo ejecutado (14/11/2026)

Host port **5434** (`compose.yaml`; 5432 estaba ocupado). Tras importar MÓNICA:

```powershell
python scripts/database_archive.py backup data/backups/cocha-20261114.dump
python scripts/database_archive.py restore data/backups/cocha-20261114.dump --database cocha_restore_test
```

Verificado en `cocha_restore_test`:

| Chequeo | Resultado |
| --- | --- |
| PostGIS | 3.5.2 |
| Alembic | `0002` |
| stations | 2 (kanata, semapa) |
| observations | 54 711 + 71 154 |
| processing_runs | `monica_pm10_import` / `completed` |

Manifiesto: `data/backups/cocha-20261114.dump.json` con
`restoration_verified: true`.

## Retención y copia externa

| Política | Valor propuesto |
| --- | --- |
| Retención local de dumps de ensayo | 14 días o 3 versiones |
| Copia externa | Almacén del equipo (no Git); cifrado en tránsito/reposo según política municipal |
| Originales MÓNICA / Landsat | Conservar junto al dump o en el mismo almacén versionado |
| Producción | No aplica todavía (`docs/a18-operations.md`, `docs/deployment.md`) |

## Evidencia para Andrés/Julio

Entregar: ruta del dump (sin secretos), manifiesto SHA-256, nombre de la DB
`_restore_test`, conteos y fecha. Julio revisa el informe; no necesita Docker.
