# Scripts Archivados de Migración y Sembrado Curricular (Legacy)

Este directorio contiene los scripts utilitarios, de prueba e intentos previos de sembrado y enriquecimiento que se utilizaron durante las fases tempranas del proyecto.

## Motivo del Archivado (Consolidación Canónica)

1. **Eliminación de Contenido Sintético (Mocks):** Scripts como `deep-enrich-catalog.mjs` contenían datos estáticos que no correspondían a los programas oficiales de la SEP (por ejemplo, temas erróneos de trigonometría en *Pensamiento Matemático III*).
2. **Duplicación Redundante:** Varios scripts clonaban las mismas UACs para 7 subsistemas distintos (`bge`, `digital`, `emsad`, etc.), inflando la base de datos a más de 700 registros con copias innecesarias.
3. **Falta de Extracción Multi-UAC:** Scripts anteriores procesaban únicamente archivos individuales o dependían de expresiones regulares heurísticas frágiles.

## Script Canónico Oficial

A partir de esta versión, la **única fuente y herramienta oficial** de ingesta, saneamiento y sincronización curricular es:

```bash
npx tsx scripts/sync-official-curriculum.ts
```

Este script ejecuta:
- Respaldo de seguridad en base de datos.
- Extracción fidedigna de los libros y programas oficiales multi-UAC de la SEP (`documentos_referencia/[02] Programas_de_Estudio BG`).
- Purga controlada de registros sintéticos.
- Validación cruzada contra `scripts/data/uacs_master_203.json`.
- Reporte detallado de estado en `scratch/curacion_report.txt`.
