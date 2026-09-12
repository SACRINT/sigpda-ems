import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { neon } from '@neondatabase/serverless';
import { logActivity } from '@/lib/ai-provider';
import { callGeminiPool } from '@/lib/gemini';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { getNormativaForGenerator, getStructuredNormativaForGenerator } from '@/lib/normativa-context';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { PmcDiagnosticoSchema, PmcPlanAccionSchema } from '@/lib/ai-schemas';

export const runtime = 'nodejs';
export const maxDuration = 120;

const sql = neon(process.env.DATABASE_URL!);

type RouteContext = { params: Promise<{ id: string }> };
type StepType = 'normativa' | 'diagnostico' | 'plan_accion';

// ─── Normativa dinámica desde BD (via normativa-context.ts) ──────────────────
// La normativa ya no es hardcodeada. Se lee de normativa_articulos en Neon.
// Fallback automático si la BD está vacía (ver getNormativaFallback en normativa-context.ts).

// ─── Helpers ─────────────────────────────────────────────────────────────────
function safeStr(val: unknown): string {
  if (val === null || val === undefined) return 'N/D';
  if (typeof val === 'string') return val || 'N/D';
  return String(val);
}

function parseJson<T = unknown>(val: unknown): T | Record<string, never> {
  if (!val) return {} as Record<string, never>;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return {} as Record<string, never>;
  }
}



// ─── Route ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;

    const [project] = await sql`
      SELECT *
      FROM pmc_projects
      WHERE id = ${id}
        AND teacher_id = ${teacher.id}
    `;

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const body = await request.json() as { step?: string };
    const step = body.step as StepType | undefined;

    if (!step || !['normativa', 'diagnostico', 'plan_accion'].includes(step)) {
      return NextResponse.json(
        { error: "El paso debe ser 'normativa', 'diagnostico' o 'plan_accion'" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const libraryContext = await getUserLibraryContext(teacher.email);

    // ── NORMATIVA (dinámica desde BD) ────────────────────────────────────────
    if (step === 'normativa') {
      // Lee artículos desde normativa_articulos; usa fallback si BD está vacía
      const normativaTexto = await getNormativaForGenerator('pmc');
      const normativaEstructurada = await getStructuredNormativaForGenerator('pmc');

      // Construye el objeto JSON que se guarda en pmc_projects.normativa
      // (mantiene la misma estructura que esperan el DOCX y el frontend)
      const normativaJson = {
        titulo: 'Marco Normativo',
        descripcion:
          'El presente Plan de Mejora Continua (PMC) se sustenta en el siguiente marco jurídico y normativo vigente para el Bachillerato General del Estado de Puebla (BGE), dependiente de la Dirección de Bachillerato y Educación Para Adultos (DBEPA).',
        // Bloque de texto completo para IA
        texto_normativo: normativaTexto,
        // Lista estructurada para DOCX y UI
        documentos: normativaEstructurada,
        // Metadatos de trazabilidad
        fuente: 'BD normativa_articulos — catálogo curado',
        generado_en: now,
      };

      const [updated] = await sql`
        UPDATE pmc_projects
        SET normativa = ${JSON.stringify(normativaJson)},
            current_step = GREATEST(current_step, 2),
            updated_at = ${now}
        WHERE id = ${id}
          AND teacher_id = ${teacher.id}
        RETURNING *
      `;
      return NextResponse.json({ success: true, step, data: normativaJson, project: updated });
    }

    // ── DIAGNÓSTICO ──────────────────────────────────────────────────────────
    if (step === 'diagnostico') {
      const indic = parseJson<{
        aprobacion_ant?: number;
        reprobacion_ant?: number;
        abandono_ant?: number;
        et_ant?: number;
        aprobacion_meta?: number;
        abandono_meta?: number;
        et_meta?: number;
        matricula?: number;
      }>(project.indicadores_academicos);

      const foda = parseJson<{
        fortalezas?: string;
        oportunidades?: string;
        debilidades?: string;
        amenazas?: string;
      }>(project.foda);

      const prompt = `Eres un experto en gestión directiva de planteles de Bachillerato General del Estado de Puebla (BGE), alineado a los Lineamientos para la Planeación de la Mejora Continua 2025-2026 de la DBEPA.

${libraryContext}

Con base en la siguiente información del plantel "${safeStr(project.school_name)}" (CCT: ${safeStr(project.school_cct)}), ubicado en ${safeStr(project.locality)}, municipio de ${safeStr(project.municipality)}, Puebla:

Contexto comunitario:
${safeStr(project.diagnostico_comunidad)}

Indicadores académicos del ciclo anterior:
- Aprobación: ${indic.aprobacion_ant ?? 'N/D'}%
- Reprobación: ${indic.reprobacion_ant ?? 'N/D'}%
- Abandono escolar: ${indic.abandono_ant ?? 'N/D'}%
- Eficiencia terminal: ${indic.et_ant ?? 'N/D'}%

Metas para el ciclo ${safeStr(project.ciclo_escolar)}:
- Aprobación: ${indic.aprobacion_meta ?? 'N/D'}%
- Abandono: ${indic.abandono_meta ?? 'N/D'}%
- Eficiencia terminal: ${indic.et_meta ?? 'N/D'}%

Matrícula: ${indic.matricula ?? 'N/D'} alumnos

FODA del plantel:
- Fortalezas: ${safeStr(foda.fortalezas)}
- Oportunidades: ${safeStr(foda.oportunidades)}
- Debilidades: ${safeStr(foda.debilidades)}
- Amenazas: ${safeStr(foda.amenazas)}

Genera el apartado de DIAGNÓSTICO del PMC con:
1. presentacion: (texto de presentación del PMC, 2-3 párrafos, mención a NEM y MCCEMS, qué es el PMC y su importancia)
2. contexto: (narrativa del contexto comunitario y del plantel, 2-3 párrafos con datos reales proporcionados)
3. analisis_indicadores: (análisis interpretativo de los indicadores académicos con datos numéricos, justificación de metas, 2-3 párrafos)
4. sintesis_foda: (síntesis del FODA en 2 párrafos: áreas de fortaleza y áreas de oportunidad detectadas)
5. priorizacion: (narrativa de priorización de problemas para el ciclo, 1-2 párrafos)

Responde con JSON con exactamente estas 5 claves. Texto formal y técnico. NO inventes datos no proporcionados.`;

      const rawText = await callGeminiPool(
        'Eres un asistente experto en planeación educativa para el BGE de Puebla. Responde siempre con JSON válido y bien formado.',
        prompt,
        teacher.id
      );
      if (!rawText) {
        throw new Error('Respuesta vacía del proveedor de IA');
      }

      const parseResult = parseAIResponse(rawText, PmcDiagnosticoSchema, { contextName: 'pmc_diagnostico' });
      if (!parseResult.success) {
        console.error('Failed to parse PMC diagnostico:', parseResult.error);
        return NextResponse.json(
          { error: `Error al validar estructura de diagnóstico PMC: ${parseResult.error}` },
          { status: 500 }
        );
      }
      const parsedDiag = parseResult.data;

      const [updated] = await sql`
        UPDATE pmc_projects
        SET diagnostico_generado = ${JSON.stringify(parsedDiag)},
            current_step = GREATEST(current_step, 3),
            updated_at = ${now}
        WHERE id = ${id}
          AND teacher_id = ${teacher.id}
        RETURNING *
      `;
      await logActivity({ teacherEmail: teacher.email, action: 'generate_pmc_diagnostico', entityType: 'pmc', entityId: id, success: true });
      return NextResponse.json({ success: true, step, diagnostico_generado: parsedDiag, project: updated });
    }

    // ── PLAN DE ACCIÓN ───────────────────────────────────────────────────────
    if (step === 'plan_accion') {
      const indic = parseJson<{
        aprobacion_ant?: number;
        reprobacion_ant?: number;
        abandono_ant?: number;
        et_ant?: number;
        aprobacion_meta?: number;
        abandono_meta?: number;
        et_meta?: number;
      }>(project.indicadores_academicos);

      const diagnosticoGenerado = parseJson<Record<string, string>>(project.diagnostico_generado);
      const diagnosticoResumen = [
        diagnosticoGenerado.presentacion ?? '',
        diagnosticoGenerado.contexto ?? '',
        diagnosticoGenerado.analisis_indicadores ?? '',
      ]
        .filter(Boolean)
        .join('\n\n')
        .substring(0, 2000);

      // Parse the new CategoriaPriorizada[] format (with temas)
      interface CategoriaPriorizadaAPI {
        id?: string;
        nombre?: string;
        temas?: string[];
      }
      const rawCategorias = parseJson<CategoriaPriorizadaAPI[]>(project.categorias_priorizadas);
      const categoriasList = Array.isArray(rawCategorias)
        ? rawCategorias
            .map((c) => {
              const nombre = c.nombre ?? `Categoría ${c.id}`;
              const temas = Array.isArray(c.temas) && c.temas.length > 0
                ? c.temas.map((t) => `    • ${t}`).join('\n')
                : '    • (sin temas específicos)';
              return `- ${nombre}:\n${temas}`;
            })
            .join('\n')
        : 'No especificadas';

      // Count total temas for proper instruction
      const totalTemas = Array.isArray(rawCategorias)
        ? rawCategorias.reduce((sum, c) => sum + (Array.isArray(c.temas) ? c.temas.length : 0), 0)
        : 0;

      const staffData = parseJson<{ nombre?: string; cargo?: string }[]>(project.staff_data);
      const staffList = Array.isArray(staffData)
        ? staffData.map((s) => `- ${s.nombre ?? 'N/D'} — ${s.cargo ?? 'N/D'}`).join('\n')
        : 'No especificado';

      const prompt = `Eres un evaluador y planeador experto en la Mejora Continua para planteles BGE/TBC de Puebla bajo los LINEAMIENTOS DBEPA 2025-2026.

${libraryContext}

CONTEXTO DEL PLANTEL:
- Nombre: ${safeStr(project.school_name)} | CCT: ${safeStr(project.school_cct)} | Ciclo: ${safeStr(project.ciclo_escolar)}
- Director(a): ${safeStr(project.director_name)}
- Municipio: ${safeStr(project.municipality)}, ${safeStr(project.locality)}

DIAGNÓSTICO GENERADO:
${diagnosticoResumen}

INDICADORES OFICIALES:
- Abandono: ${indic.abandono_ant ?? 'N/D'}% → Meta: ${indic.abandono_meta ?? 'N/D'}%
- Aprobación: ${indic.aprobacion_ant ?? 'N/D'}% → Meta: ${indic.aprobacion_meta ?? 'N/D'}%
- Eficiencia terminal: ${indic.et_ant ?? 'N/D'}% → Meta: ${indic.et_meta ?? 'N/D'}%

CATEGORÍAS Y TEMAS PRIORIZADOS POR EL DIRECTOR:
${categoriasList}

PERSONAL DEL PLANTEL (${project.total_staff ?? 0} trabajadores):
${staffList}

═══════════════════════════════════════════
CRITERIOS DE EXCELENCIA DE LA SUPERVISIÓN (DBEPA):
═══════════════════════════════════════════

1. COHERENCIA MATEMÁTICA Y ESTADÍSTICA:
   - La 'linea_base' de cada meta DEBE coincidir exactamente con los valores porcentuales del diagnóstico anterior.
   - El objetivo planteado en 'meta' DEBE guardar una proporción matemática lógica con la línea base (ej. si la aprobación es del 78%, la meta debe ser incrementarla al 85%, no poner números incongruentes).

2. VINCULACIÓN EXPLÍCITA DEL FODA:
   - En 'diagnostico_meta' y en 'estrategia', menciona explícitamente qué Fortaleza, Oportunidad, Debilidad o Amenaza específica detectada en el FODA se está atendiendo.

3. ENTREGABLES TÉCNICOS CUALITATIVOS (NO EVIDENCIAS SUPERFICIALES):
   - Cada 'entregable' DEBE ser un instrumento técnico con análisis cualitativo. Ejemplos válidos: "Informe bimestral de seguimiento con análisis cualitativo de causas raíz de reprobación", "Bitácora de acompañamiento tutoral con matriz de riesgo", "Convenio formal de colaboración institucional con plan de trabajo". NUNCA solo "listas de asistencia" ni "fotografías".

4. HITOS DE EVALUACIÓN PARCIAL Y ALERTAS TEMPRANAS:
   - Incluye dentro de las estrategias puntos de corte o reportes de alertas tempranas (ej. en la semana 6 y 12 del semestre) antes de los periodos críticos de evaluación.

5. METAS SMART ESTRUCTURADAS (1 POR CADA TEMA PRIORIZADO):
   - Genera EXACTAMENTE UNA meta institucional por cada TEMA seleccionado (Total: ${totalTemas} metas institucionales).
   - Estructura SMART: Verbo de acción en infinitivo + objeto/área de enfoque + indicador porcentual o numérico exacto + plazo definido + medio o estrategia clave.

6. METAS INDIVIDUALES POR CARGO:
   - Una meta individual SMART por cada uno de los ${project.total_staff ?? 0} trabajadores listados, acorde a su función específica (Director, Docente, Orientador, etc.) y con su entregable cualitativo correspondiente.

Responde con JSON con esta estructura EXACTA:
{
  "metas_institucionales": [
    {
      "categoria": "1",
      "nombre_categoria": "Categoría 1: Desarrollo académico y aprendizaje",
      "tema": "Nombre exacto del tema seleccionado",
      "diagnostico_meta": "Problemática y hallazgo FODA específico que justifica esta meta...",
      "meta": "Verbo en infinitivo + qué + indicador cuantitativo exacto + plazo. Ej: Reducir la reprobación del 15% al 8% al término del ciclo 2025-2026 mediante tutorías focalizadas en semanas 6 y 12.",
      "estrategia": "1. Acción concreta con hito de alerta temprana. 2. Acción vinculada a debilidad FODA. 3. Acción de evaluación cualitativa.",
      "linea_base": "Valor actual del indicador (% o cifra exacta coincidente con el diagnóstico)",
      "personal_designado": "Nombre — Cargo",
      "entregable": "Documento técnico cualitativo de evidencia (ej. Informe de seguimiento con análisis de causas raíz)",
      "periodo_inicio": "08/2025",
      "periodo_fin": "06/2026"
    }
  ],
  "metas_personales": [
    {
      "nombre": "Nombre del trabajador",
      "cargo": "Cargo exacto",
      "meta_individual": "Meta SMART específica para su función con verbo + indicador + plazo",
      "estrategia": "Acciones concretas que ejecutará este trabajador",
      "entregable": "Documento o informe cualitativo de evidencia que entregará",
      "periodo": "agosto 2025 - junio 2026"
    }
  ]
}`;

      const rawText = await callGeminiPool(
        'Eres un asistente experto en planeación educativa para el BGE de Puebla. Responde siempre con JSON válido y bien formado. Nunca omitas metas institucionales para los temas indicados.',
        prompt,
        teacher.id
      );
      if (!rawText) {
        throw new Error('Respuesta vacía del proveedor de IA');
      }

      const parseResult = parseAIResponse(rawText, PmcPlanAccionSchema, { contextName: 'pmc_plan_accion' });
      if (!parseResult.success) {
        console.error('Failed to parse PMC plan_accion:', parseResult.error);
        return NextResponse.json(
          { error: `Error al validar estructura de plan de acción PMC: ${parseResult.error}` },
          { status: 500 }
        );
      }
      const parsedPlan = parseResult.data;

      const [updated] = await sql`
        UPDATE pmc_projects
        SET plan_accion = ${JSON.stringify(parsedPlan)},
            current_step = GREATEST(current_step, 4),
            updated_at = ${now}
        WHERE id = ${id}
          AND teacher_id = ${teacher.id}
        RETURNING *
      `;
      await logActivity({ teacherEmail: teacher.email, action: 'generate_pmc_plan_accion', entityType: 'pmc', entityId: id, success: true });
      return NextResponse.json({ success: true, step, plan_accion: parsedPlan, project: updated });
    }

    return NextResponse.json({ error: 'Paso no reconocido' }, { status: 400 });
  } catch (error) {
    console.error('PMC generate-step error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

