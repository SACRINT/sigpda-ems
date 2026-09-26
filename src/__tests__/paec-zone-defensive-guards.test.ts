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
import { formatZoneMetric } from '@/lib/zone-metric-format';

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

  it('2. Formateador UI defensivo: Renderiza "N/D" ante ausencia/inválidos y formatea métricas válidas', () => {
    expect(formatZoneMetric(undefined)).toBe('N/D');
    expect(formatZoneMetric(null)).toBe('N/D');
    expect(formatZoneMetric(NaN)).toBe('N/D');
    expect(formatZoneMetric('')).toBe('N/D');
    expect(formatZoneMetric('   ')).toBe('N/D');
    expect(formatZoneMetric('abc')).toBe('N/D');
    expect(formatZoneMetric(-1)).toBe('N/D');

    // 0 legítimo se conserva
    expect(formatZoneMetric(0)).toBe('0');
    expect(formatZoneMetric(0, { pct: true })).toBe('0%');

    // Valores válidos positivos se formatean con %
    expect(formatZoneMetric(4.5, { pct: true })).toBe('4.5%');
    expect(formatZoneMetric(89.2, { pct: true })).toBe('89.2%');
    expect(formatZoneMetric(120)).toBe('120');
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

  it('5. Plantel con 0% legítimo: safeMetric preserva 0 y formatZoneMetric formatea como "0%" (H-082)', async () => {
    const mockDbRow = {
      id: 'pips-zero',
      zona_nombre: 'Zona 004',
      zona_clave: '21FMS0004Z',
      supervisor_name: 'Supervisora Escolar',
      planteles_json: [
        {
          cct: '21EBH0005Z',
          nombre: 'Bachillerato Eficiente',
          matricula: 150,
          abandono: 0, // 0% real oficial
          eficienciaTerminal: 100,
          reprobacion: 0, // 0% real oficial
        },
      ],
    };

    const mockSql = vi.fn().mockResolvedValue([mockDbRow]);
    vi.mocked(sql).mockReturnValue(mockSql as never);

    const result = await getZoneContextForSchool('21EBH0005Z');
    expect(result.found).toBe(true);
    expect(result.plantel?.abandono).toBe(0);
    expect(result.plantel?.reprobacion).toBe(0);
    expect(formatZoneMetric(result.plantel?.abandono, { pct: true })).toBe('0%');
    expect(formatZoneMetric(result.plantel?.reprobacion, { pct: true })).toBe('0%');
  });
});
