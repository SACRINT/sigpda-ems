import { describe, it, expect } from 'vitest';
import {
  CATALOGO_BASE_CRITERIOS_PMC,
  synthesizeContextualizedMeta,
} from '@/lib/constants/pmc-catalogo-criterios';
import {
  AREAS_OBLIGATORIAS_51,
  resolveAreaObligatoria51,
  PENDIENTE_DEFINICION_51,
} from '@/lib/pmc-docx-generator';
import type { PmcProject, PmcMetaInstitucional } from '@/types/pmc';

describe('Catálogo Base Institucional de Criterios PMC y Formato 5.1 (MCCEMS Puebla)', () => {
  const mockHeroesProject: Partial<PmcProject> = {
    school_name: 'Bachillerato General Oficial “Héroes de la Patria”',
    school_cct: '21EBH0200X',
    municipality: 'Venustiano Carranza',
    locality: 'Coronel Tito Hernández (María Andrea)',
    director_name: 'Lic. Adrián Hernández Cruz',
    ciclo_escolar: '2026-2027',
    total_staff: 16,
    staff_data: [
      { nombre: 'Lic. Adrián Hernández Cruz', cargo: 'Director' },
      { nombre: 'José Alain Rosales García', cargo: 'Docente', funcion: 'Coordinador de Vinculación' },
      { nombre: 'Humberta Flores Martínez', cargo: 'Docente', funcion: 'Tutor de Plantel' },
    ],
    indicadores_academicos: {
      matricula: 170,
      reprobacion_ant: 16.9,
      aprobacion_ant: 83.1,
      abandono_ant: 4.2,
      et_ant: 88.5,
    },
  };

  it('1. El catálogo base contiene las 4 áreas obligatorias del Formato 5.1', () => {
    const ids = CATALOGO_BASE_CRITERIOS_PMC.map(c => c.areaObligatoriaId).filter(Boolean);
    expect(ids).toContain('area-1-indicadores');
    expect(ids).toContain('area-2-desempeno-docente');
    expect(ids).toContain('area-3-vinculacion');
    expect(ids).toContain('area-4-violencia');
  });

  it('2. synthesizeContextualizedMeta genera meta situada para Seguimiento al desempeño docente', () => {
    const metaDocente = synthesizeContextualizedMeta('area-2-desempeno-docente', mockHeroesProject);

    expect(metaDocente.tema).toBe('Seguimiento al desempeño docente en el aula');
    expect(metaDocente.categoria).toBe('2');
    expect(metaDocente.nombre_categoria).toBe('Gestión y administración escolar');
    expect(metaDocente.meta).toContain('Héroes de la Patria');
    expect(metaDocente.meta).toContain('Coronel Tito Hernández');
    expect(metaDocente.meta).toContain('acompañamiento pedagógico y seguimiento al desempeño docente en el aula');
    expect(metaDocente.personal_designado).toContain('Lic. Adrián Hernández Cruz');
    expect(metaDocente.subcategorias_vinculadas).toContain('SEGUIMIENTO AL DESEMPEÑO DOCENTE EN EL AULA');
    expect(metaDocente.entregable).toContain('observación áulica formativa');
    expect(metaDocente.meta).not.toContain('{ESCUELA}');
    expect(metaDocente.meta).not.toContain('{DIRECTOR}');
  });

  it('3. synthesizeContextualizedMeta genera meta situada para Vinculación con centros educativos y empresas', () => {
    const metaVinculacion = synthesizeContextualizedMeta('area-3-vinculacion', mockHeroesProject);

    expect(metaVinculacion.tema).toBe('Vinculación con centros educativos, empresas, fundaciones o instituciones públicas');
    expect(metaVinculacion.categoria).toBe('2');
    expect(metaVinculacion.meta).toContain('vinculación estratégica');
    expect(metaVinculacion.meta).toContain('Venustiano Carranza');
    expect(metaVinculacion.personal_designado).toContain('Lic. Adrián Hernández Cruz');
    expect(metaVinculacion.subcategorias_vinculadas).toContain('VINCULACIÓN CON INSTITUCIONES EDUCATIVAS');
    expect(metaVinculacion.entregable).toContain('convenios y cartas compromiso');
    expect(metaVinculacion.meta).not.toContain('{ESCUELA}');
    expect(metaVinculacion.meta).not.toContain('{LOCALIDAD}');
  });

  it('4. Anti-clonación en resolveAreaObligatoria51: Seguimiento al desempeño docente NO clona la meta académica', () => {
    const metaAprobacion: PmcMetaInstitucional = {
      categoria: '1',
      nombre_categoria: 'Desarrollo académico y aprendizaje',
      tema: 'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)',
      meta: 'Incrementar en un 5% la tasa de aprobación escolar en la matrícula de 170 estudiantes del Bachillerato General Oficial "Héroes de la Patria" implementando asesorías académicas en Coronel Tito Hernández, Puebla.',
      estrategia: '1. Diagnóstico EDIEMS. 2. Asesorías sabatinas. 3. Corte post-test.',
      personal_designado: 'Lic. Adrián Hernández Cruz (Director) y Colegiado Docente',
      subcategorias_vinculadas: ['INDICADORES ACADÉMICOS', 'TRABAJO COLEGIADO', 'ORIENTACIÓN Y TUTORÍA'],
      entregable: 'Reporte semestral F11C',
      linea_base: '83.1% de aprobación',
    };

    const metas = [metaAprobacion];
    const usedIndices = new Set<number>();

    // Área 1: Indicadores académicos debe resolver la meta de aprobación y ocupar el índice 0
    const area1Config = AREAS_OBLIGATORIAS_51[0];
    const res1 = resolveAreaObligatoria51(area1Config, metas, usedIndices);
    expect(res1.matchingMeta).toBe(metaAprobacion);
    expect(usedIndices.has(0)).toBe(true);

    // Área 2: Seguimiento al desempeño docente NO debe robarse la meta 0
    const area2Config = AREAS_OBLIGATORIAS_51[1];
    const res2 = resolveAreaObligatoria51(area2Config, metas, usedIndices);
    expect(res2.matchingMeta).toBeUndefined();
    expect(res2.metaEstablecida).toBe(PENDIENTE_DEFINICION_51);
  });

  it('5. Anti-falso-positivo en Vinculación: NO captura metas de infraestructura que mencionen jornadas comunitarias', () => {
    const metaInfraestructura: PmcMetaInstitucional = {
      categoria: '2',
      nombre_categoria: 'Gestión y administración escolar',
      tema: 'Gestión y administración de recursos, equipamientos y servicios',
      meta: 'Gestionar y ejecutar el mantenimiento correctivo y preventivo del 100% de los espacios educativos en Coronel Tito Hernández, Puebla.',
      estrategia: '1. Inventario físico. 2. Gestión de recursos. 3. Jornadas comunitarias de mantenimiento escolar.',
      personal_designado: 'Lic. Adrián Hernández Cruz (Director)',
      subcategorias_vinculadas: ['GESTIÓN Y ADMINISTRACIÓN DE RECURSOS, EQUIPAMIENTOS Y SERVICIOS', 'PROYECTO ESCOLAR COMUNITARIO (PEC)'],
      entregable: 'Inventario físico y actas de entrega-recepción',
      linea_base: 'La infraestructura requiere mantenimiento',
    };

    const metas = [metaInfraestructura];
    const usedIndices = new Set<number>();

    const area3Config = AREAS_OBLIGATORIAS_51[2]; // Vinculación
    const res3 = resolveAreaObligatoria51(area3Config, metas, usedIndices);

    // Debe ser undefined porque jornadas comunitarias no es vinculación interinstitucional
    expect(res3.matchingMeta).toBeUndefined();
    expect(res3.metaEstablecida).toBe(PENDIENTE_DEFINICION_51);
  });

  it('6. Resolución completa de las 4 áreas sin colisiones cuando el plan cuenta con metas específicas', () => {
    const meta1 = synthesizeContextualizedMeta('area-1-indicadores', mockHeroesProject);
    const meta2 = synthesizeContextualizedMeta('area-2-desempeno-docente', mockHeroesProject);
    const meta3 = synthesizeContextualizedMeta('area-3-vinculacion', mockHeroesProject);
    const meta4 = synthesizeContextualizedMeta('area-4-violencia', mockHeroesProject);

    const todas = [meta1, meta2, meta3, meta4];
    const used = new Set<number>();

    const r1 = resolveAreaObligatoria51(AREAS_OBLIGATORIAS_51[0], todas, used);
    const r2 = resolveAreaObligatoria51(AREAS_OBLIGATORIAS_51[1], todas, used);
    const r3 = resolveAreaObligatoria51(AREAS_OBLIGATORIAS_51[2], todas, used);
    const r4 = resolveAreaObligatoria51(AREAS_OBLIGATORIAS_51[3], todas, used);

    expect(r1.matchingMeta?.tema).toContain('Indicadores académicos');
    expect(r2.matchingMeta?.tema).toContain('desempeño docente en el aula');
    expect(r3.matchingMeta?.tema).toContain('Vinculación con centros educativos');
    expect(r4.matchingMeta?.tema).toContain('violencia');

    expect(used.size).toBe(4);
  });

  it('7. synthesizeContextualizedMeta NO fabrica 14 docentes, 170 matrícula, 15% reprobación ni 4 convenios si los datos están ausentes (H-301)', () => {
    const emptyProject: Partial<PmcProject> = {
      school_name: 'Bachillerato General Oficial Cuauhtémoc',
      locality: 'Zacatlán',
      municipality: 'Zacatlán',
      staff_data: [],
      indicadores_academicos: {},
    };

    const metaDocente = synthesizeContextualizedMeta('area-2-desempeno-docente', emptyProject);
    expect(metaDocente.meta).not.toContain('14 docentes');
    expect(metaDocente.meta).not.toContain('(14 docentes)');
    expect(metaDocente.diagnostico_meta).not.toContain('14 docentes');

    const metaAcademica = synthesizeContextualizedMeta('area-1-indicadores', emptyProject);
    expect(metaAcademica.meta).not.toContain('170 estudiantes');
    expect(metaAcademica.meta).not.toContain('170');
    expect(metaAcademica.diagnostico_meta).not.toContain('15%');
    expect(metaAcademica.linea_base).toContain('pendiente de registro');

    const metaVinculacion = synthesizeContextualizedMeta('area-3-vinculacion', emptyProject);
    expect(metaVinculacion.meta).not.toContain('4 instituciones');
    expect(metaVinculacion.meta).not.toContain('{NUM_CONVENIOS}');
  });
});

