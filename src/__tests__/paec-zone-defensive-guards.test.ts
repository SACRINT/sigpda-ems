/**
 * paec-zone-defensive-guards.test.ts
 *
 * Tests unitarios para los guards defensivos de métricas de zona (Item B5).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
}));

import { sql } from '@/lib/db';
import { getZoneContextForSchool } from '@/lib/zone-sync-service';

describe('B5: Defensive Guards N/D para Métricas de Zona F11/911 en PAEC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Plantel con métricas faltantes en planteles_json: No inyecta defaults numéricos (5, 8, 0) y preserva undefined', async () => {
    const mockDbRow = {
      id: 'pips-123',
      zona_nombre: 'Zona 004',
      zona_clave: '21FMS0004Z',
      supervisor_name: 'Supervisora Escolar',
      municipio_sede: 'Venustiano Carranza',
      subsistema: 'Bachilleratos Estatales',
      ciclo_escolar: '2026-2027',
      problematicas_json: [],
      planteles_json: [
        {
          cct: '21EBH0999Z',
          nombre: 'Bachillerato Sin Métricas',
          localidad: 'Comunidad Rural',
          municipio: 'Pantepec',
          matricula: 45,
          // abandono, reprobacion, eficienciaTerminal OMITIDOS
        },
      ],
    };

    const mockSql = vi.fn().mockResolvedValue([mockDbRow]);
    vi.mocked(sql).mockReturnValue(mockSql as never);

    const result = await getZoneContextForSchool('21EBH0999Z');

    expect(result.found).toBe(true);
    expect(result.plantel).toBeDefined();

    // Criterio crítico: No debe haber defaults arbitrarios ni 0%
    expect(result.plantel?.abandono).toBeUndefined();
    expect(result.plantel?.eficienciaTerminal).toBeUndefined();
    expect(result.plantel?.reprobacion).toBeUndefined();
    expect(result.plantel?.matricula).toBe(45);
  });

  it('2. Formateador UI defensivo: Renderiza "N/D" ante valores undefined, null, NaN o 0', () => {
    const formatMetric = (val: unknown): string => {
      return typeof val === 'number' && Number.isFinite(val) && val > 0 ? `${val}%` : 'N/D';
    };

    expect(formatMetric(undefined)).toBe('N/D');
    expect(formatMetric(null)).toBe('N/D');
    expect(formatMetric(NaN)).toBe('N/D');
    expect(formatMetric(0)).toBe('N/D');
    expect(formatMetric('')).toBe('N/D');

    // Valores válidos positivos se formatean con %
    expect(formatMetric(4.5)).toBe('4.5%');
    expect(formatMetric(89.2)).toBe('89.2%');
  });

  it('3. Plantel con métricas válidas: Preserva valores exactos de 911/F11', async () => {
    const mockDbRow = {
      id: 'pips-456',
      zona_nombre: 'Zona 004',
      zona_clave: '21FMS0004Z',
      supervisor_name: 'Supervisora Escolar',
      planteles_json: [
        {
          cct: '21EBH0004Z',
          nombre: 'Bachillerato Moisés Sáenz',
          matricula: 180,
          abandono: 3.2,
          eficienciaTerminal: 91.5,
          reprobacion: 4.8,
        },
      ],
    };

    const mockSql = vi.fn().mockResolvedValue([mockDbRow]);
    vi.mocked(sql).mockReturnValue(mockSql as never);

    const result = await getZoneContextForSchool('21EBH0004Z');

    expect(result.found).toBe(true);
    expect(result.plantel?.abandono).toBe(3.2);
    expect(result.plantel?.eficienciaTerminal).toBe(91.5);
    expect(result.plantel?.reprobacion).toBe(4.8);
  });

  it('4. Zona sin promedios válidos: averages no devuelve 0 ni NaN sino undefined', async () => {
    const mockDbRow = {
      id: 'pips-empty',
      zona_nombre: 'Zona 004',
      planteles_json: [
        {
          cct: '21EBH0000X',
          nombre: 'Plantel Vacío',
          matricula: 0,
        },
      ],
    };

    const mockSql = vi.fn().mockResolvedValue([mockDbRow]);
    vi.mocked(sql).mockReturnValue(mockSql as never);

    const result = await getZoneContextForSchool('21EBH0000X');
    expect(result.found).toBe(true);
    expect(result.zona?.averages.promAbandono).toBeUndefined();
    expect(result.zona?.averages.promEficiencia).toBeUndefined();
    expect(result.zona?.averages.promAprovechamiento).toBeUndefined();
    expect(result.zona?.averages.promReprobacion).toBeUndefined();
  });
});
