import { describe, it, expect } from 'vitest';
import {
  F11ExtractSchema,
  buildF11ExtractionPrompt,
  F11_EXTRACTION_SYSTEM_PROMPT,
} from '@/lib/prompts/f11-extraction';
import {
  Estadistica911ExtractSchema,
  buildEstadistica911ExtractionPrompt,
  ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT,
} from '@/lib/prompts/estadistica-911-extraction';

describe('Blindaje Curricular y Extracción: F11 y Estadística 911 (N-002)', () => {

  // ── 1. F11 Extraction Schema y Prompt ──────────────────────────────────────
  describe('1. Formato F11 (Calificaciones y Control Escolar)', () => {
    it('F11ExtractSchema valida un payload completo de fin de ciclo anterior', () => {
      const payload = {
        cicloEscolar: '2025-2026',
        schoolName: 'Bachillerato General Héroes de la Patria',
        schoolCct: '21EBH0200X',
        totalAlumnos: 245,
        totalDocentes: 14,
        totalGrupos: 6,
        promedioGeneral: 8.3,
        aprobadosPorcentaje: 91.5,
        reprobadosPorcentaje: 8.5,
        promediosPorAsignatura: {
          'Pensamiento Matemático I': 7.1,
          'Lenguaje y Comunicación I': 8.6,
          'Inglés I': 8.9,
        },
        docentesPorAsignatura: [
          {
            asignatura: 'Pensamiento Matemático I',
            docente: 'Humberta Flores Martínez',
            grupos: '1A, 1B',
            promedio: 7.1,
          },
        ],
        observaciones: 'Calificaciones consolidadas al cierre de ciclo',
      };

      const result = F11ExtractSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schoolCct).toBe('21EBH0200X');
        expect(result.data.promedioGeneral).toBe(8.3);
        expect(result.data.promediosPorAsignatura['Pensamiento Matemático I']).toBe(7.1);
        expect(result.data.docentesPorAsignatura).toHaveLength(1);
      }
    });

    it('F11ExtractSchema asigna valores predeterminados y tolera campos ausentes', () => {
      const minimalPayload = {};
      const result = F11ExtractSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schoolName).toBe('');
        expect(result.data.totalAlumnos).toBeUndefined();
        expect(result.data.promediosPorAsignatura).toEqual({});
        expect(result.data.docentesPorAsignatura).toEqual([]);
      }
    });

    it('F11ExtractSchema coacciona strings numéricos a números válidos', () => {
      const stringNumericPayload = {
        totalAlumnos: '180',
        promedioGeneral: '7.85',
        aprobadosPorcentaje: '88.2',
        reprobadosPorcentaje: '11.8',
        promediosPorAsignatura: {
          Física: '6.9',
        },
      };

      const result = F11ExtractSchema.safeParse(stringNumericPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalAlumnos).toBe(180);
        expect(result.data.promedioGeneral).toBe(7.85);
        expect(result.data.aprobadosPorcentaje).toBe(88.2);
        expect(result.data.promediosPorAsignatura['Física']).toBe(6.9);
      }
    });

    it('buildF11ExtractionPrompt recorta texto excesivo y preserva instrucciones clave', () => {
      const longText = 'A'.repeat(80000);
      const prompt = buildF11ExtractionPrompt(longText);

      expect(prompt).toContain('Analiza con minuciosidad');
      expect(prompt).toContain('promediosPorAsignatura');
      expect(prompt).toContain('docentesPorAsignatura');
      // Asegura que se recortó a 75000 chars
      expect(prompt.length).toBeLessThan(80000);
      expect(F11_EXTRACTION_SYSTEM_PROMPT).toContain('Control Escolar');
    });
  });

  // ── 2. Estadística 911 Schema y Momentos ───────────────────────────────────
  describe('2. Estadística Escolar Formato 911 (Inicio y Fin de Cursos)', () => {
    it('Estadistica911ExtractSchema valida un reporte de fin de ciclo anterior', () => {
      const payloadFin = {
        cicloEscolar: '2025-2026',
        schoolName: 'Centro de Estudios de Bachillerato Héroes de la Patria',
        schoolCct: '21EBH0200X',
        matricula: 260,
        matriculaAnterior: 275,
        egresados: 78,
        egresadosAnterior: 72,
        bajasDefinitivas: 14,
        abandonoPorcentaje: 5.38,
        abandonoAnterior: 6.2,
        eficienciaTerminal: 89.2,
        eficienciaTerminalAnterior: 86.5,
        aprobacionPorcentaje: 92.1,
        reprobacionPorcentaje: 7.9,
        tipoReporte: 'fin',
        momento: 'fin_anterior',
        totalDocentes: 15,
        totalGrupos: 6,
        gruposPorGrado: {
          '1er Semestre': 2,
          '3er Semestre': 2,
          '5to Semestre': 2,
        },
      };

      const result = Estadistica911ExtractSchema.safeParse(payloadFin);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.momento).toBe('fin_anterior');
        expect(result.data.tipoReporte).toBe('fin');
        expect(result.data.abandonoPorcentaje).toBe(5.38);
        expect(result.data.eficienciaTerminal).toBe(89.2);
        expect(result.data.gruposPorGrado['1er Semestre']).toBe(2);
      }
    });

    it('Estadistica911ExtractSchema valida un reporte de inicio de ciclo actual', () => {
      const payloadInicio = {
        cicloEscolar: '2026-2027',
        schoolName: 'Centro de Estudios de Bachillerato Héroes de la Patria',
        schoolCct: '21EBH0200X',
        matricula: 290,
        tipoReporte: 'inicio',
        momento: 'inicio_actual',
        totalDocentes: 16,
        totalGrupos: 6,
        observaciones: 'Matrícula de nuevo ingreso registrada en 911.7G inicio',
      };

      const result = Estadistica911ExtractSchema.safeParse(payloadInicio);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.momento).toBe('inicio_actual');
        expect(result.data.tipoReporte).toBe('inicio');
        expect(result.data.matricula).toBe(290);
      }
    });

    it('Estadistica911ExtractSchema soporta momento inicio_anterior', () => {
      const payloadInicioAnt = {
        cicloEscolar: '2025-2026',
        matricula: 275,
        momento: 'inicio_anterior',
        tipoReporte: 'inicio',
      };

      const result = Estadistica911ExtractSchema.safeParse(payloadInicioAnt);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.momento).toBe('inicio_anterior');
        expect(result.data.matricula).toBe(275);
      }
    });

    it('buildEstadistica911ExtractionPrompt contiene reglas y estructura oficial', () => {
      const prompt = buildEstadistica911ExtractionPrompt('Texto breve de ejemplo');
      expect(prompt).toContain('Estadística Escolar (Formato 911)');
      expect(prompt).toContain('abandonoPorcentaje');
      expect(prompt).toContain('eficienciaTerminal');
      expect(prompt).toContain('tipoReporte');
      expect(ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT).toContain('Formato 911');
    });
  });
});
