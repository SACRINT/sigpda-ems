import { describe, it, expect } from 'vitest';
import { parsePmcStatistics } from '../lib/pmc-statistics-parser';
import { buildPmcDiagnosticoPrompt } from '../lib/prompts/pmc-prompts';
import * as XLSX from 'xlsx';
import type { PmcProject } from '../types/pmc';

describe('pmc-statistics-parser — Zona Mixta y Eficiencia Terminal Ausente (H-054)', () => {
  it('no fabrica prioridad ALTA ni inyecta "undefined%" cuando el plantel objetivo carece de columna ET', () => {
    // Fila 1: encabezados con Matrícula, Abandono, Reprobación pero SIN Eficiencia Terminal para el plantel objetivo
    // Se simula matriz donde Plantel A no tiene ET o viene vacía, pero Plantel B tiene 85%
    const wsData = [
      ['PLANTEL', 'CCT', 'MATRICULA', 'ABANDONO', 'REPROBACION', 'EFICIENCIA TERMINAL'],
      ['BACHILLERATO GENERAL PLANTEL A', '21EBH0001A', 120, 2.5, 4.0, ''], // Sin ET
      ['BACHILLERATO GENERAL PLANTEL B', '21EBH0002B', 150, 2.0, 3.5, 85.0], // Con ET
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'ESTADISTICA');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parsePmcStatistics(buffer, {
      targetCct: '21EBH0001A',
      zonaNumero: '004',
    });

    expect(result.success).toBe(true);
    expect(result.context).toBeDefined();

    const context = result.context!;
    // El plantel objetivo debe tener ET undefined
    expect(context.plantel.eficienciaTerminal).toBeUndefined();
    // La zona debe tener promedioEficiencia derivado del Plantel B (85)
    expect(context.zona?.promedioEficiencia).toBe(85);
    // brechaEficienciaVsZona no debe estar fabricada como -85
    expect(context.zona?.brechasDiagnostico.brechaEficienciaVsZona).toBeUndefined();

    // Las observaciones NO deben contener "undefined%" ni alertar por brecha falsa de ET
    const obsText = context.zona?.brechasDiagnostico.observaciones.join(' ') || '';
    expect(obsText).not.toContain('undefined%');
    expect(obsText).not.toContain('Eficiencia terminal');

    // La prioridad NO debe ser 'alta' si los demás indicadores son saludables
    expect(context.zona?.brechasDiagnostico.prioridadIntervencion).not.toBe('alta');

    // Verificación en el prompt de IA: no debe interpolar undefined%
    const mockProject: PmcProject = {
      id: 'proj-123',
      school_name: 'BACHILLERATO GENERAL PLANTEL A',
      school_cct: '21EBH0001A',
      school_zone: '004',
      status: 'borrador',
      current_step: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const prompt = buildPmcDiagnosticoPrompt(mockProject, context);
    expect(prompt).not.toContain('undefined%');
    expect(prompt).toContain('Promedio de Eficiencia Terminal en la Zona: 85% (Eficiencia del plantel: No reportada)');
  });
});
