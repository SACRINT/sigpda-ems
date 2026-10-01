/**
 * pmc-staff-reconciler.test.ts
 *
 * Tests unitarios para el motor arquitectónico de reconciliación de plantilla PMC.
 * SIGPDA-EMS · SEMS Puebla MCCEMS
 */

import { describe, it, expect } from 'vitest';
import {
  reconcilePmcStaff,
  isValidStaffName,
  normalizeStaffName,
  derivePersonalMetasFromStaff,
  isCollectiveOrNonHumanEntity,
} from '@/lib/pmc/staff-reconciler';
import { cleanPmcPlaceholders } from '@/lib/pmc/plan-element-normalizer';

describe('PMC Staff Reconciler Engine', () => {
  it('1. isValidStaffName identifica correctamente nombres válidos y rechaza genéricos o nulos', () => {
    expect(isValidStaffName('Juan Rogelio García Escudero')).toBe(true);
    expect(isValidStaffName('María Elena Garro')).toBe(true);
    expect(isValidStaffName(null)).toBe(false);
    expect(isValidStaffName(undefined)).toBe(false);
    expect(isValidStaffName('')).toBe(false);
    expect(isValidStaffName('   ')).toBe(false);
    expect(isValidStaffName('Sin Asignar')).toBe(false);
    expect(isValidStaffName('vacante')).toBe(false);
    expect(isValidStaffName('Docente')).toBe(false);
    expect(isValidStaffName('Director')).toBe(false);
  });

  it('2. Normaliza nombres tolerando mayúsculas, acentos y espacios adicionales', () => {
    expect(normalizeStaffName('JUAN ROGELIO GARCÍA ESCUDERO')).toBe(
      normalizeStaffName('  juan rogelio   garcia escudero ')
    );
  });

  it('3. Garantiza que el Director siempre quede en el índice 0 cuando se provee directorName', () => {
    const result = reconcilePmcStaff({
      directorName: 'Juan Rogelio García Escudero',
      extractedStaff: [
        { nombre: 'Prof. Carlos Fuentes', cargo: 'Docente de tiempo completo' },
      ],
      participantes: [
        { nombre: 'Mtra. Octavio Paz', cargo: 'Docente' },
      ],
    });

    expect(result.staff.length).toBe(3);
    expect(result.totalStaff).toBe(3);
    expect(result.staff[0].nombre).toBe('Juan Rogelio García Escudero');
    expect(result.staff[0].cargo).toBe('Director(a)');
    expect(result.staff[1].nombre).toBe('Prof. Carlos Fuentes');
    expect(result.staff[2].nombre).toBe('Mtra. Octavio Paz');
  });

  it('4. Reconcilia director existente en lista reubicándolo al índice 0 y asegurando su cargo', () => {
    const result = reconcilePmcStaff({
      directorName: 'Juan Rogelio García Escudero',
      extractedStaff: [
        { nombre: 'Prof. Carlos Fuentes', cargo: 'Docente' },
        { nombre: 'Juan Rogelio García Escudero', cargo: 'Docente' },
      ],
    });

    expect(result.staff.length).toBe(2);
    expect(result.staff[0].nombre).toBe('Juan Rogelio García Escudero');
    expect(result.staff[0].cargo).toBe('Director(a)');
    expect(result.staff[1].nombre).toBe('Prof. Carlos Fuentes');
  });

  it('5. Filtra entradas nulas o vacías que provengan de respuestas imperfectas de IA', () => {
    const result = reconcilePmcStaff({
      directorName: 'Juan Rogelio García Escudero',
      extractedStaff: [
        { nombre: null, cargo: 'Docente' },
        { nombre: '', cargo: 'Docente' },
        { nombre: '   ', cargo: null },
      ],
      participantes: [
        { nombre: null, cargo: null },
      ],
    });

    expect(result.staff.length).toBe(1);
    expect(result.totalStaff).toBe(1);
    expect(result.staff[0].nombre).toBe('Juan Rogelio García Escudero');
    expect(result.staff[0].cargo).toBe('Director(a)');
  });

  it('6. Desduplica participantes y staffData cuando un mismo maestro aparece en ambas fuentes', () => {
    const result = reconcilePmcStaff({
      directorName: 'Juan Rogelio García Escudero',
      extractedStaff: [
        {
          nombre: 'María Elena Garro',
          cargo: 'Docente',
          meta_individual: 'Acreditar diplomado de evaluación formativa',
        },
      ],
      participantes: [
        { nombre: 'María Elena Garro', cargo: 'Docente / CTE' },
      ],
    });

    expect(result.staff.length).toBe(2);
    const docente = result.staff.find((s) => s.nombre.includes('Elena Garro'));
    expect(docente).toBeDefined();
    expect(docente?.metas_individuales?.length).toBe(1);
    expect(docente?.metas_individuales?.[0].meta).toBe('Acreditar diplomado de evaluación formativa');
  });

  it('7. Integra docentes de F11 agrupando asignaturas y grupos', () => {
    const result = reconcilePmcStaff({
      directorName: 'Juan Rogelio García Escudero',
      f11Docentes: [
        { docente: 'Alfonso Reyes', asignatura: 'Lengua y Comunicación I', grupos: '1A' },
        { docente: 'Alfonso Reyes', asignatura: 'Literatura I', grupos: '3A' },
        { docente: 'Jaime Sabines', asignatura: 'Taller de Lectura', grupos: '1B' },
      ],
    });

    expect(result.staff.length).toBe(3);
    const alfonso = result.staff.find((s) => s.nombre === 'Alfonso Reyes');
    expect(alfonso?.asignaturas).toContain('Lengua y Comunicación I');
    expect(alfonso?.asignaturas).toContain('Literatura I');
    expect(alfonso?.grupos).toContain('1A');
    expect(alfonso?.grupos).toContain('3A');
  });

  it('8. Expande la plantilla con slots adicionales cuando targetTotalStaff (de 911) supera los nombres identificados', () => {
    const result = reconcilePmcStaff({
      directorName: 'Juan Rogelio García Escudero',
      extractedStaff: [
        { nombre: 'Rosario Castellanos', cargo: 'Docente' },
      ],
      targetTotalStaff: 5,
    });

    expect(result.totalStaff).toBe(5);
    expect(result.staff.length).toBe(5);
    expect(result.staff[0].nombre).toBe('Juan Rogelio García Escudero');
    expect(result.staff[1].nombre).toBe('Rosario Castellanos');
    expect(result.staff[2].nombre).toBe('');
    expect(result.staff[2].cargo).toBe('Docente de tiempo completo');
    expect(result.staff[4].nombre).toBe('');
  });

  it('9. Si no hay director ni nombres, entrega slot inicial seguro con director vacío pero no crashea', () => {
    const result = reconcilePmcStaff({});
    expect(result.totalStaff).toBe(1);
    expect(result.staff.length).toBe(1);
    expect(result.staff[0].cargo).toBe('Director(a)');
    expect(result.staff[0].nombre).toBe('');
  });

  it('10. Desduplica prefijos de títulos (PROFR., ING., LIC.) y unifica mayúsculas con nombre limpio', () => {
    const result = reconcilePmcStaff({
      directorName: 'Juan Rogelio García Escudero',
      extractedStaff: [
        { nombre: 'PROFR. JUAN ROGELIO GARCIA ESCUDERO', cargo: 'RESPONSABLE DEL BACHILLERATO' },
        { nombre: 'PROFR. GUSTAVO AARON DE LA FUENTE PORTILLA', cargo: 'DOCENTE Y TUTOR DEL PLANTEL' },
      ],
    });

    expect(result.staff.length).toBe(2);
    expect(result.totalStaff).toBe(2);
    expect(result.staff[0].nombre).toBe('Juan Rogelio García Escudero');
    expect(result.staff[0].cargo).toBe('Director(a)');
    expect(result.staff[1].nombre).toBe('Gustavo Aaron de la Fuente Portilla');
    expect(result.staff[1].cargo).toBe('Docente y tutor del plantel');
  });

  it('11. Filtra estudiantes (ALUMNO) y supervisores de la plantilla del personal del plantel', () => {
    const result = reconcilePmcStaff({
      directorName: 'Juan Rogelio García Escudero',
      participantes: [
        { nombre: 'PROFRA. ENIA HERNANDEZ GARCIA', cargo: 'DOCENTE Y TUTOR DE GRUPO' },
        { nombre: 'ISABELLA HERNANDEZ VAZQUEZ', cargo: 'ALUMNO' },
        { nombre: 'JULLIETTE HERNANDEZ HERNANDEZ', cargo: 'ALUMNO' },
        { nombre: 'ING. ALEJANDRO ESCAMILLA MARTINEZ', cargo: 'SUPERVISOR ESCOLAR ZONA 004' },
      ],
    });

    // Solo debe incluir a la docente Enia y al Director Juan Rogelio, excluyendo a las 2 alumnas y al supervisor
    expect(result.staff.length).toBe(2);
    expect(result.staff[0].nombre).toBe('Juan Rogelio García Escudero');
    expect(result.staff[1].nombre).toBe('Enia Hernandez Garcia');
  });

  it('12. derivePersonalMetasFromStaff deriva metas SMART oficiales por función para 100% de la plantilla', () => {
    const staff = [
      { nombre: 'Juan Rogelio García Escudero', cargo: 'Director(a)' },
      { nombre: 'Gustavo Aaron de la Fuente Portilla', cargo: 'Docente y tutor del plantel' },
      { nombre: 'Enia Hernández García', cargo: 'Docente y tutor de grupo' },
      { nombre: 'Pedro Páramo', cargo: 'Docente' },
    ];

    const metas = derivePersonalMetasFromStaff(staff, '2026-2027');

    expect(metas.length).toBe(4);
    // Director: Gestión de infraestructura y compromisos del PMC
    expect(metas[0].nombre).toBe('Juan Rogelio García Escudero');
    expect(metas[0].meta_individual).toContain('infraestructura');
    expect(metas[0].entregable).toContain('colegiado');

    // Tutor del plantel: Alertas tempranas y plan de tutorías
    expect(metas[1].nombre).toBe('Gustavo Aaron de la Fuente Portilla');
    expect(metas[1].meta_individual).toContain('tutorías');
    expect(metas[1].entregable).toContain('tutoría');

    // Tutor de grupo: Acompañamiento tutorial continuo
    expect(metas[2].nombre).toBe('Enia Hernández García');
    expect(metas[2].meta_individual).toContain('tutorial');

    // Docente: Secuencias didácticas situadas y evaluación formativa
    expect(metas[3].nombre).toBe('Pedro Páramo');
    expect(metas[3].meta_individual).toContain('secuencias didácticas');
  });

  it('13. derivePersonalMetasFromStaff respeta y preserva metas capturadas manualmente en el Paso 2', () => {
    const staff = [
      {
        nombre: 'Gustavo Aaron de la Fuente Portilla',
        cargo: 'Docente y tutor del plantel',
        metas_individuales: [
          {
            categoria: '1',
            tema: 'Formación docente',
            meta: 'Capacitación constante y seguimiento tutorial',
            estrategia: 'Inscripción y seguimiento en plataforma',
            entregable: 'Constancias COSFAC',
            periodo: '2026-2027',
          },
        ],
      },
      {
        nombre: 'Enia Hernández García',
        cargo: 'Docente y tutor de grupo',
        meta_individual: 'Acompañamiento focalizado a alumnos con reprobación en matemáticas',
      },
    ];

    const metas = derivePersonalMetasFromStaff(staff, '2026-2027');

    expect(metas.length).toBe(2);
    expect(metas[0].meta_individual).toBe('Capacitación constante y seguimiento tutorial');
    expect(metas[0].entregable).toBe('Constancias COSFAC');
    expect(metas[1].meta_individual).toBe('Acompañamiento focalizado a alumnos con reprobación en matemáticas');
  });

  it('14. Permite emparejar y podar metas usando normalizeStaffName ante variaciones de títulos y mayúsculas (H-045)', () => {
    const rawStaffMember = { nombre: 'MTRA. JUANA GARCÍA', cargo: 'Docente' };
    const derivedMetas = derivePersonalMetasFromStaff([rawStaffMember], '2026-2027');

    expect(derivedMetas.length).toBe(1);
    expect(derivedMetas[0].nombre).toBe('Juana García');

    const removedNorm = normalizeStaffName(rawStaffMember.nombre);
    const metaNorm = normalizeStaffName(derivedMetas[0].nombre);
    expect(removedNorm).toBe(metaNorm);

    const remaining = derivedMetas.filter(m => normalizeStaffName(m.nombre) !== removedNorm);
    expect(remaining.length).toBe(0);
  });

  it('15. isCollectiveOrNonHumanEntity filtra entidades colectivas complejas de la plantilla', () => {
    expect(isCollectiveOrNonHumanEntity('Director, Docentes y Administrativos')).toBe(true);
    expect(isCollectiveOrNonHumanEntity('Director y docentes')).toBe(true);
    expect(isCollectiveOrNonHumanEntity('Director y docentes que imparten asignaturas socioemocionales y tutorías')).toBe(true);
    expect(isCollectiveOrNonHumanEntity('Director, Docentes, Administrativos, Comité de Salud y Padres de Familia')).toBe(true);
    expect(isCollectiveOrNonHumanEntity('Comité de Salud')).toBe(true);
    expect(isCollectiveOrNonHumanEntity('Padres de familia')).toBe(true);
    expect(isCollectiveOrNonHumanEntity('Adrián Hernández Cruz')).toBe(false);
    expect(isCollectiveOrNonHumanEntity('María Soledad Hernández Hernández')).toBe(false);

    const result = reconcilePmcStaff({
      directorName: 'Adrián Hernández Cruz',
      extractedStaff: [
        { nombre: 'Adrián Hernández Cruz', cargo: 'Director' },
        { nombre: 'Humberta Flores Martínez', cargo: 'Docente' },
        { nombre: 'Director, Docentes y Administrativos', cargo: 'Docente' },
        { nombre: 'Director y docentes', cargo: 'Docente' },
        { nombre: 'Director, Docentes, Administrativos, Comité de Salud y Padres de Familia', cargo: 'Docente' },
      ],
    });

    expect(result.staff.length).toBe(2);
    expect(result.staff.map((s) => s.nombre)).toEqual([
      'Adrián Hernández Cruz',
      'Humberta Flores Martínez',
    ]);
  });

  it('16. Desduplica apellidos abreviados (Hdez. -> Hernández) y promueve el nombre completo', () => {
    const result = reconcilePmcStaff({
      directorName: 'Adrián Hernández Cruz',
      extractedStaff: [
        { nombre: 'María Soledad Hdez. Hdez.', cargo: 'Docente' },
      ],
      participantes: [
        { nombre: 'María Soledad Hernández Hernández', cargo: 'Docente' },
      ],
    });

    expect(result.staff.length).toBe(2);
    const docente = result.staff.find((s) => s.cargo === 'Docente');
    expect(docente).toBeDefined();
    expect(docente?.nombre).toBe('María Soledad Hernández Hernández');
  });

  it('17. Pre-llena metas individuales de cada docente desde elementosPlan extraídos', () => {
    const result = reconcilePmcStaff({
      directorName: 'Adrián Hernández Cruz',
      extractedStaff: [
        { nombre: 'Humberta Flores Martínez', cargo: 'Docente' },
        { nombre: 'Ana Lilia Pérez Hernández', cargo: 'Docente' },
      ],
      elementosPlan: [
        {
          tipo: 'actividad',
          responsable: 'Mtra. Humberta Flores Martínez',
          texto_normalizado: 'Implementar asesorías sabatinas de fortalecimiento en lengua extranjera (Inglés)',
          categoria: 'Desarrollo académico y aprendizaje',
          tema: 'Acompañamiento pedagógico',
        },
        {
          tipo: 'actividad',
          responsable: 'Ana Lilia Pérez Hernández',
          texto_normalizado: 'Coordinar conferencias semestrales de salud integral y prevención',
          categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
          tema: 'Salud y bienestar socioemocional',
        },
      ],
    });

    expect(result.staff.length).toBe(3);
    const humberta = result.staff.find((s) => s.nombre === 'Humberta Flores Martínez');
    expect(humberta).toBeDefined();
    expect(humberta?.metas_individuales?.length).toBe(1);
    expect(humberta?.metas_individuales?.[0].meta).toContain('asesorías sabatinas');

    const derived = derivePersonalMetasFromStaff(result.staff, '2026-2027');
    const humbertaPersonal = derived.find((d) => d.nombre === 'Humberta Flores Martínez');
    expect(humbertaPersonal?.meta_individual).toContain('asesorías sabatinas');
  });

  it('18. cleanPmcPlaceholders erradica marcadores de borrador entre corchetes y restaura prosa limpia', () => {
    const dirty1 = 'Incrementar el porcentaje de aprobación al 85% para [POR DEFINIR: población objetivo] mediante [POR DEFINIR: estrategia situada] durante el ciclo escolar 2026-2027.';
    const cleaned1 = cleanPmcPlaceholders(dirty1);
    expect(cleaned1).not.toContain('[POR DEFINIR');
    expect(cleaned1).toContain('85%');
    expect(cleaned1).toContain('2026-2027');

    const dirty2 = 'Reducir el índice de abandono escolar en un 2% [POR DEFINIR: indicador cuantificable]';
    const cleaned2 = cleanPmcPlaceholders(dirty2);
    expect(cleaned2).toBe('Reducir el índice de abandono escolar en un 2%');
  });

  it('19. Tecomate: Distribuye actividades con responsables genéricos (Docentes, Tutor, Asesor) sin crear trabajadores fantasma (Alumnos, APF)', () => {
    const tecomateStaff = [
      { nombre: 'PROFR. JUAN ROGELIO GARCIA ESCUDERO', cargo: 'Responsable del Bachillerato' },
      { nombre: 'PROFR. GUSTAVO AARON DE LA FUENTE PORTILLA', cargo: 'Docente y tutor del plantel' },
      { nombre: 'PROFRA. ENIA HERNANDEZ GARCIA', cargo: 'Docente y tutor de grupo' },
      { nombre: 'PROFRA. MAYRA HERNANDEZ TOLENTINO', cargo: 'Docente y tutor de grupo' },
      { nombre: 'PROFR. ISRAEL BADILLO CRUZ', cargo: 'Docente de grupo' },
      { nombre: 'PROFR. ARTURO MONTAÑO JUAREZ', cargo: 'Docente de grupo' },
    ];

    const tecomateElementosPlan = [
      { tipo: 'actividad', responsable: 'Director', texto_normalizado: 'Toda la información deberá ser entregada a la dirección del plantel' },
      { tipo: 'actividad', responsable: 'Dirección del Plantel', texto_normalizado: 'Monitoreo de los resultados con frecuencia' },
      { tipo: 'actividad', responsable: 'Tutor del Plantel', texto_normalizado: 'Atención socioemocional a alumnos en riesgo' },
      { tipo: 'actividad', responsable: 'Asesor de grupo', texto_normalizado: 'Papiroflexia y medición de figuras geométricas' },
      { tipo: 'actividad', responsable: 'Docentes', texto_normalizado: 'Realizar rúbrica de control de aprendientes' },
      { tipo: 'actividad', responsable: 'Docentes', texto_normalizado: 'Monitorear inasistencias por WhatsApp' },
      { tipo: 'actividad', responsable: 'Docentes', texto_normalizado: 'Ejercicios matemáticos de operaciones básicas' },
      { tipo: 'actividad', responsable: 'Docentes', texto_normalizado: 'Aplicación de evaluaciones diagnósticas' },
      { tipo: 'actividad', responsable: 'Directivo y docentes', texto_normalizado: 'Realizar simulacros ante fenómenos naturales' },
      { tipo: 'actividad', responsable: 'Alumnos', texto_normalizado: 'Faena mensual de limpieza en el terreno escolar' },
      { tipo: 'actividad', responsable: 'Comité de APF', texto_normalizado: 'Gestionar materiales con el ejido El Tecomate' },
      { tipo: 'actividad', responsable: 'Autoridades', texto_normalizado: 'Reunión de coordinación comunitaria' },
    ];

    const result = reconcilePmcStaff({
      directorName: 'Juan Rogelio García Escudero',
      participantes: tecomateStaff,
      elementosPlan: tecomateElementosPlan,
    });

    // 1. Debe haber exactamente 6 trabajadores (ningún fantasma como Alumnos, APF o Docentes)
    expect(result.staff.length).toBe(6);
    expect(result.totalStaff).toBe(6);

    const nombres = result.staff.map((s) => s.nombre);
    expect(nombres).toContain('Juan Rogelio García Escudero');
    expect(nombres).toContain('Gustavo Aaron de la Fuente Portilla');
    expect(nombres).toContain('Enia Hernandez Garcia');
    expect(nombres).toContain('Mayra Hernandez Tolentino');
    expect(nombres).toContain('Israel Badillo Cruz');
    expect(nombres).toContain('Arturo Montaño Juarez');

    expect(nombres).not.toContain('Alumnos');
    expect(nombres).not.toContain('Comité de APF');
    expect(nombres).not.toContain('Docentes');
    expect(nombres).not.toContain('Dirección del Plantel');

    // 2. Todos los 6 docentes reales deben tener metas individuales pre-asignadas
    for (const member of result.staff) {
      expect((member.metas_individuales?.length || 0) + (member.meta_individual ? 1 : 0)).toBeGreaterThan(0);
    }
  });

  it('20. Con allowEmptyPadding: false, jamás rellena con slots vacíos aunque targetTotalStaff sea mayor', () => {
    const result = reconcilePmcStaff({
      targetTotalStaff: 8,
      allowEmptyPadding: false,
      directorName: 'Juan Rogelio García Escudero',
      extractedStaff: [
        { nombre: 'Gustavo Aaron de la Fuente Portilla', cargo: 'Docente y tutor del plantel' },
        { nombre: 'Enia Hernandez Garcia', cargo: 'Docente y tutor de grupo' },
      ],
    });

    expect(result.staff.length).toBe(3);
    expect(result.totalStaff).toBe(3);
    expect(result.staff.some((s) => !s.nombre)).toBe(false);
  });
});
