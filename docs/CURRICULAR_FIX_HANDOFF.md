# SIGPDA-EMS: Hand-off Context & Execution Plan
## Fix Curricular Canónico MCCEMS (Paso 2 Planeaciones Didácticas)

**Fecha**: Septiembre 2026  
**Estado Actual**: Consenso unificado 100% alcanzado por el **Equipo de Ingeniería SACRINT** tras peer review.  
**Branch**: `main`  
**Git Status**: Clean. Últimos commits completaron con éxito las 6 fases del sistema unificado de documentos (Commits: `5aee616`, `5959d2f`, `4996fee`, `9c37850`, `b021ce8`, `5c4e4b9`). 34/34 test suites pasando (264 pruebas), 0 errores TypeScript.

---

### 1. Diagnóstico del Problema (Paso 2 del Wizard de Planeación)
Al seleccionar o cargar un programa canónico en el **Paso 2 (`StepPdfUpload.tsx`)**:
1. **Deshiphenization rota**: Palabras como `ló- gica` o `metodoló- gico` aparecen partidas con espacios por el `clean()` de Python que reemplazaba `\n` antes de evaluar guiones.
2. **Meta educativa (`learning_outcome`) truncada o narrativa previa**: `comb_text` tomaba texto de la página anterior como `"(ver tabla 1)"` en lugar de la meta real de la tabla de la página del semestre.
3. **Contenidos formativos duplicados**: El bucle `abs(ry - lg['y']) < 140` asignaba el mismo bloque de contenido a múltiples propósitos si estaban a ~110pt de distancia.
4. **Desfase en la UI de Step 2**: `StepPdfUpload.tsx` indexaba `formData.contenidosFormativos[idx]` posicionalmente. Si los propósitos no coincidían con el orden o sufrían reordenamiento, los temas quedaban bajo el propósito incorrecto. Además, `pdf-parser.ts` es server-side y no debe importarse en Client Components.
5. **Riesgo P0 de Purga en DB**: `scripts/sync-official-curriculum.mjs:247` tiene `DELETE WHERE subsystem != 'bge'`, lo que destruiría los 25 programas de Bachillerato Tecnológico (`tecnologico`).

---

### 2. Plan de Acción Unificado Aprobado (SACRINT)

#### Paso 1: Crear `src/lib/text-utils.ts` (Utilidad cliente/servidor compartida)
- Exportar función pura `removeHyphens(text: string): string` sin dependencias de Node.js (`fs`, `Buffer`).
- Reemplaza soft-hyphens `\u00ad` y unifica saltos de línea con guión.
- Actualizar `src/lib/pdf-parser.ts` para importar desde este módulo.

#### Paso 2: Ajustes en `src/components/planeacion/StepPdfUpload.tsx`
- Importar `removeHyphens` desde `@/lib/text-utils`.
- En el mapeo de `formData.activities`, hacer lookup defensivo de contenidos:
  ```typescript
  const currentCf = formData.contenidosFormativos?.find(cf => cf.order === a.order)
    || formData.contenidosFormativos?.[idx];
  const contenidos = currentCf?.contenidos || [];
  ```
- Aplicar `removeHyphens()` al renderizar los textos y temas para asegurar visualización limpia.

#### Paso 3: Salvaguarda P0 en `scripts/sync-official-curriculum.mjs`
- En línea 247, cambiar:
  ```sql
  DELETE FROM programs_catalog
  WHERE subsystem NOT IN ('bge', 'tecnologico')
  RETURNING id;
  ```
  Evita purgar las 25 carreras de Bachillerato Tecnológico al sincronizar BGE.

#### Paso 4: Corrección en `scripts/extract_all_canonical_curriculum.py`
1. **Deshiphenization pre-clean**:
   ```python
   def remove_line_hyphens(text):
       if not text: return ""
       text = text.replace("\u00ad", "")
       return re.sub(r'([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)-\s*[\r\n]+\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)', r'\1\2', text)
   ```
   Llamar a `remove_line_hyphens(t)` al inicio de `clean(t)` antes de reemplazar `\n` por espacios.
2. **Meta educativa real**: Priorizar la tabla de la página del semestre `p1` antes de buscar en narrativa de página previa.
3. **Voronoi 1D / Nearest Neighbor para Contenidos**:
   Para cada bloque de contenido `(ry, rtext)`, buscar el propósito más cercano en la misma página:
   ```python
   closest_lg = min(same_page_props, key=lambda lg: abs(lg['y'] - ry))
   closest_lg['conts'].extend(lines)
   ```
4. **Mapa Inline de Evidencias (`EVIDENCE_MAP`)**: Sin archivos JSON adicionales, mapeo contextualizado por área del conocimiento directamente en el script.

#### Paso 5: Re-ejecución y Sincronización
- Ejecutar extracción Python para regenerar `scripts/data/uacs_canonical_extracted.json`.
- Ejecutar `node scripts/sync-official-curriculum.mjs` de forma segura.

#### Paso 6: Verificación y Testing
- `npx tsc --noEmit` (0 errores)
- `npm test` (264+ pruebas pasando)
