import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 1. Mock de Base de Datos Neon y Logger ─────────────────────────────────────
let mockPipsRows: Record<string, unknown>[] = [];
let mockSupervisorEscuelasRows: Record<string, unknown>[] = [];
let mockPmcRows: Record<string, unknown>[] = [];
let mockPaecRows: Record<string, unknown>[] = [];
let mockSqlShouldThrow = false;

const mockSql = vi.fn((strings: TemplateStringsArray) => {
  if (mockSqlShouldThrow) {
    return Promise.reject(new Error('Neon Database Connection Timeout'));
  }
  const queryStr = strings.join('?').toLowerCase();
  
  if (queryStr.includes('from pips_projects')) {
    return Promise.resolve(mockPipsRows);
  }
  if (queryStr.includes('from supervisor_escuelas')) {
    return Promise.resolve(mockSupervisorEscuelasRows);
  }
  if (queryStr.includes('from pmc_projects')) {
    return Promise.resolve(mockPmcRows);
  }
  if (queryStr.includes('from paec_projects')) {
    return Promise.resolve(mockPaecRows);
  }

  return Promise.resolve([]);
});

vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { loadPmcSummary } from '@/lib/pmc-zone-bridge';
import { getZoneContextForSchool, getZoneSupervisorDashboard } from '@/lib/zone-sync-service';
import { logger } from '@/lib/logger';

describe('Zone Synchronization & Bridges (Fase 9 / Fase 18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipsRows = [];
    mockSupervisorEscuelasRows = [];
    mockPmcRows = [];
    mockPaecRows = [];
    mockSqlShouldThrow = false;
  });

  describe('PMC Zone Bridge (loadPmcSummary)', () => {
    it('returns { found: false } when CCT is empty', async () => {
      const res = await loadPmcSummary('');
      expect(res.found).toBe(false);
    });

    it('returns { found: false } when CCT consists only of whitespace', async () => {
      const res = await loadPmcSummary('   ');
      expect(res.found).toBe(false);
    });

    it('returns { found: false } when no PMC exists for CCT', async () => {
      mockPmcRows = [];
      const res = await loadPmcSummary('21EBH9999Z');
      expect(res.found).toBe(false);
    });

    it('correctly maps existing PMC project data by CCT', async () => {
      mockPmcRows = [
        {
          id: 'pmc-123',
          school_name: 'Bachillerato Emiliano Zapata',
          school_cct: '21EBH0001A',
          school_zone: 'Zona 004',
          status: 'completed',
          current_step: 4,
          ciclo_escolar: '2026-2027',
          director_name: 'Mtro. Pedro Infante',
          indicadores_academicos: {
            matricula: 180,
            abandono_ant: 6.2,
            et_ant: 84.5,
            reprobacion_ant: 5.1,
            aprobacion_ant: 94.9,
          },
          categorias_priorizadas: [{ id: 1 }, { id: 2 }],
          updated_at: new Date('2026-09-18T10:00:00Z'),
        },
      ];

      const res = await loadPmcSummary('21EBH0001A');
      expect(res.found).toBe(true);
      expect(res.projectId).toBe('pmc-123');
      expect(res.schoolName).toBe('Bachillerato Emiliano Zapata');
      expect(res.schoolZone).toBe('Zona 004');
      expect(res.status).toBe('completed');
      expect(res.currentStep).toBe(4);
      expect(res.cicloEscolar).toBe('2026-2027');
      expect(res.directorName).toBe('Mtro. Pedro Infante');
      expect(res.indicadoresAcademicos?.matricula).toBe(180);
      expect(res.indicadoresAcademicos?.abandono_ant).toBe(6.2);
      expect(res.indicadoresAcademicos?.et_ant).toBe(84.5);
      expect(res.indicadoresAcademicos?.reprobacion_ant).toBe(5.1);
      expect(res.indicadoresAcademicos?.aprobacion_ant).toBe(94.9);
      expect(res.categoriasPriorizadasCount).toBe(2);
      expect(res.updatedAt).toBe(new Date('2026-09-18T10:00:00Z').toISOString());
    });

    it('normalizes whitespace and lowercase CCT before querying', async () => {
      mockPmcRows = [
        {
          id: 'pmc-normalized',
          school_cct: '21EBH0001A',
          status: 'draft',
          current_step: 1,
        },
      ];

      const res = await loadPmcSummary('  21ebh0001a  ');
      expect(res.found).toBe(true);
      expect(res.projectId).toBe('pmc-normalized');
      expect(res.status).toBe('draft');
      expect(res.currentStep).toBe(1);
    });

    it('handles draft status and null/empty fields gracefully without breaking', async () => {
      mockPmcRows = [
        {
          id: 'pmc-draft-empty',
          school_cct: '21EBH0005E',
          status: 'draft',
          current_step: null,
          indicadores_academicos: null,
          categorias_priorizadas: null,
          updated_at: null,
        },
      ];

      const res = await loadPmcSummary('21EBH0005E');
      expect(res.found).toBe(true);
      expect(res.status).toBe('draft');
      expect(res.currentStep).toBe(1); // Fallback to 1
      expect(res.indicadoresAcademicos?.matricula).toBeUndefined();
      expect(res.categoriasPriorizadasCount).toBe(0);
      expect(res.updatedAt).toBeUndefined();
    });

    it('catches database rejection and returns { found: false } without throwing (Error Handling)', async () => {
      mockSqlShouldThrow = true;

      const res = await loadPmcSummary('21EBH0001A');
      expect(res.found).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[PmcZoneBridge] Error consultando PMC para CCT 21EBH0001A:'),
        expect.any(Error)
      );
    });
  });

  describe('Zone Context Provider (getZoneContextForSchool)', () => {
    it('returns { found: false } when CCT is missing or empty', async () => {
      const resEmpty = await getZoneContextForSchool('');
      expect(resEmpty.found).toBe(false);

      const resWhitespace = await getZoneContextForSchool('    ');
      expect(resWhitespace.found).toBe(false);
    });

    it('returns { found: false } when CCT is not found in any Cartografía', async () => {
      mockPipsRows = [];
      const res = await getZoneContextForSchool('21EBH9999Z');
      expect(res.found).toBe(false);
    });

    it('returns zone context and school stats when CCT exists in Cartografía', async () => {
      mockPipsRows = [
        {
          id: 'pips-zona-004',
          zona_nombre: 'Zona 004',
          zona_clave: '21FMS0004Z',
          supervisor_name: 'Mtra. Carmen Salinas',
          municipio_sede: 'Venustiano Carranza',
          subsistema: 'Bachilleratos Estatales',
          ciclo_escolar: '2026-2027',
          planteles_json: [
            {
              cct: '21EBH0001A',
              nombre: 'Bachillerato Venustiano Carranza',
              matricula: 150,
              abandono: 4.0,
              eficienciaTerminal: 89.0,
              paecProyecto: 'Cuidado del río San Marcos',
              paecProblematica: 'Contaminación por desechos agrícolas',
            },
            {
              cct: '21EBH0002B',
              nombre: 'Bachillerato General Francisco Z. Mena',
              matricula: 110,
              abandono: 12.5,
              eficienciaTerminal: 72.0,
              paecProyecto: 'Taller comunitario de carpintería',
              paecProblematica: 'Migración y falta de oportunidades',
            },
          ],
          momento3_ubicar: {
            descripcionTerritorial: 'Zona serrana de la Huasteca poblana con dispersión geográfica.',
            recursosAliados: [
              {
                nombre: 'Centro Comunitario de Salud La Ceiba',
                tipo: 'salud',
                ubicacion: 'Venustiano Carranza',
                vinculacionPedagogica: 'Brigadas juveniles de salud preventiva',
              },
            ],
          },
          momento5_decidir: {
            metaGeneralZona: 'Incrementar la permanencia escolar en un 4.5% en la Zona 004 durante el ciclo 2026-2027.',
            lineasAccion: [
              {
                numero: 1,
                titulo: 'Acompañamiento a la autonomía docente y curricular situada',
              },
            ],
          },
        },
      ];

      const res = await getZoneContextForSchool('21ebh0001a');

      expect(res.found).toBe(true);
      expect(res.zona?.identificacion.zonaClave).toBe('21FMS0004Z');
      expect(res.zona?.momento5Metas?.metaGeneralZona).toContain('Incrementar la permanencia');
      expect(res.plantel?.nombre).toBe('Bachillerato Venustiano Carranza');
      expect(res.plantel?.paecProyecto).toBe('Cuidado del río San Marcos');
      expect(res.plantel?.matricula).toBe(150);
      expect(res.zona?.averages.promAbandono).toBeDefined();
      expect(res.zona?.averages.promEficiencia).toBeDefined();
    });

    it('catches database rejection and returns { found: false } without throwing (Error Handling)', async () => {
      mockSqlShouldThrow = true;

      const res = await getZoneContextForSchool('21EBH0001A');
      expect(res.found).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[ZoneSyncService] Error obteniendo contexto de zona para CCT 21EBH0001A:'),
        expect.any(Error)
      );
    });
  });

  describe('Supervisor Real-time Dashboard (getZoneSupervisorDashboard)', () => {
    it('aggregates PMC, PAEC, and Cartografia data for all supervisor schools', async () => {
      mockPipsRows = [
        {
          id: 'pips-001',
          zona_nombre: 'Zona 004',
          zona_clave: '21FMS0004Z',
          supervisor_name: 'Dr. Roberto Mendoza',
          planteles_json: [
            { cct: '21EBH0001A', nombre: 'Bachillerato 1', matricula: 100, abandono: 5, eficienciaTerminal: 85 },
            { cct: '21EBH0002B', nombre: 'Bachillerato 2 (Alerta)', matricula: 90, abandono: 14, eficienciaTerminal: 70 },
          ],
          momento5_decidir: { metaGeneralZona: 'Meta de Zona' },
          memoria_pedagogica: { queLogramos: 'Logros alcanzados' },
        },
      ];

      mockSupervisorEscuelasRows = [
        { id: 'esc-1', cct: '21EBH0001A', nombre: 'Bachillerato 1', subsistema: 'BGE', activa: true },
        { id: 'esc-2', cct: '21EBH0002B', nombre: 'Bachillerato 2 (Alerta)', subsistema: 'BGE', activa: true },
      ];

      mockPmcRows = [
        { school_cct: '21EBH0001A', id: 'pmc-1', status: 'completed', current_step: 4, updated_at: new Date() },
        { school_cct: '21EBH0002B', id: 'pmc-2', status: 'draft', current_step: 2, updated_at: new Date() },
      ];

      mockPaecRows = [
        { cct: '21EBH0001A', id: 'paec-1', status: 'completed', current_step: 9, project_name: 'Proyecto Verde', updated_at: new Date() },
      ];

      const dashboard = await getZoneSupervisorDashboard('sup-uuid-123');

      expect(dashboard.zona.clave).toBe('21FMS0004Z');
      expect(dashboard.zona.momento5Completed).toBe(true);
      expect(dashboard.zona.memoriaCompleted).toBe(true);

      // Resumen
      expect(dashboard.resumen.totalPlanteles).toBe(2);
      expect(dashboard.resumen.pmcCompletados).toBe(1);
      expect(dashboard.resumen.pmcEnProceso).toBe(1);
      expect(dashboard.resumen.pmcSinIniciar).toBe(0);
      expect(dashboard.resumen.paecCompletados).toBe(1);
      expect(dashboard.resumen.paecSinIniciar).toBe(1);
      expect(dashboard.resumen.plantelesAtencionPrioritaria).toBe(1);

      // Planteles y alertas
      const p1 = dashboard.planteles.find((p) => p.cct === '21EBH0001A');
      expect(p1?.pmc.status).toBe('completed');
      expect(p1?.paec.status).toBe('completed');

      const p2 = dashboard.planteles.find((p) => p.cct === '21EBH0002B');
      expect(p2?.cartografia.atencionPrioritaria).toBe(true);
      expect(p2?.alertas.length).toBeGreaterThan(0);
      expect(p2?.alertas.some((a) => a.includes('Abandono elevado'))).toBe(true);
      expect(p2?.alertas.some((a) => a.includes('PAEC no iniciado'))).toBe(true);
    });

    it('handles supervisor with no Cartografia gracefully with default fallback metadata', async () => {
      mockPipsRows = []; // No PIPS Cartografia
      mockSupervisorEscuelasRows = [
        { id: 'esc-3', cct: '21EBH0003C', nombre: 'Bachillerato Rural 3', subsistema: 'BGE', activa: true },
      ];
      mockPmcRows = [];
      mockPaecRows = [];

      const dashboard = await getZoneSupervisorDashboard('sup-uuid-no-cartografia');

      expect(dashboard.zona.hasCartografia).toBe(false);
      expect(dashboard.zona.cartografiaProjectId).toBeUndefined();
      expect(dashboard.zona.nombre).toBe('004');
      expect(dashboard.zona.clave).toBe('21FMS0004Z');
      expect(dashboard.zona.supervisorName).toBe('Supervisor(a) Escolar');
      expect(dashboard.zona.momento5Completed).toBe(false);
      expect(dashboard.zona.memoriaCompleted).toBe(false);

      expect(dashboard.resumen.totalPlanteles).toBe(1);
      expect(dashboard.resumen.pmcSinIniciar).toBe(1);
      expect(dashboard.resumen.paecSinIniciar).toBe(1);

      const p = dashboard.planteles[0];
      expect(p.cct).toBe('21EBH0003C');
      expect(p.cartografia.inZona).toBe(false);
      expect(p.cartografia.atencionPrioritaria).toBe(false);
      expect(p.alertas).toContain('Proyecto Comunitario PAEC no iniciado.');
      expect(p.alertas).toContain('Programa de Mejora Continua (PMC) sin registro activo.');
    });

    it('incorporates planteles from Cartografia when not yet registered in supervisor_escuelas', async () => {
      mockPipsRows = [
        {
          id: 'pips-auto-incorporate',
          zona_nombre: 'Zona 012',
          zona_clave: '21FMS0012X',
          supervisor_name: 'Lic. Laura Ortega',
          planteles_json: [
            { cct: '21EBH0099K', nombre: 'Bachillerato Anexo de la Sierra', municipio: 'Zacatlán', matricula: 85 },
          ],
        },
      ];
      mockSupervisorEscuelasRows = []; // No schools in supervisor_escuelas

      const dashboard = await getZoneSupervisorDashboard('sup-uuid-cartografia-only');

      expect(dashboard.resumen.totalPlanteles).toBe(1);
      const incorporated = dashboard.planteles.find((p) => p.cct === '21EBH0099K');
      expect(incorporated).toBeDefined();
      expect(incorporated?.nombre).toBe('Bachillerato Anexo de la Sierra');
      expect(incorporated?.municipio).toBe('Zacatlán');
      expect(incorporated?.cartografia.inZona).toBe(true);
      expect(incorporated?.activa).toBe(true);
    });

    it('handles empty supervisor with no schools and no Cartografia', async () => {
      mockPipsRows = [];
      mockSupervisorEscuelasRows = [];
      mockPmcRows = [];
      mockPaecRows = [];

      const dashboard = await getZoneSupervisorDashboard('sup-uuid-empty');

      expect(dashboard.resumen.totalPlanteles).toBe(0);
      expect(dashboard.planteles).toEqual([]);
      expect(dashboard.zona.hasCartografia).toBe(false);
    });

    it('filters out empty or null CCTs in supervisor_escuelas without crashing', async () => {
      mockPipsRows = [];
      mockSupervisorEscuelasRows = [
        { id: 'esc-blank-1', cct: '', nombre: 'Escuela Sin CCT', subsistema: 'BGE', activa: true },
        { id: 'esc-blank-2', cct: null, nombre: 'Escuela CCT Null', subsistema: 'BGE', activa: true },
        { id: 'esc-valid', cct: '21EBH0088H', nombre: 'Escuela Válida', subsistema: 'BGE', activa: true },
      ];

      const dashboard = await getZoneSupervisorDashboard('sup-uuid-blanks');

      expect(dashboard.resumen.totalPlanteles).toBe(1);
      expect(dashboard.planteles[0].cct).toBe('21EBH0088H');
    });
  });
});
