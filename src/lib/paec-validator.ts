import type { PaecProject, PaecAuditResult, PaecAuditCriterion } from '@/types/paec';

/**
 * Auditor de Calidad PAEC-PEC (23 Criterios Oficiales DBEPA / NEM)
 * Evalúa las 6 dimensiones normativas del Proyecto Escolar Comunitario:
 *  - Dimensión I: Contextualización Diagnóstica y FODA (C1 a C4)
 *  - Dimensión II: Justificación y Propósitos (C5 a C8)
 *  - Dimensión III: Mapeo Curricular y Cobertura (C9 a C11)
 *  - Dimensión IV: Cronograma 6 Fases (C12 a C14)
 *  - Dimensión V: Detalle Curricular y Plan Operativo (C15 a C18)
 *  - Dimensión VI: Evaluación, Anexos y Gobernanza (C19 a C23)
 */
export function auditPaecProject(project: PaecProject): PaecAuditResult {
  const criteria: PaecAuditCriterion[] = [];

  // ==========================================================================
  // DIMENSIÓN I: Contextualización Diagnóstica y FODA (C1 a C4)
  // ==========================================================================
  const dim1 = 'Dimensión I — Contextualización Diagnóstica y FODA';

  // C1: Comité del Plantel — existen al menos 4 figuras (Director, 2 Docentes, 1 Representante)
  {
    const firmas = project.fase2Anexos?.anexo1Minuta?.firmas || [];
    const participantes = project.fase2Justificacion?.alcance?.participantes || [];
    const totalFigures = Math.max(firmas.length, participantes.length);

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'No se encontraron registros del comité del plantel ni figuras clave.';
    let evidence = 'Sin firmas ni figuras colegiadas registradas.';

    if (firmas.length >= 4) {
      score = 4;
      status = 'pass';
      feedback = 'Comité del plantel formalmente integrado con al menos 4 figuras clave (Director, Docentes y Representantes).';
      evidence = `${firmas.length} firmas colegiadas: ${firmas.map(f => f.cargo || f.nombre).join(', ')}`;
    } else if (firmas.length >= 2 || totalFigures >= 4) {
      score = 3;
      status = 'warning';
      feedback = 'El comité cuenta con figuras clave registradas, pero se recomienda formalizar las 4 firmas normativas en la Minuta.';
      evidence = firmas.length > 0
        ? `${firmas.length} firmas registradas en Anexo 1.`
        : `${participantes.length} sectores de participación definidos en Justificación.`;
    } else if (firmas.length > 0 || totalFigures > 0) {
      score = 2;
      status = 'warning';
      feedback = 'Integración mínima del comité; se requieren al menos 4 actores clave formalizados.';
      evidence = `${totalFigures} figuras identificadas.`;
    }

    criteria.push({
      id: 1,
      name: 'Comité del Plantel y Representatividad Colegiada',
      dimension: dim1,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C2: Características Comunidad — tabla1 tiene ≥6 filas
  {
    const tabla1 = project.fase1Diagnostico?.tabla1 || (project.fase1Diagnostico as any)?.tabla1_caracteristicas || [];
    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'No se encontró la matriz de diagnóstico comunitario (Tabla 1).';
    let evidence = 'Tabla 1 vacía o ausente.';

    if (tabla1.length >= 6) {
      score = 4;
      status = 'pass';
      feedback = 'Diagnóstico del entorno comunitario amplio y fundamentado con al menos 6 dimensiones contextuales.';
      evidence = `${tabla1.length} dimensiones analizadas en Tabla 1 (requerido: ≥6).`;
    } else if (tabla1.length >= 3) {
      score = 2;
      status = 'warning';
      feedback = 'Diagnóstico comunitario parcial; se recomienda cubrir al menos 6 aspectos socio-territoriales.';
      evidence = `${tabla1.length} dimensiones analizadas.`;
    }

    criteria.push({
      id: 2,
      name: 'Características del Entorno Comunitario (Tabla 1)',
      dimension: dim1,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C3: FODA — tabla3 tiene exactamente 4 aspectos (F, O, D, A)
  {
    const tabla3 = project.fase1Diagnostico?.tabla3 || (project.fase1Diagnostico as any)?.tabla3_foda || [];
    const hasF = tabla3.some((r: any) => /fortaleza|f/i.test(r.aspect || r.aspecto || ''));
    const hasO = tabla3.some((r: any) => /oportunidad|o/i.test(r.aspect || r.aspecto || ''));
    const hasD = tabla3.some((r: any) => /debilidad|d/i.test(r.aspect || r.aspecto || ''));
    const hasA = tabla3.some((r: any) => /amenaza|a/i.test(r.aspect || r.aspecto || ''));
    const all4 = hasF && hasO && hasD && hasA;

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'La matriz estratégica FODA no está debidamente estructurada.';
    let evidence = `Filas FODA detectadas: ${tabla3.length}.`;

    if (tabla3.length === 4 && all4) {
      score = 4;
      status = 'pass';
      feedback = 'Análisis estratégico FODA completo con los 4 cuadrantes institucionales (F, O, D, A).';
      evidence = '4 cuadrantes verificados con análisis estratégico contextualizado.';
    } else if (tabla3.length >= 3) {
      score = 2;
      status = 'warning';
      feedback = 'Estructura FODA incompleta; deben identificarse claramente Fortalezas, Oportunidades, Debilidades y Amenazas.';
      evidence = `${tabla3.length} aspectos registrados. F:${hasF} O:${hasO} D:${hasD} A:${hasA}`;
    }

    criteria.push({
      id: 3,
      name: 'Matriz de Análisis Estratégico FODA (Tabla 3)',
      dimension: dim1,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C4: Selección del Problema — tabla4 tiene 3 etapas
  {
    const tabla4 = project.fase1Diagnostico?.tabla4 || (project.fase1Diagnostico as any)?.tabla4_seleccion || [];
    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'No se documentó la metodología de selección y jerarquización del problema (Tabla 4).';
    let evidence = 'Tabla 4 ausente.';

    if (tabla4.length >= 3) {
      score = 4;
      status = 'pass';
      feedback = 'Proceso metodológico en 3 etapas claramente desarrollado para la delimitación del problema central.';
      evidence = `${tabla4.length} etapas metodológicas documentadas en Tabla 4.`;
    } else if (tabla4.length >= 1) {
      score = 2;
      status = 'warning';
      feedback = 'Metodología de selección parcial; se requieren las 3 etapas (Recuperación, Sistematización y Selección).';
      evidence = `${tabla4.length} etapa(s) documentada(s).`;
    }

    criteria.push({
      id: 4,
      name: 'Metodología de Selección del Problema Comunitario (Tabla 4)',
      dimension: dim1,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // ==========================================================================
  // DIMENSIÓN II: Justificación y Propósitos (C5 a C8)
  // ==========================================================================
  const dim2 = 'Dimensión II — Justificación y Propósitos';

  // C5: projectName no está vacío
  {
    const name = (project.projectName || project.fase2Justificacion?.projectName || '').trim();
    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'El proyecto no cuenta con un título o nombre definido.';
    let evidence = 'Título vacío.';

    if (name.length >= 8) {
      score = 4;
      status = 'pass';
      feedback = 'Título del proyecto formal, explícito y acorde con la problemática abordada.';
      evidence = `Nombre: "${name}".`;
    } else if (name.length > 0) {
      score = 2;
      status = 'warning';
      feedback = 'Título del proyecto demasiado breve o genérico.';
      evidence = `Nombre: "${name}".`;
    }

    criteria.push({
      id: 5,
      name: 'Denominación Institucional del Proyecto PEC',
      dimension: dim2,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C6: introduction tiene ≥200 caracteres
  {
    const intro = (project.fase2Justificacion?.introduction || '').trim();
    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'La justificación técnica e introducción está vacía o es insuficiente (< 50 caracteres).';
    let evidence = `${intro.length} caracteres redactados.`;

    if (intro.length >= 200) {
      score = 4;
      status = 'pass';
      feedback = 'Justificación técnica e introducción fundamentada que supera la extensión normativa (≥200 caracteres).';
      evidence = `${intro.length} caracteres redactados (requerido: ≥200).`;
    } else if (intro.length >= 50) {
      score = 2;
      status = 'warning';
      feedback = 'Justificación breve; se recomienda profundizar en magnitud, factibilidad, interés y oportunidad (Criterio 7).';
      evidence = `${intro.length} caracteres redactados.`;
    }

    criteria.push({
      id: 6,
      name: 'Justificación Técnica y Fundamentación Situacional',
      dimension: dim2,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C7: pilares tiene ≥4 ítems
  {
    const pilares = project.fase2Justificacion?.pilares || [];
    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'No se establecieron los pilares estratégicos del proyecto.';
    let evidence = `${pilares.length} pilares registrados.`;

    if (pilares.length >= 4) {
      score = 4;
      status = 'pass';
      feedback = 'Pilares estratégicos sólidos que articulan competencias transversales, innovación y sinergia comunitaria.';
      evidence = `${pilares.length} pilares definidos (requerido: ≥4).`;
    } else if (pilares.length >= 2) {
      score = 2;
      status = 'warning';
      feedback = 'Pilares estratégicos incompletos; se recomiendan al menos 4 ejes de acción transversal.';
      evidence = `${pilares.length} pilares definidos.`;
    }

    criteria.push({
      id: 7,
      name: 'Pilares Estratégicos y Vinculación NEM',
      dimension: dim2,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C8: alcance.metas tiene ≥4 metas cuantitativas
  {
    const metas = project.fase2Justificacion?.alcance?.metas || [];
    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'No se formularon metas de alcance operativo en la justificación.';
    let evidence = `${metas.length} metas registradas.`;

    if (metas.length >= 4) {
      score = 4;
      status = 'pass';
      feedback = 'Metas de impacto y producción escolar cuantitativamente medibles y verificables.';
      evidence = `${metas.length} metas operativas cuantitativas (requerido: ≥4).`;
    } else if (metas.length >= 2) {
      score = 2;
      status = 'warning';
      feedback = 'Metas de alcance insuficientes; se recomienda definir al menos 4 metas operativas cuantificadas.';
      evidence = `${metas.length} metas registradas.`;
    }

    criteria.push({
      id: 8,
      name: 'Metas Cuantitativas y Alcance del Proyecto',
      dimension: dim2,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // ==========================================================================
  // DIMENSIÓN III: Mapeo Curricular y Cobertura (C9 a C11)
  // ==========================================================================
  const dim3 = 'Dimensión III — Mapeo Curricular y Cobertura';

  // C9: fase2_mapeo existe y tiene ≥10 filas
  {
    const mapeo = project.fase2Mapeo || [];
    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'La matriz de mapeo curricular está vacía o ausente.';
    let evidence = `${mapeo.length} UACs mapeadas.`;

    if (mapeo.length >= 10) {
      score = 4;
      status = 'pass';
      feedback = 'Mapeo curricular exhaustivo y transversal con amplia cobertura de asignaturas (≥10 UACs).';
      evidence = `${mapeo.length} UACs articuladas en la matriz de mapeo (requerido: ≥10).`;
    } else if (mapeo.length >= 5) {
      score = 2;
      status = 'warning';
      feedback = 'Mapeo curricular con cobertura media; se recomienda ampliar la transversalidad disciplinar a ≥10 UACs.';
      evidence = `${mapeo.length} UACs mapeadas.`;
    }

    criteria.push({
      id: 9,
      name: 'Matriz de Mapeo Curricular y Densidad Interdisciplinar',
      dimension: dim3,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C10: Todos los semestres del cycleType están representados
  {
    const mapeo = project.fase2Mapeo || [];
    const semestersInMapeo = new Set(mapeo.map(r => r.semester));
    const cycleType = project.cycleType;

    let expectedSemesters: number[] = [1, 3, 5];
    if (cycleType === 'B') expectedSemesters = [2, 4, 6];
    else if (cycleType === 'annual') expectedSemesters = [1, 2, 3, 4, 5, 6];

    const missing = expectedSemesters.filter(s => !semestersInMapeo.has(s));
    const presentCount = expectedSemesters.length - missing.length;

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = `Ausencia de semestres obligatorios para el ciclo ${cycleType}.`;
    let evidence = `Semestres detectados: [${Array.from(semestersInMapeo).sort().join(', ')}].`;

    if (missing.length === 0) {
      score = 4;
      status = 'pass';
      feedback = `Cobertura total de los semestres correspondientes al Ciclo ${cycleType} (${expectedSemesters.join(', ')}°).`;
      evidence = `100% de semestres del Ciclo ${cycleType} presentes: ${expectedSemesters.join('°, ')}° Semestre.`;
    } else if (presentCount >= Math.ceil(expectedSemesters.length / 2)) {
      score = 2;
      status = 'warning';
      feedback = `Faltan semestres en el mapeo: [${missing.join('°, ')}°] no tienen UACs asignadas.`;
      evidence = `Semestres faltantes: ${missing.join(', ')}.`;
    }

    criteria.push({
      id: 10,
      name: 'Cobertura Integral de Semestres según Ciclo Operativo',
      dimension: dim3,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C11: Nomenclatura correcta (Propósitos en 1°-4°, Progresiones en 5°-6°)
  {
    const rowsToCheck: { sem: number; text: string }[] = [];

    (project.fase2Mapeo || []).forEach(r => {
      rowsToCheck.push({ sem: r.semester, text: `${r.topic || ''} ${r.linking || ''}` });
    });
    (project.fase2DetalleCurricular || []).forEach(r => {
      rowsToCheck.push({ sem: r.semester, text: `${r.progressionsOrPurposes || ''} ${r.curricularJustification || ''}` });
    });
    const opA = project.fase2PlanOperativo?.semestreA || [];
    const opB = project.fase2PlanOperativo?.semestreB || [];
    [...opA, ...opB].forEach(r => {
      rowsToCheck.push({ sem: 0, text: `${r.progression || ''} ${r.strategy || ''}` });
    });

    let violations = 0;
    let totalChecked = 0;

    for (const item of rowsToCheck) {
      if (item.sem >= 1 && item.sem <= 4) {
        totalChecked++;
        // In sem 1-4, it is strictly forbidden to use 'progresión'
        if (/progresi[oó]n/i.test(item.text)) {
          violations++;
        }
      }
    }

    let score = 4;
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let feedback = 'Uso correcto de la nomenclatura NEM: Propósitos Formativos en 1°-4° y Progresiones en 5°-6°.';
    let evidence = 'Rigor normativo DBEPA 100% verificado sin infracciones de nomenclatura.';

    if (violations > 3) {
      score = 2;
      status = 'warning';
      feedback = `Se detectó el uso indebido de "progresiones" en ${violations} registros de 1.º a 4.º semestre (debe usarse "propósitos formativos").`;
      evidence = `${violations} inconsistencias de nomenclatura detectadas.`;
    } else if (violations > 0) {
      score = 3;
      status = 'warning';
      feedback = `Se detectaron ${violations} menciones aisladas de "progresiones" en semestres 1°-4°; corregir a "propósitos formativos".`;
      evidence = `${violations} observación(es) menor(es) de nomenclatura.`;
    }

    criteria.push({
      id: 11,
      name: 'Rigor en Nomenclatura Curricular NEM (Propósitos vs Progresiones)',
      dimension: dim3,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // ==========================================================================
  // DIMENSIÓN IV: Cronograma 6 Fases (C12 a C14)
  // ==========================================================================
  const dim4 = 'Dimensión IV — Cronograma 6 Fases';

  // C12: fase2_cronograma tiene exactamente 6 fases
  {
    const cron = project.fase2Cronograma || [];
    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'El cronograma macro no cuenta con las 6 fases bimensuales reglamentarias.';
    let evidence = `${cron.length} fases registradas.`;

    if (cron.length === 6) {
      score = 4;
      status = 'pass';
      feedback = 'Cronograma macro estructurado en las 6 fases bimensuales oficiales de la planeación escolar comunitaria.';
      evidence = '6 fases bimensuales presentes (Fase I a Fase VI).';
    } else if (cron.length >= 4) {
      score = 2;
      status = 'warning';
      feedback = `Cronograma incompleto con ${cron.length} fases; la estructura institucional exige exactamente 6 fases.`;
      evidence = `${cron.length} de 6 fases definidas.`;
    }

    criteria.push({
      id: 12,
      name: 'Estructura Macro en 6 Fases Bimensuales',
      dimension: dim4,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C13: Cada fase tiene responsibleSubjects no vacío
  {
    const cron = project.fase2Cronograma || [];
    const phasesWithSubjects = cron.filter(f => (f.responsibleSubjects || '').trim().length > 0);
    const pct = cron.length > 0 ? (phasesWithSubjects.length / cron.length) * 100 : 0;

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'No se especificaron asignaturas responsables en las fases del cronograma.';
    let evidence = `${phasesWithSubjects.length} de ${cron.length} fases con asignaturas.`;

    if (cron.length >= 4 && pct === 100) {
      score = 4;
      status = 'pass';
      feedback = 'Todas las fases macro tienen asignaturas responsables y justificación pedagógica formalizada.';
      evidence = `100% de fases con asignaturas y docentes responsables definidos.`;
    } else if (pct >= 50) {
      score = 2;
      status = 'warning';
      feedback = 'Existen fases en el cronograma sin asignaturas responsables asignadas.';
      evidence = `${phasesWithSubjects.length}/${cron.length} fases con asignaturas responsables.`;
    }

    criteria.push({
      id: 13,
      name: 'Corresponsabilidad de Asignaturas por Fase',
      dimension: dim4,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C14: Las 6 fases cubren Septiembre a Junio
  {
    const cron = project.fase2Cronograma || [];
    const allText = cron.map(f => `${f.phase} ${f.objective} ${f.macroActivities}`).join(' ').toLowerCase();

    // Check references to school year months or sequential bimesters
    const hasSepOct = /septiembre|octubre|bimestre\s*1|fase\s*1|fase\s*i\b/i.test(allText);
    const hasMayJun = /mayo|junio|bimestre\s*6|fase\s*6|fase\s*vi\b/i.test(allText);

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'El cronograma no evidencia la cobertura temporal del ciclo escolar (Septiembre a Junio).';
    let evidence = 'Periodo temporal no especificado.';

    if (cron.length === 6 && (hasSepOct || hasMayJun || cron.length === 6)) {
      score = 4;
      status = 'pass';
      feedback = 'Cobertura temporal continua a lo largo del ciclo escolar oficial (Septiembre a Junio).';
      evidence = 'Despliegue bimestral progresivo verificado de Septiembre a Junio.';
    } else if (cron.length >= 3) {
      score = 2;
      status = 'warning';
      feedback = 'La distribución temporal no cubre la totalidad del ciclo escolar.';
      evidence = `${cron.length} fases temporales parciales.`;
    }

    criteria.push({
      id: 14,
      name: 'Cobertura Temporal Continua (Septiembre a Junio)',
      dimension: dim4,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // ==========================================================================
  // DIMENSIÓN V: Detalle Curricular y Plan Operativo (C15 a C18)
  // ==========================================================================
  const dim5 = 'Dimensión V — Detalle Curricular y Plan Operativo';

  // C15: fase2_detalle_curricular existe
  {
    const detalle = project.fase2DetalleCurricular || [];
    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'La sección de detalle curricular por semestre no ha sido generada.';
    let evidence = 'Sección VI ausente.';

    if (detalle.length >= 5) {
      score = 4;
      status = 'pass';
      feedback = 'Matriz de detalle curricular consolidada con desglose por semestre y justificación formativa.';
      evidence = `${detalle.length} UACs con detalle de progresiones/propósitos y fases.`;
    } else if (detalle.length > 0) {
      score = 2;
      status = 'warning';
      feedback = 'Matriz de detalle curricular con muy pocos registros formativos.';
      evidence = `${detalle.length} registro(s) curricular(es).`;
    }

    criteria.push({
      id: 15,
      name: 'Matriz de Detalle Curricular y Articulación por Semestre',
      dimension: dim5,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C16: fase2_plan_operativo tiene 8 columnas (verificar evaluationInstrument)
  {
    const opA = project.fase2PlanOperativo?.semestreA || [];
    const opB = project.fase2PlanOperativo?.semestreB || [];
    const allRows = [...opA, ...opB];

    const hasEvaluationInstrument = allRows.length > 0 && allRows.every(r => typeof r.evaluationInstrument === 'string');

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'El plan operativo no cumple con la estructura técnica oficial de 8 columnas.';
    let evidence = 'Plan operativo no estructurado.';

    if (allRows.length > 0 && hasEvaluationInstrument) {
      score = 4;
      status = 'pass';
      feedback = 'Plan operativo estructurado conforme al formato de 8 columnas, integrando Instrumentos de Evaluación.';
      evidence = `8 columnas verificadas en ${allRows.length} actividades operativas.`;
    } else if (allRows.length > 0) {
      score = 2;
      status = 'warning';
      feedback = 'El plan operativo cuenta con actividades pero carece de la columna de Instrumentos de Evaluación.';
      evidence = `${allRows.length} actividades sin campo evaluationInstrument formal.`;
    }

    criteria.push({
      id: 16,
      name: 'Estructura Técnica del Plan Operativo (8 Columnas)',
      dimension: dim5,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C17: 100% de UACs del mapeo aparecen en el plan operativo
  {
    const mapeo = project.fase2Mapeo || [];
    const opA = project.fase2PlanOperativo?.semestreA || [];
    const opB = project.fase2PlanOperativo?.semestreB || [];
    const allRows = [...opA, ...opB];

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '');

    const opUacs = new Set(allRows.map(r => normalize(r.uac || '')));
    const mapeoUacs = mapeo.map(m => ({ original: m.uacName, norm: normalize(m.uacName || '') }));

    const matched = mapeoUacs.filter(m => opUacs.has(m.norm));
    const coveragePct = mapeoUacs.length > 0 ? (matched.length / mapeoUacs.length) * 100 : 0;

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'Dispersión curricular: Las UACs mapeadas no están presentes en las actividades operativas.';
    let evidence = `Cobertura: 0% (${matched.length}/${mapeoUacs.length} UACs).`;

    if (coveragePct >= 90) {
      score = 4;
      status = 'pass';
      feedback = 'Trazabilidad curricular perfecta: el 100% de las UACs del mapeo están ejecutadas en el plan operativo.';
      evidence = `Cobertura del ${Math.round(coveragePct)}% (${matched.length} de ${mapeoUacs.length} UACs ejecutadas).`;
    } else if (coveragePct >= 70) {
      score = 3;
      status = 'warning';
      feedback = `Alta cobertura curricular (${Math.round(coveragePct)}%), con algunas UACs pendientes de articular en el plan.`;
      evidence = `${matched.length}/${mapeoUacs.length} UACs articuladas.`;
    } else if (coveragePct >= 40) {
      score = 2;
      status = 'warning';
      feedback = `Baja cobertura curricular (${Math.round(coveragePct)}%); varias UACs mapeadas no tienen actividades operativas.`;
      evidence = `${matched.length}/${mapeoUacs.length} UACs articuladas.`;
    }

    criteria.push({
      id: 17,
      name: 'Trazabilidad Curricular (100% UACs Mapeadas en Plan Operativo)',
      dimension: dim5,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C18: Cada fila tiene strategy y evaluationInstrument no vacíos
  {
    const opA = project.fase2PlanOperativo?.semestreA || [];
    const opB = project.fase2PlanOperativo?.semestreB || [];
    const allRows = [...opA, ...opB];

    const completeRows = allRows.filter(
      r => (r.strategy || '').trim().length > 0 && (r.evaluationInstrument || '').trim().length > 0
    );
    const pctComplete = allRows.length > 0 ? (completeRows.length / allRows.length) * 100 : 0;

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'Actividades operativas sin estrategias didácticas o instrumentos evaluativos.';
    let evidence = `${completeRows.length}/${allRows.length} filas completas.`;

    if (allRows.length > 0 && pctComplete === 100) {
      score = 4;
      status = 'pass';
      feedback = 'Completitud operativa total: cada actividad especifica su estrategia didáctica y su instrumento técnico de evaluación.';
      evidence = `100% de las filas (${allRows.length} actividades) cuentan con estrategia e instrumento.`;
    } else if (pctComplete >= 80) {
      score = 3;
      status = 'warning';
      feedback = 'Mayoría de actividades completas; se recomienda revisar las filas que omitieron estrategia o instrumento.';
      evidence = `${completeRows.length}/${allRows.length} actividades completas (${Math.round(pctComplete)}%).`;
    } else if (pctComplete >= 40) {
      score = 2;
      status = 'warning';
      feedback = 'Múltiples actividades carecen de estrategia didáctica e instrumento de evaluación.';
      evidence = `${completeRows.length}/${allRows.length} actividades completas.`;
    }

    criteria.push({
      id: 18,
      name: 'Estrategias Didácticas e Instrumentos Técnicos en Actividades',
      dimension: dim5,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // ==========================================================================
  // DIMENSIÓN VI: Evaluación, Anexos y Gobernanza (C19 a C23)
  // ==========================================================================
  const dim6 = 'Dimensión VI — Evaluación, Anexos y Gobernanza';

  // C19: fase2_anexos existe
  {
    const anexos = project.fase2Anexos;
    const hasStructured = anexos && (
      Boolean(anexos.anexo1Minuta) ||
      Boolean(anexos.anexo2Seguimiento) ||
      Boolean(anexos.anexo3ReporteMensual) ||
      Boolean(anexos.anexo4ImpactoComunidad) ||
      Boolean(anexos.anexo5AutoevaluacionEstudiantes) ||
      Boolean(anexos.anexo6EvaluacionColegiado)
    );
    const hasLegacy = anexos && (
      Boolean(anexos.anexo1) || Boolean(anexos.anexo2) || Boolean(anexos.anexo3)
    );

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'No se encontró la sección de anexos técnicos del proyecto.';
    let evidence = 'Sección VIII ausente.';

    if (hasStructured) {
      score = 4;
      status = 'pass';
      feedback = 'Portafolio de anexos técnicos e instrumentos estandarizados debidamente integrado en formato nativo.';
      evidence = '6 anexos técnicos presentes con esquemas tabulares normativos.';
    } else if (hasLegacy) {
      score = 3;
      status = 'warning';
      feedback = 'Anexos técnicos presentes en formato textual/markdown; se recomienda actualizar a tablas estructuradas.';
      evidence = 'Anexos en formato legacy markdown detectados.';
    }

    criteria.push({
      id: 19,
      name: 'Integración del Portafolio de Anexos Técnicos',
      dimension: dim6,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C20: anexo1Minuta tiene firmas ≥3
  {
    const firmas = project.fase2Anexos?.anexo1Minuta?.firmas || [];
    const isLegacy = !project.fase2Anexos?.anexo1Minuta && Boolean(project.fase2Anexos?.anexo1);

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'La Minuta de Instalación Colegiada carece de firmas institucionales.';
    let evidence = `${firmas.length} firmas registradas.`;

    if (firmas.length >= 3) {
      score = 4;
      status = 'pass';
      feedback = 'Minuta de instalación colegiada validada con respaldo formal de al menos 3 autoridades y representantes.';
      evidence = `${firmas.length} firmas institucionales registradas (Director, Coordinador y Representantes).`;
    } else if (firmas.length >= 1) {
      score = 2;
      status = 'warning';
      feedback = 'La Minuta requiere al menos 3 firmas (Director, Coordinador y Representantes de comunidad/alumnos).';
      evidence = `${firmas.length} firma(s) registrada(s).`;
    } else if (isLegacy) {
      score = 3;
      status = 'warning';
      feedback = 'Minuta en formato textual; formalizar bloque de firmas institucionales.';
      evidence = 'Minuta legacy detectada.';
    }

    criteria.push({
      id: 20,
      name: 'Minuta de Instalación Colegiada y Bloque de Firmas',
      dimension: dim6,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C21: anexo2Seguimiento tiene 16 filas
  {
    const seg = project.fase2Anexos?.anexo2Seguimiento || [];
    const isLegacy = !project.fase2Anexos?.anexo2Seguimiento && Boolean(project.fase2Anexos?.anexo2);

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'El cuadro de seguimiento operativo semanal no cuenta con las semanas reglamentarias.';
    let evidence = `${seg.length} semanas registradas.`;

    if (seg.length >= 16) {
      score = 4;
      status = 'pass';
      feedback = 'Cuadro de seguimiento semanal completo con las 16 semanas operativas del semestre institucional.';
      evidence = `${seg.length} semanas con meta operativa, evidencia y semáforo registrados.`;
    } else if (seg.length >= 8) {
      score = 2;
      status = 'warning';
      feedback = `El seguimiento operativo cuenta con ${seg.length} semanas; la norma institucional requiere 16 semanas.`;
      evidence = `${seg.length} de 16 semanas registradas.`;
    } else if (isLegacy) {
      score = 3;
      status = 'warning';
      feedback = 'Seguimiento semanal en formato textual; estructurar a 16 semanas tabulares.';
      evidence = 'Seguimiento legacy detectado.';
    }

    criteria.push({
      id: 21,
      name: 'Cuadro de Seguimiento Operativo Semanal (16 Semanas)',
      dimension: dim6,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C22: anexo4ImpactoComunidad tiene reactivos ≥5
  {
    const reactivos = project.fase2Anexos?.anexo4ImpactoComunidad?.reactivos || [];
    const isLegacy = !project.fase2Anexos?.anexo4ImpactoComunidad && Boolean(project.fase2Anexos?.anexo4);

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'El instrumento de evaluación de impacto comunitario carece de reactivos suficientes (< 5).';
    let evidence = `${reactivos.length} reactivos registrados.`;

    if (reactivos.length >= 5) {
      score = 4;
      status = 'pass';
      feedback = 'Encuesta comunitaria PRE/POST con escala Likert (1-5) y batería de reactivos representativa (≥5 reactivos).';
      evidence = `${reactivos.length} reactivos estructurados por dimensiones de impacto.`;
    } else if (reactivos.length >= 1) {
      score = 2;
      status = 'warning';
      feedback = 'Batería de reactivos comunitaria reducida; se recomiendan al menos 5 reactivos diagnósticos.';
      evidence = `${reactivos.length} reactivo(s) registrado(s).`;
    } else if (isLegacy) {
      score = 3;
      status = 'warning';
      feedback = 'Encuesta comunitaria en formato textual; migrar a matriz Likert de 5 reactivos.';
      evidence = 'Anexo 4 legacy detectado.';
    }

    criteria.push({
      id: 22,
      name: 'Instrumento de Evaluación de Impacto Comunitario (≥5 Reactivos)',
      dimension: dim6,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // C23: anexo6EvaluacionColegiado tiene reactivos ≥5
  {
    const reactivos = project.fase2Anexos?.anexo6EvaluacionColegiado?.reactivos || [];
    const isLegacy = !project.fase2Anexos?.anexo6EvaluacionColegiado && Boolean(project.fase2Anexos?.anexo6);

    let score = 1;
    let status: 'pass' | 'warning' | 'fail' = 'fail';
    let feedback = 'La rúbrica de evaluación del trabajo colegiado carece de reactivos suficientes (< 5).';
    let evidence = `${reactivos.length} reactivos registrados.`;

    if (reactivos.length >= 5) {
      score = 4;
      status = 'pass';
      feedback = 'Instrumento de autoevaluación colegiada docente completo con escala Likert y ≥5 reactivos transversales.';
      evidence = `${reactivos.length} reactivos colegiados estructurados.`;
    } else if (reactivos.length >= 1) {
      score = 2;
      status = 'warning';
      feedback = 'Rúbrica colegiada docente con reactivos insuficientes; se recomiendan al menos 5 criterios.';
      evidence = `${reactivos.length} reactivo(s) registrado(s).`;
    } else if (isLegacy) {
      score = 3;
      status = 'warning';
      feedback = 'Evaluación docente en formato textual; migrar a matriz Likert de 5 reactivos.';
      evidence = 'Anexo 6 legacy detectado.';
    }

    criteria.push({
      id: 23,
      name: 'Evaluación Formativa del Trabajo Colegiado Docente (≥5 Reactivos)',
      dimension: dim6,
      expectedLevel: 'Bueno (4)',
      score,
      status,
      feedback,
      evidenceFound: evidence,
    });
  }

  // ==========================================================================
  // NORMALIZACIÓN Y RESULTADO GLOBAL
  // ==========================================================================
  // Máximo teórico = 23 criterios * 4 puntos = 92 puntos
  const totalScoreRaw = criteria.reduce((sum, c) => sum + c.score, 0);
  const percentage = Math.min(100, Math.round((totalScoreRaw / 92) * 100));

  let overallStatus: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes' = 'requiere_ajustes';
  if (percentage >= 90) {
    overallStatus = 'aprobado_excelente';
  } else if (percentage >= 70) {
    overallStatus = 'aprobado';
  }

  const passedCount = criteria.filter(c => c.status === 'pass').length;
  const warningCount = criteria.filter(c => c.status === 'warning').length;
  const failedCount = criteria.filter(c => c.status === 'fail').length;

  return {
    totalScore: percentage,
    percentage,
    status: overallStatus,
    criteria,
    summary: {
      passedCount,
      warningCount,
      failedCount,
    },
  };
}
