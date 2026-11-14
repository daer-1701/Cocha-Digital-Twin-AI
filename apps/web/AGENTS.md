# Frontend

Aplicar también `AGENTS.md` de la raíz.

- Usar Next.js App Router y Server Components por defecto; `use client` solo
  donde se necesiten interacción o APIs del navegador.
- Las dependencias de mapas que requieren WebGL/DOM deben quedar en un límite
  cliente y liberar listeners, mapas y recursos al desmontarse.
- Conservar clientes internos de API y claves en módulos `server-only`.
- Importar contratos desde `@cocha/shared`; los tipos no sustituyen validación
  en runtime para proveedores externos.
- Mostrar carga, error, vacío y datos parciales. Indicar fuente, unidad,
  período y naturaleza observada/estimada/simulada de cada indicador.
- Mapas con leyenda, escala de color consistente, período visible y alternativa
  textual o tabular. Evitar diferencias visuales causadas solo por autoescalado.
- Priorizar contraste, teclado, etiquetas y responsive sobre efectos 3D.
- No dibujar distritos aproximados como límites oficiales ni rellenar gráficos
  con datos inventados. No añadir bibliotecas de gráficos o estado sin uso real.
- Para cambios de interacción revisar el flujo en navegador cuando esté
  disponible. Documentar lo que no se pudo comprobar.
