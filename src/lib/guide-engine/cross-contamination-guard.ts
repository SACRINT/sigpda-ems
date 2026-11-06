/**
 * cross-contamination-guard.ts
 * SIGPDA-EMS · Validador Estricto Anti-Contaminación Cruzada y Coherencia Editorial
 *
 * Previene la mezcla indebida de contenidos entre asignaturas (ej. lecciones de Pensamiento
 * Matemático inyectadas en Construcción, Plomería, Ciencias o Humanidades).
 *
 * Reglas de Validación:
 * 1. Detección de firmas y términos prohibidos fuera de su disciplina nativa.
 * 2. Coherencia semántica entre el título de la sesión y el cuerpo redactado.
 * 3. Inspección exhaustiva de TODOS los campos del SessionPlan (objetivo, motivación,
 *    saberes previos, contenido, ejemplo resuelto, práctica, autoevaluación, recursos, producto).
 * 4. Cero falsos positivos con vocabulario técnico interdisciplinar válido (ej. "caudal", "FEM",
 *    "corrosión galvánica", "velocidad de corte", "problemática derivada...", etc.).
 */

import type { SessionPlan, MissionSection } from '@/types/work-textbook';

export interface ContaminationIssue {
  sessionNumber: number;
  field: string;
  forbiddenTerm: string;
  snippet: string;
  expectedDiscipline?: string;
  actualDiscipline?: string;
}

export interface ContaminationReport {
  clean: boolean;
  issues: ContaminationIssue[];
  summary: string;
}

/**
 * Determina si la UAC pertenece al campo de Pensamiento Matemático.
 */
export function isMathUAC(uacName?: string | null): boolean {
  if (!uacName) return false;
  const n = uacName.toLowerCase();
  return (
    n.includes('pensamiento matemático') ||
    n.includes('pensamiento matematico') ||
    n.includes('matemática') ||
    n.includes('matematica') ||
    n.includes('matemáticas') ||
    n.includes('matematicas') ||
    n.includes('álgebra') ||
    n.includes('algebra') ||
    n.includes('geometría') ||
    n.includes('geometria') ||
    n.includes('trigonometría') ||
    n.includes('trigonometria') ||
    n.includes('cálculo') ||
    n.includes('calculo') ||
    n.includes('probabilidad') ||
    n.includes('estadística') ||
    n.includes('estadistica') ||
    n.includes('pensamiento variacional') ||
    n.includes('taller de pensamiento variacional')
  );
}

/**
 * Frases y patrones canónicos que representan contaminación matemática específica
 * (extraídos del antiguo fallback genérico o lecciones algebraicas fuera de lugar).
 */
export const FORBIDDEN_MATH_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /modelar\s+e\s+interpretar\s+los\s+fen[oó]menos\s+de\s+variaci[oó]n/i, label: 'modelar e interpretar los fenómenos de variación' },
  { pattern: /an[aá]lisis\s+sistem[aá]tico\s+de\s+la\s+variaci[oó]n/i, label: 'análisis sistemático de la variación' },
  { pattern: /propiedades\s+algebraicas\s+y\s+anal[ií]ticas/i, label: 'propiedades algebraicas y analíticas' },
  { pattern: /raz[oó]n\s+de\s+cambio\s+constante\s+de\s+una\s+variable/i, label: 'razón de cambio constante de una variable' },
  { pattern: /tasa\s+de\s+variaci[oó]n\s+media/i, label: 'tasa de variación media' },
  { pattern: /delta\s+y\s+entre\s+delta\s+x/i, label: 'delta y entre delta x' },
  { pattern: /cociente\s+incremental/i, label: 'cociente incremental' },
  { pattern: /forma\s+punto-pendiente/i, label: 'forma punto-pendiente' },
  { pattern: /ahorro\s+acumulado\s+para\s+la\s+compra\s+de\s+filtros/i, label: 'ahorro acumulado para la compra de filtros de agua' },
  { pattern: /45\s*kg\s+de\s+PET/i, label: 'recolección de 45 kg de PET' },
  { pattern: /phet\.colorado\.edu\/es\/simulations\/graphing-lines/i, label: 'PhET graphing-lines' },
  { pattern: /search_query=pensamiento\+variacional/i, label: 'YouTube pensamiento variacional' },
  { pattern: /modelo\s+algebraico/i, label: 'modelo algebraico' },
  { pattern: /pensamiento\s+variacional/i, label: 'pensamiento variacional' },
  { pattern: /magnitud\s+variable/i, label: 'magnitud variable' },
  { pattern: /gr[aá]fica\s+de\s+variaci[oó]n/i, label: 'gráfica de variación' },
  { pattern: /regla\s+de\s+correspondencia\s+lineal/i, label: 'regla de correspondencia lineal' },
  { pattern: /funci[oó]n\s+(?:lineal\s+)?(?:de\s+ahorro\s+)?S\(t\)/i, label: 'función de ahorro S(t)' },
];

/**
 * Inspecciona un SessionPlan individual en busca de contaminación cruzada.
 */
export function validateSessionPlanContamination(
  plan: SessionPlan,
  uacName: string
): ContaminationIssue[] {
  const issues: ContaminationIssue[] = [];
  const mathUAC = isMathUAC(uacName);

  if (mathUAC) {
    return issues; // En matemáticas, estos términos son legítimos
  }

  // Campos de texto directo
  const textFields: { name: keyof SessionPlan; value: unknown }[] = [
    { name: 'objetivo', value: plan.objetivo },
    { name: 'motivacion', value: plan.motivacion },
    { name: 'saberesPrevios', value: plan.saberesPrevios },
    { name: 'contenido', value: plan.contenido },
    { name: 'ejemploResuelto', value: plan.ejemploResuelto },
    { name: 'aplicacion', value: plan.aplicacion },
    { name: 'productoIntegrador', value: plan.productoIntegrador },
  ];

  for (const { name, value } of textFields) {
    if (typeof value !== 'string' || !value) continue;

    for (const { pattern, label } of FORBIDDEN_MATH_PATTERNS) {
      const m = value.match(pattern);
      if (m) {
        issues.push({
          sessionNumber: plan.sessionNumber,
          field: name,
          forbiddenTerm: label,
          snippet: m[0],
          expectedDiscipline: uacName,
          actualDiscipline: 'Pensamiento Matemático',
        });
      }
    }
  }

  // Práctica (enunciado, pista, soluciones)
  if (Array.isArray(plan.practica)) {
    plan.practica.forEach((pr, prIdx) => {
      const combinedPractice = `${pr.enunciado || ''} ${pr.pista || ''} ${(pr.solucion || []).join(' ')}`;
      for (const { pattern, label } of FORBIDDEN_MATH_PATTERNS) {
        const m = combinedPractice.match(pattern);
        if (m) {
          issues.push({
            sessionNumber: plan.sessionNumber,
            field: `practica[${prIdx}]`,
            forbiddenTerm: label,
            snippet: m[0],
            expectedDiscipline: uacName,
            actualDiscipline: 'Pensamiento Matemático',
          });
        }
      }
    });
  }

  // Autoevaluación
  if (Array.isArray(plan.autoevaluacion)) {
    plan.autoevaluacion.forEach((ae, aeIdx) => {
      if (typeof ae === 'string') {
        for (const { pattern, label } of FORBIDDEN_MATH_PATTERNS) {
          const m = ae.match(pattern);
          if (m) {
            issues.push({
              sessionNumber: plan.sessionNumber,
              field: `autoevaluacion[${aeIdx}]`,
              forbiddenTerm: label,
              snippet: m[0],
              expectedDiscipline: uacName,
              actualDiscipline: 'Pensamiento Matemático',
            });
          }
        }
      }
    });
  }

  // Recursos (título, url)
  if (Array.isArray(plan.recursos)) {
    plan.recursos.forEach((rec, recIdx) => {
      const combinedRec = `${rec.titulo || ''} ${rec.url || ''}`;
      for (const { pattern, label } of FORBIDDEN_MATH_PATTERNS) {
        const m = combinedRec.match(pattern);
        if (m) {
          issues.push({
            sessionNumber: plan.sessionNumber,
            field: `recursos[${recIdx}]`,
            forbiddenTerm: label,
            snippet: m[0],
            expectedDiscipline: uacName,
            actualDiscipline: 'Pensamiento Matemático',
          });
        }
      }
    });
  }

  return issues;
}

/**
 * Valida la coherencia semántica entre el título de la sesión y su contenido.
 * Si el título es de una UAC técnica/práctica (ej. Plomería, Construcción) y el cuerpo
 * presenta términos inequívocos de otra disciplina, detecta la inconsistencia.
 */
export function validateSessionTitleCoherence(
  plan: SessionPlan,
  sessionTitle?: string | null,
  uacName?: string | null
): ContaminationIssue[] {
  const issues: ContaminationIssue[] = [];
  const title = (sessionTitle || '').toLowerCase();
  const mathUAC = isMathUAC(uacName);

  if (!mathUAC) {
    const isConstructionTitle =
      title.includes('instalaci') ||
      title.includes('tuber') ||
      title.includes('plomer') ||
      title.includes('hidr') ||
      title.includes('gas') ||
      title.includes('muro') ||
      title.includes('construc') ||
      title.includes('mueble') ||
      title.includes('obra');

    if (isConstructionTitle) {
      const body = `${plan.objetivo || ''} ${plan.contenido || ''}`.toLowerCase();
      if (
        body.includes('modelar e interpretar los fenómenos de variación') ||
        body.includes('análisis sistemático de la variación') ||
        body.includes('modelo algebraico')
      ) {
        issues.push({
          sessionNumber: plan.sessionNumber,
          field: 'tituloVsCuerpo',
          forbiddenTerm: 'Contradicción Título Construcción vs Cuerpo Matemático',
          snippet: `Título: "${sessionTitle}" | Inicio cuerpo: "${(plan.contenido || plan.objetivo || '').slice(0, 80)}"`,
          expectedDiscipline: uacName || 'Construcción',
          actualDiscipline: 'Pensamiento Matemático',
        });
      }
    }
  }

  return issues;
}

/**
 * Valida un conjunto de misiones completas de un libro de bloque o compendio.
 */
export function validateBlockCrossContamination(
  missions: MissionSection[],
  uacName: string
): ContaminationReport {
  const allIssues: ContaminationIssue[] = [];

  for (const mission of missions) {
    const plans = mission.sessionPlans || [];
    for (const plan of plans) {
      const planIssues = validateSessionPlanContamination(plan, uacName);
      allIssues.push(...planIssues);

      const coherenceIssues = validateSessionTitleCoherence(
        plan,
        mission.sessionTopic || mission.title,
        uacName
      );
      allIssues.push(...coherenceIssues);
    }
  }

  const clean = allIssues.length === 0;
  const summary = clean
    ? `✅ Verificación anti-contaminación aprobada: 0 términos foráneos detectados en las sesiones de ${uacName}.`
    : `❌ Contaminación cruzada detectada en ${allIssues.length} puntos. Sesiones afectadas: ${Array.from(new Set(allIssues.map((i) => i.sessionNumber))).join(', ')}.`;

  return {
    clean,
    issues: allIssues,
    summary,
  };
}
