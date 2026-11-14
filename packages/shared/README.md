# Contratos compartidos

La fuente de verdad es FastAPI/Pydantic. No editar manualmente `openapi.json` ni
`src/api.d.ts`. Desde la raíz:

```powershell
uv run python scripts/export_openapi.py
npm run contracts:generate
```

Versionar ambos archivos. CI verifica que coincidan con el backend. Los tipos de
TypeScript son contratos de compilación; validar también respuestas externas en
tiempo de ejecución cuando corresponda.
