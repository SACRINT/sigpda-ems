import { z } from 'zod';
import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { logger } from '@/lib/logger';
import type {
  AjustesDUA,
  DUACategoria,
  DUAAdjustment,
  GeneratedPlanningContent,
} from '@/types/planning';

export const DUA_CATEGORIAS: DUACategoria[] = [
  'bap_sensorial',
  'bap_motriz',
  'ritmos_rezago',
  'sobresalientes',
];

export const DUA_CATEGORIA_LABELS: Record<DUACategoria, string> = {
  bap_sensorial: 'BAP sensorial',
  bap_motriz: 'BAP motriz',
  ritmos_rezago: 'Ritmos diferenciados y rezago',
  sobresalientes: 'Enriquecimiento para sobresalientes',
};

const DUA_SCHEMA = z.object({
  resumen: z.string().min(10),
  ajustes: z.array(
    z.object({
      categoria: z.string().min(3),
      titulo: z.string().min(5),
      descripcion: z.string().min(20),
      estrategias: z.array(z.string().min(5)).min(2),
      evaluacionDiferenciada: z.string().min(10),
      recursos: z.array(z.string().min(2)).min(1),
    })
  ).min(1),
});

type DUAIAOutput = z.infer<typeof DUA_SCHEMA>;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCategoria(raw: string): DUACategoria | null {
  const value = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_');

  if (value.includes('sensorial') || value.includes('visual') || value.includes('auditiv')) {
    return 'bap_sensorial';
  }
  if (value.includes('motriz') || value.includes('motor') || value.includes('fisic')) {
    return 'bap_motriz';
  }
  if (value.includes('rezago') || value.includes('ritmo') || value.includes('ritmos')) {
    return 'ritmos_rezago';
  }
  if (value.includes('sobresaliente') || value.includes('enriquecimiento') || value.includes('alta_capacidad')) {
    return 'sobresalientes';
  }
  return null;
}

function planningSummary(content: GeneratedPlanningContent): string {
  const s1 = content.sectionI;
  const s2 = content.sectionII;
  const s4 = content.sectionIV;
  return JSON.stringify({
    uac: s1?.uacName,
    semester: s1?.semester,
    component: s1?.component,
    subsystem: s1?.subsystem,
    groups: s1?.groups,
    purpose: s2?.purpose,
    learningOutcomes: s2?.learningOutcomes,
    paecConnection: s2?.paecConnection,
    reto: s2?.retoSituado,
    diagnostico3D: s2?.diagnosticoSituado3D,
    activities: (s4?.activities || []).map((act) => ({
      name: act.name,
      hours: act.hours,
      methodology: act.methodology,
      apertura: act.apertura?.activities,
      ejecucion: act.ejecucion?.activities,
      conclusion: act.conclusion?.activities,
      saberes: act.saberes,
    })),
  }).slice(0, 9000);
}

export function buildDeterministicDUA(
  content: GeneratedPlanningContent,
  categorias: DUACategoria[] = DUA_CATEGORIAS
): AjustesDUA {
  const uac = asText(content.sectionI?.uacName) || 'la UAC';
  const diagnostico = content.sectionII?.diagnosticoSituado3D;
  const aula = asText(diagnostico?.dimensionAulaEdiems);

  const base: Record<DUACategoria, DUAAdjustment> = {
    bap_sensorial: {
      id: 'dua-bap-sensorial',
      categoria: 'bap_sensorial',
      titulo: 'Acceso multimodal a la información',
      descripcion: `Presentar las consignas, textos y evidencias de ${uac} por más de un canal (visual, auditivo y textual), eliminando barreras de percepción y comprensión.`,
      estrategias: [
        'Entregar instrucciones escritas con apoyo de iconos, esquemas o subtítulos.',
        'Leer en voz alta las consignas y verificar comprensión con preguntas de parafraseo.',
        'Ofrecer versiones ampliadas, con alto contraste o en formato digital accesible.',
      ],
      evaluacionDiferenciada:
        'Permitir que la evidencia se demuestre mediante exposición oral, esquema visual, audio o texto escrito.',
      recursos: ['Guía impresa con apoyos visuales', 'Versión digital accesible', 'Esquemas y organizadores gráficos'],
    },
    bap_motriz: {
      id: 'dua-bap-motriz',
      categoria: 'bap_motriz',
      titulo: 'Ajustes de espacio, instrumentos y participación motriz',
      descripcion: `Adaptar el espacio, los materiales y las formas de participación en ${uac} para que el estudiantado con barreras motrices pueda ejecutar las actividades con autonomía y seguridad.`,
      estrategias: [
        'Organizar estaciones de trabajo con rutas accesibles y mobiliario ajustable.',
        'Sustituir tareas de motricidad fina por alternativas con apoyo de herramientas o pares.',
        'Flexibilizar tiempos de ejecución y permitir pausas activas.',
      ],
      evaluacionDiferenciada:
        'Valorar el proceso y el producto con una rúbrica que priorice la comprensión y la ejecución asistida.',
      recursos: ['Mobiliario accesible', 'Herramientas de apoyo', 'Rutas y señalización en el aula'],
    },
    ritmos_rezago: {
      id: 'dua-ritmos-rezago',
      categoria: 'ritmos_rezago',
      titulo: 'Dosificación por tramos y acompañamiento al rezago',
      descripcion: `Fragmentar el reto de ${uac} en metas cortas y verificables, con apoyos escalonados para estudiantes que requieren más tiempo o que presentan rezago académico.${aula ? ` Considerar la línea base descrita: ${aula}` : ''}`,
      estrategias: [
        'Dividir la actividad en pasos con listas de cotejo y fechas intermedias.',
        'Activar tutoría entre pares y monitoreo breve al cierre de cada tramo.',
        'Ofrecer material de refuerzo y una segunda oportunidad de entrega.',
      ],
      evaluacionDiferenciada:
        'Aplicar evaluación formativa continua con retroalimentación específica y criterios de logro por tramo.',
      recursos: ['Lista de cotejo por pasos', 'Material de refuerzo', 'Bitácora de avance'],
    },
    sobresalientes: {
      id: 'dua-sobresalientes',
      categoria: 'sobresalientes',
      titulo: 'Enriquecimiento y profundización del reto',
      descripcion: `Ampliar el reto de ${uac} con extensiones de mayor complejidad, investigación autónoma y transferencia a nuevos contextos para estudiantes con aptitudes sobresalientes.`,
      estrategias: [
        'Proponer una variante del producto con mayor nivel de abstracción o alcance comunitario.',
        'Habilitar una línea de indagación autónoma con mentoría docente.',
        'Solicitar la transferencia del aprendizaje a un problema distinto al del aula.',
      ],
      evaluacionDiferenciada:
        'Evaluar la profundidad, originalidad y transferencia mediante una rúbrica de enriquecimiento.',
      recursos: ['Rúbrica de profundización', 'Fuentes de consulta especializada', 'Espacio de mentoría'],
    },
  };

  return {
    generadoEn: new Date().toISOString(),
    fuente: 'determinista',
    resumen: `Ajustes razonables DUA para ${uac}, organizados en cuatro dimensiones de atención a la diversidad.`,
    ajustes: categorias.map((categoria) => base[categoria]),
  };
}

function normalizeAIOutput(
  data: DUAIAOutput,
  content: GeneratedPlanningContent,
  categorias: DUACategoria[]
): AjustesDUA {
  const fallback = buildDeterministicDUA(content, categorias);
  const fallbackByCategory = new Map(fallback.ajustes.map((ajuste) => [ajuste.categoria, ajuste]));
  const seen = new Set<DUACategoria>();

  const ajustes: DUAAdjustment[] = [];
  for (const raw of data.ajustes) {
    const categoria = normalizeCategoria(raw.categoria);
    if (!categoria || !categorias.includes(categoria) || seen.has(categoria)) continue;
    seen.add(categoria);
    ajustes.push({
      id: `dua-${categoria}`,
      categoria,
      titulo: raw.titulo.trim(),
      descripcion: raw.descripcion.trim(),
      estrategias: raw.estrategias.map((item) => item.trim()).filter(Boolean),
      evaluacionDiferenciada: raw.evaluacionDiferenciada.trim(),
      recursos: raw.recursos.map((item) => item.trim()).filter(Boolean),
    });
  }

  for (const categoria of categorias) {
    if (!seen.has(categoria)) {
      const fallbackAdjustment = fallbackByCategory.get(categoria);
      if (fallbackAdjustment) ajustes.push(fallbackAdjustment);
    }
  }

  return {
    generadoEn: new Date().toISOString(),
    fuente: 'ia',
    resumen: data.resumen.trim(),
    ajustes,
  };
}

export async function generateDUAWithAI(params: {
  content: GeneratedPlanningContent;
  teacherId?: string;
  isPremium?: boolean;
  categorias?: DUACategoria[];
}): Promise<{ ajustesDUA: AjustesDUA; warning?: string }> {
  const categorias = params.categorias?.length ? params.categorias : DUA_CATEGORIAS;
  const fallback = buildDeterministicDUA(params.content, categorias);

  const systemPrompt = `Eres especialista en Diseño Universal para el Aprendizaje (DUA) y educación inclusiva en el Bachillerato General Estatal de Puebla (MCCEMS 2026-2027).
Genera ajustes razonables concretos, realistas y aplicables en aula para la planeación proporcionada.
No inventes diagnósticos clínicos ni etiquetes al estudiantado. Usa lenguaje pedagógico, respetuoso y centrado en eliminar barreras.
Responde ÚNICAMENTE con JSON válido, sin markdown, con esta estructura:
{
  "resumen": "síntesis de la propuesta DUA",
  "ajustes": [
    {
      "categoria": "bap_sensorial | bap_motriz | ritmos_rezago | sobresalientes",
      "titulo": "título breve",
      "descripcion": "descripción aplicada a la UAC y sus actividades",
      "estrategias": ["estrategia 1", "estrategia 2", "estrategia 3"],
      "evaluacionDiferenciada": "cómo se evalúa sin reducir el aprendizaje esperado",
      "recursos": ["recurso 1", "recurso 2"]
    }
  ]
}
Incluye exactamente una entrada por cada categoría solicitada: ${categorias.join(', ')}.`;

  const userPrompt = `Planeación a adaptar:\n${planningSummary(params.content)}`;

  try {
    const raw = await generateWithRotation(
      systemPrompt,
      userPrompt,
      params.teacherId,
      Boolean(params.isPremium),
      {
        temperature: 0.3,
        jsonMode: true,
        maxTokens: 2600,
        timeoutMs: 60000,
      }
    );

    const parsedJson = robustJsonParse<unknown>(raw);
    const validated = DUA_SCHEMA.safeParse(parsedJson);
    if (!validated.success) {
      throw new Error(`Respuesta DUA inválida: ${validated.error.issues[0]?.message || 'esquema no compatible'}`);
    }

    return { ajustesDUA: normalizeAIOutput(validated.data, params.content, categorias) };
  } catch (error) {
    logger.warn('[DUA] Generación con IA no disponible; se usa propuesta determinista:', { error });
    return {
      ajustesDUA: fallback,
      warning: 'La IA no estuvo disponible. Se generó una propuesta DUA determinista editable.',
    };
  }
}
