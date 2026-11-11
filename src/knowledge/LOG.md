# LOG — Compilaciones de la Capa de Conocimiento SEP

Registro append-only de cada compilación/sincronización. Formato:

```
## YYYY-MM-DD · <slug>
- accion: created | updated | unchanged | rejected
- fuentes: <rutas crudas>
- sha256: <hash del contenido>
- modelo: <modelo usado o "determinista">
- revisor: <nombre o "pendiente">
```

---

## 2026-11-10 · Andamiaje F1
- Se crea la estructura base (`SCHEMA.md`, `wiki/`), el esquema Postgres
  (`knowledge_sources`, `knowledge_pages`, `knowledge_sync_log`) y el pipeline
  determinista `sync-knowledge.ts`.
- Sin páginas compiladas todavía (F2 pendiente).

## 2026-11-10 · Piloto normativo F2 (12 documentos)
- accion: created (12 páginas, `publicado=false`, `status: draft`)
- fuentes: `db:normativa_documentos/{2,5,8,34,44,47,55,60,61,62,68,93}`
- modelo: determinista (`deterministic-normateca-v1`)
- revisor: pendiente (revisión humana antes de `--publish`)
- Compilador: `scripts/ingest-knowledge.ts` (sin IA, costo $0) sobre
  `normativa_articulos`, con techo de ~1,500 tokens por página.
- Resultado: 12 creadas, 0 rechazadas; `knowledge_sources` y `source_ids`
  enlazados; `knowledge_sync_log` con 12 entradas `created`.

