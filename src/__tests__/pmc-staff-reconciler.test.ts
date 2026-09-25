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
} from '@/lib/pmc/staff-reconciler';

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
    expect(result.staff[1].cargo).toBe('Docente');
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
});
