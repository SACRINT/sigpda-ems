/**
 * cascade-block-materials.ts
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Motor de persistencia en cascada para materiales derivados de Bloque:
 * 1. Extrae determinísticamente los 24 Planes de Clase, Rúbricas, Listas de Cotejo,
 *    Guía del Estudiante y Materiales Didácticos a partir del ActiveWorkTextbook (<5ms, 0 tokens).
 * 2. Persiste atómicamente cada recurso en la tabla `planning_extras` vinculado al `blockIndex`.
 * 3. Habilita visualización y descarga inmediata en las pestañas de Planes y Rúbricas.
 */

import { sql } from '@/lib/db';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { extractMaterialsFromWorkbook, type PlanDeClaseDerivado } from './material-extractor';

export interface CascadeResult {
  success: boolean;
  blockIndex: number;
  planesCount: number;
  extrasInserted: number;
  executionTimeMs: number;
  error?: string;
}

/**
 * Convierte un PlanDeClaseDerivado al formato Markdown estándar oficial de la DBEPA.
 */
function formatPlanDeClaseMarkdown(
  plan: PlanDeClaseDerivado,
  workbook: ActiveWorkTextbook
): string {
  const cover = workbook.coverData || ({} as any);
  const uacName = cover.subjectName || 'Formación Disciplinar';
  const semester = cover.semester || 1;

  return `# PLAN DE CLASE OFICIAL DBEPA · SESIÓN ${plan.numeroSesion}
**UAC:** ${uacName} | **Semestre:** ${semester}° | **Sesión:** ${plan.numeroSesion} de 24 (${plan.duracionMinutos} min)
**Título de la Sesión:** ${plan.tituloSesion}
**Propósito / Meta de Aprendizaje:** ${plan.propósitoOMeta}
**Transversalidad Comunitaria (PAEC):** ${plan.transversalidad}

---

## SECUENCIA DIDÁCTICA DE LA SESIÓN (50 MINUTOS)

### 1. Fase de Apertura (${plan.apertura.tiempoMinutos} min) — Activación y Recuperación
- **Rol del Docente:** ${plan.apertura.actividadDocente}
- **Rol del Estudiante:** ${plan.apertura.actividadEstudiante}
- **Saberes Previos y Conexión Intuitiva:** ${plan.apertura.saberesPrevios}

### 2. Fase de Desarrollo (${plan.desarrollo.tiempoMinutos} min) — Aprendizaje Pertinente y Modelado
- **Rol del Docente (Modelado y Acompañamiento):** ${plan.desarrollo.actividadDocente}
- **Rol del Estudiante (Práctica y Reto Autónomo):** ${plan.desarrollo.actividadEstudiante}
- **Metodología Activa Aplicada:** ${plan.desarrollo.metodologiaActiva}
- **Recursos e Insumos Didácticos:** ${plan.desarrollo.recursosDidacticos}

### 3. Fase de Cierre (${plan.cierre.tiempoMinutos} min) — Consolidación y Metacognición
- **Rol del Docente:** ${plan.cierre.actividadDocente}
- **Rol del Estudiante:** ${plan.cierre.actividadEstudiante}
- **Evaluación Formativa:** ${plan.cierre.evaluacionFormativa}
- **Pregunta Metacognitiva:** ${plan.cierre.metacognicion}

---

## EVALUACIÓN Y PRODUCTO ESPERADO
- **Evidencia Tangible de la Sesión:** ${plan.cierre.productoEsperado}
- **Instrumento de Evaluación Oficial:** ${plan.instrumentoEvaluacion}

---
*SIGPDA-EMS · Documento derivado en cascada del Cuaderno de Trabajo Activo (Bloque ${(workbook.blockIndex ?? 0) + 1})*
`;
}

/**
 * Ejecuta la cascada de derivación y persistencia de materiales para un bloque específico.
 */
export async function cascadeBlockMaterials(
  planningId: string,
  blockIndex: number,
  workbook: ActiveWorkTextbook,
  teacherId?: string
): Promise<CascadeResult> {
  const startTime = performance.now();

  try {
    const db = sql();

    // 1. Extraer materiales determinísticamente del Libro de Bloque
    const extracted = extractMaterialsFromWorkbook(workbook);
    const planes = extracted.planesDeClase || [];
    const blockNum = blockIndex + 1;
    const blockTitle = workbook.blockName || `Bloque ${blockNum}`;

    // 2. Limpiar registros previos generados automáticamente para este bloque
    // (Permite regeneración idempotente y limpia sin duplicar planes)
    await db`
      DELETE FROM planning_extras
      WHERE planning_id = ${planningId}::uuid
        AND key_index = ${blockIndex}
    `;

    let insertedCount = 0;

    // 3. Insertar los 24 Planes de Clase individuales
    for (const plan of planes) {
      const planTitle = `Plan de Clase: Sesión ${plan.numeroSesion} - ${plan.tituloSesion}`;
      const planMarkdown = formatPlanDeClaseMarkdown(plan, workbook);

      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'lesson_plan',
          ${planTitle},
          ${blockIndex},
          ${planMarkdown},
          NOW()
        )
      `;
      insertedCount++;
    }

    // 4. Insertar Rúbrica Analítica de Desempeño del Bloque
    if (extracted.instrumentosEvaluacion) {
      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'rubric',
          ${`Rúbrica Analítica de Evaluación · Bloque ${blockNum}: ${blockTitle}`},
          ${blockIndex},
          ${extracted.instrumentosEvaluacion},
          NOW()
        )
      `;
      insertedCount++;

      // Lista de Cotejo formativa vinculada al bloque
      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'checklist',
          ${`Lista de Cotejo Formativa · Bloque ${blockNum}: ${blockTitle}`},
          ${blockIndex},
          ${extracted.instrumentosEvaluacion},
          NOW()
        )
      `;
      insertedCount++;
    }

    // 5. Insertar Materiales Didácticos e Insumos del Docente del Bloque
    if (extracted.materialDidactico) {
      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'material',
          ${`Materiales Didácticos e Insumos del Docente · Bloque ${blockNum}: ${blockTitle}`},
          ${blockIndex},
          ${extracted.materialDidactico},
          NOW()
        )
      `;
      insertedCount++;
    }

    // 6. Insertar Guía de Aprendizaje Activo del Estudiante del Bloque
    if (extracted.guiaDelBloque) {
      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'practice_guide',
          ${`Guía de Trabajo Activo del Estudiante · Bloque ${blockNum}: ${blockTitle}`},
          ${blockIndex},
          ${extracted.guiaDelBloque},
          NOW()
        )
      `;
      insertedCount++;
    }

    const endTime = performance.now();
    const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

    console.log(
      `[cascadeBlockMaterials] ✅ Bloque ${blockIndex} sincronizado: ${planes.length} planes de clase y ${insertedCount} extras en ${executionTimeMs}ms.`
    );

    return {
      success: true,
      blockIndex,
      planesCount: planes.length,
      extrasInserted: insertedCount,
      executionTimeMs,
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error(`[cascadeBlockMaterials] ❌ Error en cascada del bloque ${blockIndex}:`, error);
    return {
      success: false,
      blockIndex,
      planesCount: 0,
      extrasInserted: 0,
      executionTimeMs: 0,
      error: errorMsg,
    };
  }
}
