import { describe, it, expect } from 'vitest';
import {
  runScopePreScan,
  META_MARKER_REGEX,
} from '@/lib/pmc/pre-scanner';
import type { GridCell } from '@/lib/document-ingestion/parsers/docx-parser';
import {
  toTokenBag,
  multisetDiff,
  cleanNum,
  auditAndReconcileEnterprise,
} from '@/lib/pmc/invariant-engine';
import {
  partitionRowsByMetaDensity,
  consolidateBatchResults,
} from '@/lib/pmc/batch-dispatcher';
import type { PmcPreviousExtractDTO } from '@/lib/prompts/pmc-extraction';

function makeMockGridCell(params: {
  originRow: number;
  originCol?: number;
  headerName: string;
  items: { index: number | null; text: string }[];
}): GridCell {
  return {
    tableIndex: 1,
    originRow: params.originRow,
    originCol: params.originCol ?? 1,
    rowSpan: 1,
    colSpan: 1,
    headerName: params.headerName,
    rawText: params.items.map((i) => i.text).join('\n'),
    items: params.items,
  };
}

describe('PMC-EXTRACT v6.4 Enterprise Engine', () => {
  describe('1. Pre-Scanner & Scoped Marker Detection', () => {
    it('discards date or month numbers from being treated as meta indices', () => {
      expect(META_MARKER_REGEX.test('12. enero de 2026')).toBe(false);
      expect(META_MARKER_REGEX.test('15 - febrero')).toBe(false);
      expect(META_MARKER_REGEX.test('1. Acreditar satisfactoriamente')).toBe(true);
      expect(META_MARKER_REGEX.test('Meta 42: Fomentar ambientes de paz')).toBe(true);
    });

    it('identifies index numbers accurately with regex', () => {
      const line1 = '1. Acreditar satisfactoriamente dichos cursos';
      const m1 = META_MARKER_REGEX.exec(line1);
      expect(m1).not.toBeNull();
      expect(m1?.[1]).toBe('1');

      const line2 = 'Meta 42: Fomentar ambientes de paz';
      const m2 = META_MARKER_REGEX.exec(line2);
      expect(m2).not.toBeNull();
      expect(m2?.[1]).toBe('42');
    });

    it('classifies GLOBAL_VERIFIABLE when global sequence is detected with high density even with gaps', () => {
      // 1..20 with 4 missing: length 19, span 20 => density 0.95 >= 0.75
      const cells: GridCell[] = Array.from({ length: 20 }, (_, i) => i + 1)
        .filter((n) => n !== 4)
        .map((n) =>
          makeMockGridCell({
            originRow: n,
            headerName: 'meta institucional',
            items: [{ index: n, text: `Meta ${n}: Aprovechamiento` }],
          })
        );

      const scan = runScopePreScan(cells);
      expect(scan.ambito_numeracion).toBe('GLOBAL_VERIFIABLE');
      expect(scan.k_esperado).toBe(20);
      expect(scan.secuencia_indices).not.toContain(4);
    });

    it('classifies LOCAL_NUMBERING when numbering restarts across cells', () => {
      const cells: GridCell[] = [
        makeMockGridCell({
          originRow: 1,
          headerName: 'meta',
          items: [{ index: 1, text: 'M1' }, { index: 2, text: 'M2' }],
        }),
        makeMockGridCell({
          originRow: 2,
          headerName: 'meta',
          items: [{ index: 1, text: 'M3' }, { index: 2, text: 'M4' }],
        }),
        makeMockGridCell({
          originRow: 3,
          headerName: 'meta',
          items: [{ index: 1, text: 'M5' }, { index: 2, text: 'M6' }],
        }),
      ];

      const scan = runScopePreScan(cells);
      expect(scan.ambito_numeracion).toBe('LOCAL_NUMBERING');
      expect(scan.k_esperado).toBe(2);
    });
  });

  describe('2. Invariant Engine & Multiset Token Bags', () => {
    it('builds multiset frequency bags correctly preserving percentage vs count distinction', () => {
      const bag = toTokenBag('Lograr 85% en 2026-2027 y reducir a 5% con 5 alumnos');
      expect(bag.get('85%')).toBe(1);
      expect(bag.get('5%')).toBe(1);
      expect(bag.get('5')).toBe(1);
      expect(bag.get('2026-2027')).toBe(1);
    });

    it('computes multiset difference accurately for excess and missing tokens', () => {
      const rawBag = toTokenBag('Acreditar 85% 85% 90%');
      const normBag = toTokenBag('Acreditar 85% 90% 95%');

      const missing = multisetDiff(rawBag, normBag);
      const excess = multisetDiff(normBag, rawBag);

      // missing: one 85% is in raw but not in norm
      expect(missing).toEqual(['85%']);
      // excess: 95% is in norm but not in raw
      expect(excess).toEqual(['95%']);
    });

    it('cleanNum standardizes numeric strings', () => {
      expect(cleanNum('2026 - 2027')).toBe('2026-2027');
      expect(cleanNum('8,5')).toBe('8.5');
      expect(cleanNum('100.')).toBe('100');
    });

    it('audits and reconciles sequences and numeric tokens, quarantining anomalies', () => {
      const preScan = {
        formato: 'CANONICO_MATRIZ' as const,
        ambito_numeracion: 'GLOBAL_VERIFIABLE' as const,
        k_esperado: 3,
        secuencia_indices: [1, 2, 3],
        metaCells: [],
      };

      const extracted: any = {
        cicloEscolar: '2026-2027',
        elementos_plan: [
          {
            tipo: 'meta',
            numero_origen: 1,
            texto_original: '1. Acreditar 100% en 2026-2027',
            texto_normalizado: 'Acreditar 100% en 2026-2027',
          },
          // Missing sequence 2!
          {
            tipo: 'meta',
            numero_origen: 3,
            texto_original: '3. Atender a 50 estudiantes',
            texto_normalizado: 'Atender a 999 estudiantes', // 999 is invented, 50 is lost
          },
          // Unexpected sequence 4!
          {
            tipo: 'meta',
            numero_origen: 4,
            texto_original: '4. Otra actividad sin número oficial',
            texto_normalizado: 'Otra actividad',
          },
        ],
      };

      const result = auditAndReconcileEnterprise(extracted, preScan);

      expect(result.status).toBe('QUARANTINE_REQUIRED');
      expect(result.missing).toContain(2);
      expect(result.unexpected).toContain(4);
      expect(result.quarantinedMetas.length).toBeGreaterThanOrEqual(1);

      const quarantinedMeta3 = result.quarantinedMetas.find((m) => m.numero_origen === 3);
      expect(quarantinedMeta3).toBeDefined();
      expect(quarantinedMeta3?.motivos_revision?.some((r: string) => r.includes('NUMERO_INVENTADO_999'))).toBe(true);
      expect(quarantinedMeta3?.motivos_revision?.some((r: string) => r.includes('NUMERO_OMITIDO_50'))).toBe(true);
    });
  });

  describe('3. Batch Dispatcher & Density Partitioning', () => {
    it('partitions rows ensuring no chunk exceeds maxMetasPerBatch', () => {
      const rows = [
        { itemsCount: 6, label: 'R1' },
        { itemsCount: 6, label: 'R2' },
        { itemsCount: 4, label: 'R3' }, // 6+6=12 <= 15; +4 = 16 > 15 -> splits
      ];

      const batches = partitionRowsByMetaDensity(rows, 15);
      expect(batches.length).toBe(2);
      expect(batches[0].length).toBe(2);
      expect(batches[1].length).toBe(1);
    });

    it('consolidates batch results and deduplicates staff records across chunks', () => {
      const base: Partial<PmcPreviousExtractDTO> = {
        schoolName: 'Bachillerato Héroes de la Patria',
        schoolCct: '21EBH0200X',
        cicloEscolar: '2026-2027',
      };

      const chunk1: Partial<PmcPreviousExtractDTO> = {
        schoolName: '',
        staffData: [
          {
            nombre: 'Mtra. Claudia González',
            cargo: 'Docente',
            meta_individual: 'Acreditar cursos',
            metas_individuales: [
              {
                categoria: 'Desarrollo académico y aprendizaje',
                tema: 'Formación docente',
                meta: 'Acreditar cursos',
                estrategia: 'Inscripción a diplomados',
                entregable: 'Constancia',
                periodo: '2026-2027',
              },
            ],
          },
          {
            nombre: 'Mtro. Adrián Hernández',
            cargo: 'Director',
            meta_individual: 'Gestión',
            metas_individuales: [],
          },
        ],
        elementos_plan: [
          {
            tipo: 'meta',
            categoria: 'Desarrollo académico y aprendizaje',
            tema: 'Formación docente',
            responsable: 'Mtra. Claudia González',
            periodo: '2026-2027',
            requiere_revision: false,
            texto_original: '1. Acreditar cursos',
            texto_normalizado: 'Acreditar cursos',
          },
        ],
      };

      const chunk2: Partial<PmcPreviousExtractDTO> = {
        schoolName: '',
        schoolZone: '086',
        staffData: [
          // Same teacher with another meta
          {
            nombre: 'Mtra. Claudia González',
            cargo: 'Docente',
            meta_individual: 'Comisiones',
            metas_individuales: [
              {
                categoria: 'Gestión y administración escolar',
                tema: 'Comisiones escolares',
                meta: 'Cumplir comisiones',
                estrategia: 'Participación activa',
                entregable: 'Informe',
                periodo: '2026-2027',
              },
            ],
          },
          {
            nombre: 'Lic. Moisés Flores',
            cargo: 'Supervisor',
            meta_individual: 'Supervisión',
            metas_individuales: [],
          },
        ],
        elementos_plan: [
          {
            tipo: 'meta',
            categoria: 'Gestión y administración escolar',
            tema: 'Supervisión',
            responsable: 'Lic. Moisés Flores',
            periodo: '2026-2027',
            requiere_revision: false,
            texto_original: '2. Supervisión escolar',
            texto_normalizado: 'Supervisión escolar',
          },
        ],
      };

      const consolidated = consolidateBatchResults(base, [chunk1, chunk2]);

      expect(consolidated.schoolName).toBe('Bachillerato Héroes de la Patria');
      expect(consolidated.schoolZone).toBe('086');
      expect(consolidated.elementos_plan).toHaveLength(2);

      // Staff deduplication check:
      // "Mtra. Claudia González" should appear exactly ONCE in staffData with both metas combined
      const claudiaMatches = consolidated.staffData?.filter(
        (p) => p.nombre.toLowerCase().includes('claudia')
      );
      expect(claudiaMatches).toHaveLength(1);
      expect(claudiaMatches?.[0].metas_individuales).toHaveLength(2);

      // Consolidated staff total: Claudia, Adrián, Moisés = 3
      expect(consolidated.staffData).toHaveLength(3);
      expect(consolidated.totales_detectados?.metas).toBe(2);
    });
  });
});
