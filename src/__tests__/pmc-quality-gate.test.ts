// src/__tests__/pmc-quality-gate.test.ts
/**
 * Tests unitarios para pmc-quality-gate.ts
 * Fase 12A · SIGPDA-EMS
 *
 * Sin mocking: funciones puras que solo reciben y retornan datos.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGlobalPmcScore,
  auditPmcProject,
  formatPmcAuditReport,
  PMC_DIMENSIONS,
  findForbiddenPlatformTerms,
  containsForbiddenPlatformTerms,
  FORBIDDEN_PLATFORM_TERMS_REGEX,
} from '@/lib/pmc-quality-gate';
import type { PmcProject } from '@/types/pmc';

// ── Fixtures ────────────────────────────────────────────────────────────────

const EMPTY_PROJECT: PmcProject = {
  id: 'pmc-test-empty',
};

const COMPLETE_PROJECT: PmcProject = {
  id: 'pmc-test-complete',
  school_name: 'Bachillerato Tecnologico 123',
  school_cct: '21EBH0001X',
  school_zone: 'Zona 012',
  municipality: 'Puebla, Pue.',
  director_name: 'Directora Maria Lopez Garcia',
  ciclo_escolar: '2026-2027',
  subsystem: 'DGB',
  total_staff: 18,
  staff_data: [
    { nombre: 'Ana Garcia', cargo: 'Docente', funcion: 'Matematicas', formacion: 'Ing. Sistemas', antiguedad: 5 },
    { nombre: 'Luis Torres', cargo: 'Docente', funcion: 'Espanol', formacion: 'Licenciatura en Letras', antiguedad: 3 },
    { nombre: 'Rosa Martinez', cargo: 'Orientador', funcion: 'Orientacion Educativa', formacion: 'Psicologia', antiguedad: 7 },
  ],
  indicadores_academicos: {
    aprobacion_ant: 78,
    reprobacion_ant: 22,
    abandono_ant: 5,
    et_ant: 74,
    aprobacion_meta: 85,
    abandono_meta: 3,
    et_meta: 80,
    matricula: 240,
  },
  diagnostico_comunidad:
    'La comunidad se ubica en zona semiurbana de Puebla con alta presencia de industria maquiladora. El contexto familiar presenta desafios de ausentismo y trabajo infantil.',
  foda: {
    fortalezas: 'Personal docente comprometido con experiencia de mas de 5 anios en promedio y uso de tecnologia educativa.',
    oportunidades: 'Convenios con empresas locales para practicas profesionales y vinculacion comunitaria activa.',
    debilidades: 'Infraestructura de talleres con equipamiento obsoleto que requiere actualizacion urgente.',
    amenazas: 'Alta tasa de migracion laboral de jovenes egresados y competencia de otras opciones educativas.',
  },
  categorias_priorizadas: [
    { id: 'cat-1', nombre: 'Logro Academico', temas: ['Lectura y escritura avanzada', 'Matematicas financieras'] },
    { id: 'cat-2', nombre: 'Convivencia Escolar', temas: ['Habilidades socioemocionales', 'Prevencion de violencia'] },
    { id: 'cat-3', nombre: 'Vinculacion Comunitaria', temas: ['Proyectos productivos locales'] },
  ],
  diagnostico_generado: {
    presentacion:
      'La presente planeacion institucional responde a los lineamientos MCCEMS 2026-2027 de SEMS Puebla.',
    contexto: 'El plantel atiende una poblacion de 240 estudiantes con diversidad socioeconomica significativa.',
    analisis_indicadores: 'El indice de aprobacion anterior fue de 78%, con meta de 85% para el ciclo actual.',
    sintesis_foda: 'Las fortalezas institucionales superan las debilidades cuando se capitaliza el apoyo empresarial.',
    priorizacion: 'Se priorizan logro academico y convivencia como ejes transversales del PMC 2026-2027.',
  },
  plan_accion: {
    metas_institucionales: [
      {
        categoria: 'Logro Academico',
        nombre_categoria: 'Reduccion de reprobacion',
        tema: 'Estrategias de ensenanza diferenciada',
        meta: 'Reducir el indice de reprobacion al 15% al finalizar el primer semestre',
        estrategia: 'Grupos de tutoria entre pares y reforzamiento academico quincenal',
        linea_base: 'Reprobacion actual: 22%',
        personal_designado: 'Docentes de area y orientador',
        entregable: 'Reporte de avance mensual con lista de asistencia',
        periodo_inicio: 'Agosto 2026',
        periodo_fin: 'Enero 2027',
      },
      {
        categoria: 'Convivencia Escolar',
        nombre_categoria: 'Clima de aula positivo',
        tema: 'Habilidades socioemocionales',
        meta: 'Implementar 2 talleres de competencias socioemocionales por semestre',
        estrategia: 'Sesiones quincenales de 50 minutos con dinamicas colaborativas',
        linea_base: 'Sin registro previo de talleres formales',
        personal_designado: 'Orientador educativo y psicologo',
        entregable: 'Fotografias y lista de participantes firmada',
        periodo_inicio: 'Septiembre 2026',
        periodo_fin: 'Diciembre 2026',
      },
    ],
    metas_personales: [
      {
        nombre: 'Ana Garcia',
        cargo: 'Docente de Matematicas',
        meta_individual: 'Desarrollar material didactico contextualizado para el grupo 3A',
        estrategia: 'Investigacion-accion con retroalimentacion semanal',
        entregable: 'Portafolio de actividades disenadas',
        periodo: 'Agosto-Diciembre 2026',
      },
    ],
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('pmc-quality-gate — calculateGlobalPmcScore', () => {

  it('proyecto vacio -> REQUIERE_REVISION y todos los criterios en fail', () => {
    const audit = calculateGlobalPmcScore(EMPTY_PROJECT);
    expect(audit.overallStatus).toBe('REQUIERE_REVISION');
    expect(audit.percentage).toBeLessThan(50);
    for (const c of audit.criteria) {
      expect(c.status).toBe('fail');
    }
    expect(audit.passedCriteria).toBe(0);
    expect(audit.failedCriteria).toBe(11);
  });

  it('proyecto completo -> overallStatus SATISFACTORIO o superior (score >= 70%)', () => {
    const audit = calculateGlobalPmcScore(COMPLETE_PROJECT);
    // El fixture cubre todos los campos relevantes -> SATISFACTORIO (>=70%) garantizado
    expect(audit.percentage).toBeGreaterThanOrEqual(70);
    expect(['EXCELENTE', 'SATISFACTORIO']).toContain(audit.overallStatus);
    expect(audit.passedCriteria).toBeGreaterThan(0);
    expect(audit.criteria).toHaveLength(11);
    expect(typeof audit.auditedAt).toBe('string');
  });

  it('CCT invalido con solo 4 campos -> criterio PMC-C1 en warning', () => {
    const project: PmcProject = {
      id: 'pmc-cct-invalid',
      school_name: 'Escuela de Prueba',
      school_cct: 'ABC123',
      municipality: 'Puebla',
      director_name: 'Director Test',
    };
    const audit = calculateGlobalPmcScore(project);
    const c1 = audit.criteria.find(c => c.id === 'PMC-C1');
    expect(c1).toBeDefined();
    expect(c1!.status).toBe('warning');
    expect(c1!.score).toBe(5);
  });

  it('CCT valido (21EBH0001X) + 6 campos -> criterio PMC-C1 pass con score 8', () => {
    const project: PmcProject = {
      id: 'pmc-cct-valid',
      school_name: 'Bachillerato Estatal 001',
      school_cct: '21EBH0001X',
      school_zone: 'Zona 001',
      municipality: 'Cholula, Pue.',
      director_name: 'Lic. Roberto Cruz',
      ciclo_escolar: '2026-2027',
    };
    const audit = calculateGlobalPmcScore(project);
    const c1 = audit.criteria.find(c => c.id === 'PMC-C1');
    expect(c1!.status).toBe('pass');
    expect(c1!.score).toBe(8);
    expect(c1!.maxScore).toBe(8);
  });

  it('FODA con las 4 dimensiones -> criterio PMC-C5 en pass', () => {
    const project: PmcProject = {
      id: 'pmc-foda-complete',
      foda: {
        fortalezas: 'Personal docente altamente capacitado en TIC y metodologias activas de aprendizaje.',
        oportunidades: 'Programas gubernamentales de becas y apoyo a planteles de nueva creacion.',
        debilidades: 'Escasez de recursos para infraestructura deportiva y laboratorio de ciencias.',
        amenazas: 'Inseguridad en la zona que reduce la participacion en actividades extraescolares.',
      },
    };
    const audit = calculateGlobalPmcScore(project);
    const c5 = audit.criteria.find(c => c.id === 'PMC-C5');
    expect(c5).toBeDefined();
    expect(c5!.status).toBe('pass');
  });

  it('plan_accion null -> criterios PMC-C8, C9, C10, C11 en fail', () => {
    const project: PmcProject = { id: 'pmc-no-plan', plan_accion: null };
    const audit = calculateGlobalPmcScore(project);
    const c8 = audit.criteria.find(c => c.id === 'PMC-C8');
    const c9 = audit.criteria.find(c => c.id === 'PMC-C9');
    const c10 = audit.criteria.find(c => c.id === 'PMC-C10');
    const c11 = audit.criteria.find(c => c.id === 'PMC-C11');
    expect(c8!.status).toBe('fail');
    expect(c9!.status).toBe('fail');
    expect(c10!.status).toBe('fail');
    expect(c11!.status).toBe('fail');
    expect(audit.failedCriteria).toBeGreaterThanOrEqual(4);
  });

  it('plan_accion con termino prohibido "SIGPDA-EMS" -> criterio PMC-C11 y PMC-C8 en fail', () => {
    const contaminatedProject: PmcProject = {
      ...COMPLETE_PROJECT,
      id: 'pmc-test-contaminated',
      plan_accion: {
        metas_institucionales: [
          {
            categoria: '1',
            nombre_categoria: 'Desarrollo académico y aprendizaje',
            tema: 'Seguimiento al desempeño docente en el aula',
            diagnostico_meta: 'Rezago en planeación colegiada',
            meta: 'Lograr que el 100% de la plantilla docente consolide y valide sus planeaciones didácticas en el SIGPDA-EMS durante el ciclo escolar 2026-2027 en Puebla',
            estrategia: 'Reuniones quincenales de academia docente para armonizar secuencias didácticas',
            linea_base: 'Eficiencia terminal: 74%',
            personal_designado: 'Director y Consejo Académico',
            entregable: 'Concentrado de planeaciones didácticas registradas y evaluadas en SIGPDA-EMS',
            periodo_inicio: '08/2026',
            periodo_fin: '06/2027',
          },
        ],
        metas_personales: [],
      },
    };
    const audit = calculateGlobalPmcScore(contaminatedProject);

    const c11 = audit.criteria.find(c => c.id === 'PMC-C11');
    expect(c11).toBeDefined();
    expect(c11!.status).toBe('fail');
    expect(c11!.score).toBe(0);
    expect(c11!.feedback).toContain('términos prohibidos de plataforma interna');
    expect(c11!.evidenceFound).toContain('SIGPDA-EMS');

    const c8 = audit.criteria.find(c => c.id === 'PMC-C8');
    expect(c8).toBeDefined();
    expect(c8!.status).toBe('fail');
    expect(c8!.score).toBe(0);
    expect(c8!.feedback).toContain('plataformas privadas');
  });

  it('auditPmcProject es alias exacto de calculateGlobalPmcScore', () => {
    const r1 = calculateGlobalPmcScore(COMPLETE_PROJECT);
    const r2 = auditPmcProject(COMPLETE_PROJECT);
    expect(r1.percentage).toBe(r2.percentage);
    expect(r1.overallStatus).toBe(r2.overallStatus);
    expect(r1.passedCriteria).toBe(r2.passedCriteria);
    expect(r1.criteria.map(c => c.id)).toEqual(r2.criteria.map(c => c.id));
  });

  it('formatPmcAuditReport genera string con dictamen tecnico y score', () => {
    const audit = calculateGlobalPmcScore(COMPLETE_PROJECT);
    const report = formatPmcAuditReport(audit);
    expect(typeof report).toBe('string');
    expect(report).toContain('DICTAMEN');
    expect(report).toContain('%');
    expect(report).toContain(PMC_DIMENSIONS.DIM1);
  });

  it('containsForbiddenPlatformTerms detecta variantes de SIGPDA-EMS, SIGPDA y es insensible a mayusculas/minusculas', () => {
    expect(containsForbiddenPlatformTerms('Consolidar en el SIGPDA-EMS durante el ciclo')).toBe(true);
    expect(containsForbiddenPlatformTerms('Registradas en SIGPDA EMS')).toBe(true);
    expect(containsForbiddenPlatformTerms('Uso de la plataforma SIGPDA')).toBe(true);
    expect(containsForbiddenPlatformTerms('subir a sigpda-ems')).toBe(true);
    expect(containsForbiddenPlatformTerms('registro en sigpda')).toBe(true);
    expect(containsForbiddenPlatformTerms({ nested: { deep: 'Metas en SIGPDA-EMS' } })).toBe(true);

    // Terminos permitidos / oficiales
    expect(containsForbiddenPlatformTerms('Plataforma institucional de planeacion docente')).toBe(false);
    expect(containsForbiddenPlatformTerms('Concentrado de planeaciones didacticas registradas')).toBe(false);
    expect(containsForbiddenPlatformTerms('Formatos oficiales SEMS Puebla')).toBe(false);

    const matches = findForbiddenPlatformTerms({
      meta: 'Metas en SIGPDA-EMS',
      entregable: 'Reporte en SIGPDA',
    });
    expect(matches).toHaveLength(2);
    expect(matches).toContain('SIGPDA-EMS');
    expect(matches).toContain('SIGPDA');

    expect(FORBIDDEN_PLATFORM_TERMS_REGEX.test('SIGPDA')).toBe(true);
    expect(FORBIDDEN_PLATFORM_TERMS_REGEX.test('SIGPDA-EMS')).toBe(true);
    expect(FORBIDDEN_PLATFORM_TERMS_REGEX.test('Plataforma Institucional')).toBe(false);
  });

});
