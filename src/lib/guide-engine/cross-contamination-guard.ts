/**
 * cross-contamination-guard.ts
 * SIGPDA-EMS - Validador bidireccional anti-contaminacion cruzada.
 *
 * El guard parte del adaptador disciplinar de la UAC y revisa todos los textos
 * de la mision y de los planes de sesion. No asume que solo las UAC no
 * matematicas pueden contaminarse: una UAC de matematicas tambien se marca si
 * contiene practicas de construccion, laboratorio o cocina ajenas.
 */

import type { SessionPlan, MissionSection } from '@/types/work-textbook';
import {
  getDisciplinaryAdapter,
  type DisciplinaryDomainId,
} from '@/lib/prompts/disciplinary-adapters';

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

interface Rule {
  pattern: RegExp;
  label: string;
  actualDiscipline: string;
}

interface TextField {
  name: string;
  value: string;
}

export function isMathUAC(uacName?: string | null): boolean {
  if (!uacName) return false;
  const n = normalize(uacName);
  return (
    n.includes('pensamiento matematico') ||
    n.includes('matematica') ||
    n.includes('matematicas') ||
    n.includes('algebra') ||
    n.includes('geometria') ||
    n.includes('trigonometria') ||
    n.includes('calculo') ||
    n.includes('probabilidad') ||
    n.includes('estadistica') ||
    n.includes('pensamiento variacional')
  );
}

/**
 * Firmas matematicas inequivocas. Se conservan por compatibilidad con los
 * tests y con el resto del motor.
 */
export const FORBIDDEN_MATH_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /modelar\s+e\s+interpretar\s+los\s+fen[oó]menos\s+de\s+variaci[oó]n/i, label: 'modelar e interpretar los fenomenos de variacion' },
  { pattern: /an[aá]lisis\s+sistem[aá]tico\s+de\s+la\s+variaci[oó]n/i, label: 'analisis sistematico de la variacion' },
  { pattern: /propiedades\s+algebraicas\s+y\s+anal[ií]ticas/i, label: 'propiedades algebraicas y analiticas' },
  { pattern: /raz[oó]n\s+de\s+cambio\s+constante\s+de\s+una\s+variable/i, label: 'razon de cambio constante de una variable' },
  { pattern: /tasa\s+de\s+variaci[oó]n\s+media/i, label: 'tasa de variacion media' },
  { pattern: /delta\s+y\s+entre\s+delta\s+x/i, label: 'delta y entre delta x' },
  { pattern: /cociente\s+incremental/i, label: 'cociente incremental' },
  { pattern: /forma\s+punto-pendiente/i, label: 'forma punto-pendiente' },
  { pattern: /ahorro\s+acumulado\s+para\s+la\s+compra\s+de\s+filtros/i, label: 'ahorro acumulado para la compra de filtros de agua' },
  { pattern: /45\s*kg\s+de\s+PET/i, label: 'recoleccion de 45 kg de PET' },
  { pattern: /phet\.colorado\.edu\/es\/simulations\/graphing-lines/i, label: 'PhET graphing-lines' },
  { pattern: /search_query=pensamiento\+variacional/i, label: 'YouTube pensamiento variacional' },
  { pattern: /modelo\s+algebraico/i, label: 'modelo algebraico' },
  { pattern: /pensamiento\s+variacional/i, label: 'pensamiento variacional' },
  { pattern: /magnitud\s+variable/i, label: 'magnitud variable' },
  { pattern: /gr[aá]fica\s+de\s+variaci[oó]n/i, label: 'grafica de variacion' },
  { pattern: /regla\s+de\s+correspondencia\s+lineal/i, label: 'regla de correspondencia lineal' },
  { pattern: /funci[oó]n\s+(?:lineal\s+)?(?:de\s+ahorro\s+)?S\(t\)/i, label: 'funcion de ahorro S(t)' },
];

const MATH_RULES: Rule[] = FORBIDDEN_MATH_PATTERNS.map((r) => ({
  ...r,
  actualDiscipline: 'Pensamiento Matemático',
}));

const CONSTRUCTION_RULES: Rule[] = [
  { pattern: /instalaci[oó]n(?:es)?\s+(?:hidr[aá]ulica|sanitaria|hidrosanitaria|el[eé]ctrica|de gas)/i, label: 'instalacion hidraulica/sanitaria/electrica/de gas', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /redes?\s+(?:hidr[aá]ulica|sanitaria|de gas|de distribuci[oó]n)/i, label: 'red hidraulica/sanitaria/de gas', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /\btuber[ií]as?\s+(?:de|para)\s+(?:agua|cobre|cpvc|ppr|pvc|gas|desag[uü]e)/i, label: 'tuberia de agua/cobre/cpvc/ppr/pvc/gas/desague', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /prueba(?:s)?\s+de\s+estanqueidad/i, label: 'prueba de estanqueidad', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /soldadura\s+(?:de\s+)?(?:tuber[ií]a|tubo|cobre)/i, label: 'soldadura de tuberia/tubo/cobre', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /llave\s+de\s+paso/i, label: 'llave de paso', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /c[eé]dula\s*(?:40|80)/i, label: 'cedula 40/80 de tuberia', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /conexi[oó]n(?:es)?\s+(?:de|para)\s+gas/i, label: 'conexion de gas', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /muro(?:es)?\s+de\s+(?:block|tabique|concreto|ladrillo)/i, label: 'muro de block/tabique/concreto/ladrillo', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /colado\s+de\s+(?:losa|firme|castillo)/i, label: 'colado de losa/firme/castillo', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /varilla(?:s)?\s+corrugada/i, label: 'varilla corrugada', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /mezcla\s+de\s+(?:cemento|concreto|mortero)/i, label: 'mezcla de cemento/concreto/mortero', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /impermeabilizaci[oó]n/i, label: 'impermeabilizacion', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /bit[aá]cora\s+de\s+obra/i, label: 'bitacora de obra', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /arn[eé]s\s+de\s+seguridad\s+para\s+obra|casco\s+de\s+obra/i, label: 'arnes o casco de obra', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /(?:sistema|red)\s+de\s+riego\s+con\s+tuber[ií]as?\s+de\s+pvc/i, label: 'sistema de riego con tuberias pvc', actualDiscipline: 'Construccion e Instalaciones' },
  { pattern: /cable(?:-|\s)?red\s+utp/i, label: 'cable de red UTP', actualDiscipline: 'Telecomunicaciones' },
];

const SCIENCE_RULES: Rule[] = [
  { pattern: /phet\.colorado\.edu\/es\/simulations?\/(?:under-pressure|build-a-molecule|circuit-construction-kit)/i, label: 'simulacion PhET de ciencias', actualDiscipline: 'Ciencias Naturales' },
  { pattern: /simulador\s+de\s+presi[oó]n\s+en\s+fluidos/i, label: 'simulador de presion en fluidos', actualDiscipline: 'Ciencias Naturales' },
  { pattern: /matraz\s+erlenmeyer/i, label: 'matraz erlenmeyer', actualDiscipline: 'Ciencias Naturales' },
  { pattern: /mechero\s+bunsen/i, label: 'mechero bunsen', actualDiscipline: 'Ciencias Naturales' },
  { pattern: /microscopio\s+(?:[oó]ptico|compuesto)/i, label: 'microscopio optico/compuesto', actualDiscipline: 'Ciencias Naturales' },
  { pattern: /c[eé]lula\s+(?:vegetal|animal|procariota|eucariota)/i, label: 'celula vegetal/animal', actualDiscipline: 'Ciencias Naturales' },
  { pattern: /fotos[ií]ntesis/i, label: 'fotosintesis', actualDiscipline: 'Ciencias Naturales' },
  { pattern: /titulaci[oó]n\s+[aá]cido[-\s]base/i, label: 'titulacion acido-base', actualDiscipline: 'Ciencias Naturales' },
];

const KITCHEN_RULES: Rule[] = [
  { pattern: /tabla\s+de\s+(?:cortar|picar)/i, label: 'tabla de cortar/picar', actualDiscipline: 'Gastronomia' },
  { pattern: /cuchillo\s+(?:de\s+)?chef/i, label: 'cuchillo de chef', actualDiscipline: 'Gastronomia' },
];

const DIGITAL_RULES: Rule[] = [
  { pattern: /c[oó]digo\s+(?:en\s+)?(?:python|javascript|java|c\+\+|html)/i, label: 'codigo de programacion', actualDiscipline: 'Cultura Digital' },
  { pattern: /compilador|depurador\s+de\s+c[oó]digo/i, label: 'compilador/depurador', actualDiscipline: 'Cultura Digital' },
];

function normalize(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function compact(value: string, max = 180): string {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isCulinary(uacName: string, component: string, curriculumName: string): boolean {
  return /gastronom|alimentos y bebidas|reposteri|panaderi|culinari/i.test(
    `${uacName} ${component} ${curriculumName}`
  );
}

function isNative(
  id: DisciplinaryDomainId,
  group: 'math' | 'construction' | 'science' | 'digital'
): boolean {
  switch (group) {
    case 'math':
      return id === 'pensamiento_matematico';
    case 'construction':
      return id === 'formacion_laboral_industrial_agro_salud' || id === 'dibujo_tecnico_diseno_arquitectura';
    case 'science':
      return (
        id === 'ciencias_fisica_ingenieria' ||
        id === 'ciencias_quimica_biologia_ambiental' ||
        id === 'actividades_fisicas_deportivas_salud' ||
        id === 'socioemocional_tutoria_educacion_integral'
      );
    case 'digital':
      return id === 'cultura_digital_programacion_ti';
  }
}

function buildRules(
  id: DisciplinaryDomainId,
  uacName: string,
  component: string,
  curriculumName: string,
  adapterRules: Rule[]
): Rule[] {
  const culinary = isCulinary(uacName, component, curriculumName);
  const rules: Rule[] = [];

  if (!isNative(id, 'math')) rules.push(...MATH_RULES);
  if (!isNative(id, 'construction')) rules.push(...CONSTRUCTION_RULES);
  if (!isNative(id, 'science')) rules.push(...SCIENCE_RULES);
  if (!isNative(id, 'digital')) rules.push(...DIGITAL_RULES);
  if (!culinary) rules.push(...KITCHEN_RULES);

  rules.push(...adapterRules);

  const seen = new Set<string>();
  return rules.filter((rule) => {
    const key = `${rule.pattern.source}|${rule.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function adapterRulesFor(
  adapterId: DisciplinaryDomainId,
  forbiddenTerms: string[],
  culinary: boolean
): Rule[] {
  const terms = culinary
    ? forbiddenTerms
    : forbiddenTerms.filter((term) => !/cocina|cuchillo|tabla de picar|tabla de cortar|cofia/i.test(term));

  return terms.map((term) => ({
    pattern: new RegExp(`\\b${escapeRegExp(term)}\\b`, 'iu'),
    label: term,
    actualDiscipline: `Vocabulario ajeno a ${adapterId}`,
  }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectPlanTextFields(plan: SessionPlan): TextField[] {
  const fields: TextField[] = [];
  const direct: { name: keyof SessionPlan; value: unknown }[] = [
    { name: 'objetivo', value: plan.objetivo },
    { name: 'motivacion', value: plan.motivacion },
    { name: 'saberesPrevios', value: plan.saberesPrevios },
    { name: 'contenido', value: plan.contenido },
    { name: 'ejemploResuelto', value: plan.ejemploResuelto },
    { name: 'aplicacion', value: plan.aplicacion },
    { name: 'productoIntegrador', value: plan.productoIntegrador },
  ];

  for (const { name, value } of direct) {
    if (typeof value === 'string' && value) fields.push({ name, value });
  }

  if (Array.isArray(plan.practica)) {
    plan.practica.forEach((pr, idx) => {
      fields.push({
        name: `practica[${idx}]`,
        value: `${pr.enunciado || ''} ${pr.pista || ''} ${(pr.solucion || []).join(' ')}`,
      });
    });
  }

  if (Array.isArray(plan.autoevaluacion)) {
    plan.autoevaluacion.forEach((item, idx) => {
      if (typeof item === 'string' && item) fields.push({ name: `autoevaluacion[${idx}]`, value: item });
    });
  }

  if (Array.isArray(plan.recursos)) {
    plan.recursos.forEach((rec, idx) => {
      fields.push({
        name: `recursos[${idx}]`,
        value: `${rec.titulo || ''} ${rec.url || ''}`,
      });
    });
  }

  return fields;
}

function collectStrings(value: unknown, path: string, out: TextField[], depth = 0): void {
  if (depth > 8 || value == null) return;
  if (typeof value === 'string') {
    if (value.trim()) out.push({ name: path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => collectStrings(item, `${path}[${idx}]`, out, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'sessionPlans' || key === 'wordCount') continue;
      collectStrings(child, path ? `${path}.${key}` : key, out, depth + 1);
    }
  }
}

function findIssues(
  fields: TextField[],
  rules: Rule[],
  sessionNumber: number,
  expectedDiscipline: string
): ContaminationIssue[] {
  const issues: ContaminationIssue[] = [];
  const seen = new Set<string>();

  for (const { name, value } of fields) {
    for (const rule of rules) {
      const match = value.match(rule.pattern);
      if (!match) continue;
      const key = `${name}|${rule.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        sessionNumber,
        field: name,
        forbiddenTerm: rule.label,
        snippet: compact(match[0] || value),
        expectedDiscipline,
        actualDiscipline: rule.actualDiscipline,
      });
    }
  }

  return issues;
}

const RESOLVED_RULES_CACHE = new Map<string, { rules: Rule[]; expectedDiscipline: string }>();

function resolveRules(
  uacName: string,
  component: string,
  curriculumName: string,
  careerOrProgramName: string
): { rules: Rule[]; expectedDiscipline: string } {
  const cacheKey = `${uacName}|${component}|${curriculumName}|${careerOrProgramName}`;
  const cached = RESOLVED_RULES_CACHE.get(cacheKey);
  if (cached) return cached;

  const adapter = getDisciplinaryAdapter(uacName, component, curriculumName || careerOrProgramName);
  const culinary = isCulinary(uacName, component, curriculumName || careerOrProgramName);
  const adapterRules = adapterRulesFor(adapter.id, adapter.forbiddenCrossDomainTerms, culinary);
  const result = {
    rules: buildRules(adapter.id, uacName, component, curriculumName || careerOrProgramName, adapterRules),
    expectedDiscipline: adapter.displayName,
  };
  if (RESOLVED_RULES_CACHE.size > 128) {
    RESOLVED_RULES_CACHE.clear();
  }
  RESOLVED_RULES_CACHE.set(cacheKey, result);
  return result;
}

/**
 * Inspecciona un SessionPlan individual en busca de contaminacion cruzada.
 */
export function validateSessionPlanContamination(
  plan: SessionPlan,
  uacName: string,
  component: string = '',
  curriculumName: string = '',
  careerOrProgramName: string = ''
): ContaminationIssue[] {
  const { rules, expectedDiscipline } = resolveRules(uacName, component, curriculumName, careerOrProgramName);
  return findIssues(
    collectPlanTextFields(plan),
    rules,
    plan.sessionNumber,
    expectedDiscipline
  );
}

/**
 * Coherencia entre el titulo de la mision y el cuerpo del plan.
 */
export function validateSessionTitleCoherence(
  plan: SessionPlan,
  sessionTitle?: string | null,
  uacName?: string | null
): ContaminationIssue[] {
  const issues: ContaminationIssue[] = [];
  const title = normalize(sessionTitle || '');
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
      const body = `${plan.objetivo || ''} ${plan.contenido || ''} ${plan.ejemploResuelto || ''}`;
      if (MATH_RULES.some((rule) => rule.pattern.test(body))) {
        issues.push({
          sessionNumber: plan.sessionNumber,
          field: 'tituloVsCuerpo',
          forbiddenTerm: 'Contradicción Título Construcción vs Cuerpo Matemático',
          snippet: `Titulo: "${sessionTitle}" | Inicio cuerpo: "${compact(plan.contenido || plan.objetivo || '', 80)}"`,
          expectedDiscipline: uacName || 'Construccion',
          actualDiscipline: 'Pensamiento Matemático',
        });
      }
    }
  }

  return issues;
}

function evaluateBlockIssues(
  missions: MissionSection[],
  rules: Rule[],
  expectedDiscipline: string,
  uacName: string
): ContaminationIssue[] {
  const allIssues: ContaminationIssue[] = [];

  for (const mission of missions) {
    const missionFields: TextField[] = [];
    collectStrings(mission, `mision${mission.missionIndex}`, missionFields);
    allIssues.push(
      ...findIssues(
        missionFields,
        rules,
        mission.coveredSessions?.[0] || 0,
        expectedDiscipline
      )
    );

    const plans = mission.sessionPlans || [];
    for (const plan of plans) {
      allIssues.push(
        ...findIssues(collectPlanTextFields(plan), rules, plan.sessionNumber, expectedDiscipline)
      );
      allIssues.push(
        ...validateSessionTitleCoherence(
          plan,
          mission.sessionTopic || mission.title,
          uacName
        )
      );
    }
  }

  return allIssues;
}

/**
 * Auto-sanitiza incidencias aisladas de contaminación cruzada en las misiones.
 * Si una o pocas frases foráneas fueron detectadas de forma incidental (<= 5 incidencias),
 * neutraliza las cadenas conflictivas reemplazándolas por terminología pedagógica estándar.
 */
export function autoSanitizeCrossContamination(
  missions: MissionSection[],
  issues: ContaminationIssue[]
): boolean {
  if (!issues || issues.length === 0) return true;
  if (issues.length > 5) return false;

  let sanitizedCount = 0;

  for (const issue of issues) {
    if (!issue.snippet || issue.snippet.trim().length === 0) continue;
    const escaped = escapeRegExp(issue.snippet.trim());
    const regex = new RegExp(escaped, 'gi');

    for (const mission of missions) {
      if (Array.isArray(mission.sessionPlans)) {
        for (const plan of mission.sessionPlans) {
          if (plan.sessionNumber === issue.sessionNumber) {
            const directFields: Array<keyof SessionPlan> = [
              'objetivo',
              'motivacion',
              'saberesPrevios',
              'contenido',
              'ejemploResuelto',
              'aplicacion',
              'productoIntegrador',
            ];
            for (const f of directFields) {
              const val = plan[f];
              if (typeof val === 'string' && regex.test(val)) {
                (plan as unknown as Record<string, unknown>)[f] = val.replace(regex, 'actividad práctica situada');
                sanitizedCount++;
              }
            }

            if (Array.isArray(plan.practica)) {
              for (const pr of plan.practica) {
                if (typeof pr.enunciado === 'string' && regex.test(pr.enunciado)) {
                  pr.enunciado = pr.enunciado.replace(regex, 'actividad práctica');
                  sanitizedCount++;
                }
                if (typeof pr.pista === 'string' && regex.test(pr.pista)) {
                  pr.pista = pr.pista.replace(regex, 'procedimiento técnico');
                  sanitizedCount++;
                }
              }
            }

            if (Array.isArray(plan.autoevaluacion)) {
              plan.autoevaluacion = plan.autoevaluacion.map((item) => {
                if (typeof item === 'string' && regex.test(item)) {
                  sanitizedCount++;
                  return item.replace(regex, 'actividad técnica');
                }
                return item;
              });
            }
          }
        }
      }

      if (issue.field.startsWith('mision') || issue.field.includes('.')) {
        const replaceInObj = (target: unknown, depth = 0) => {
          if (!target || depth > 6 || typeof target !== 'object') return;
          const obj = target as Record<string, unknown>;
          for (const key of Object.keys(obj)) {
            if (key === 'sessionPlans') continue;
            const val = obj[key];
            if (typeof val === 'string' && regex.test(val)) {
              obj[key] = val.replace(regex, 'actividad práctica situada');
              sanitizedCount++;
            } else if (typeof val === 'object') {
              replaceInObj(val, depth + 1);
            }
          }
        };
        replaceInObj(mission);
      }
    }
  }

  return sanitizedCount > 0;
}

/**
 * Valida misiones completas (texto de mision + planes de sesion).
 */
export function validateBlockCrossContamination(
  missions: MissionSection[],
  uacName: string,
  component: string = '',
  curriculumName: string = '',
  careerOrProgramName: string = '',
  autoSanitize: boolean = false
): ContaminationReport {
  const { rules, expectedDiscipline } = resolveRules(uacName, component, curriculumName, careerOrProgramName);
  let allIssues = evaluateBlockIssues(missions, rules, expectedDiscipline, uacName);

  // Auto-sanitización resiliente para incidentes aislados (<= 5 incidencias)
  if (allIssues.length > 0 && allIssues.length <= 5 && autoSanitize) {
    const sanitized = autoSanitizeCrossContamination(missions, allIssues);
    if (sanitized) {
      const reevaluated = evaluateBlockIssues(missions, rules, expectedDiscipline, uacName);
      if (reevaluated.length < allIssues.length) {
        allIssues = reevaluated;
      }
    }
  }

  const clean = allIssues.length === 0;
  const summary = clean
    ? `OK. Verificacion anti-contaminacion aprobada: 0 terminos ajenos detectados en las sesiones de ${uacName}.`
    : `ALERTA. Contaminacion cruzada detectada en ${allIssues.length} puntos. Sesiones afectadas: ${Array.from(new Set(allIssues.map((i) => i.sessionNumber))).join(', ')}.`;

  return {
    clean,
    issues: allIssues,
    summary,
  };
}
