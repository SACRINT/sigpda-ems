'use client';

import { useMemo } from 'react';
import type { GeneratedPlanningContent, Planning, SecuenciaBloque } from '@/types/planning';
import type { ActiveWorkTextbook, GenerationProgressState } from '@/types/work-textbook';
import {
  reviewBlockMaterials,
  type MaterialReviewReport,
} from '@/lib/guide-engine/material-review';

export interface BlockWorkbookLike {
  loaded?: boolean;
  generating?: boolean;
  workbook: ActiveWorkTextbook | null;
  version?: number;
  progress?: GenerationProgressState | null;
  error?: string | null;
}

export interface AggregatedMaterialStatus {
  status: 'ok' | 'warn' | 'blocked' | 'pending';
  label: string;
  tooltip?: string;
}

/**
 * Memoizes deterministic R1 material reviews across all curricular blocks
 * using a stable workbook version signature to avoid re-running during progress polling.
 */
export function useBlockMaterialReviews(
  planning: Planning,
  blockWorkbooks: Record<number, BlockWorkbookLike> = {},
  sequenceData?: Record<number, SecuenciaBloque>
): Record<number, MaterialReviewReport> {
  const content = planning?.contentJson as GeneratedPlanningContent | null;
  const s1 = content?.sectionI;

  const blockWorkbooksSignature = Object.entries(blockWorkbooks)
    .map(([k, item]) => {
      const wb = item?.workbook;
      if (!wb) return `${k}:null`;
      return `${k}:${wb.version ?? 0}:${wb.generatedAt ?? ''}:${wb.totalWords ?? 0}`;
    })
    .join('|');

  return useMemo(() => {
    const map: Record<number, MaterialReviewReport> = {};
    for (const [key, item] of Object.entries(blockWorkbooks)) {
      const idx = Number(key);
      if (Number.isFinite(idx) && item?.workbook) {
        map[idx] = reviewBlockMaterials({
          workbook: item.workbook,
          blockSequence: sequenceData?.[idx] ?? null,
          uacName: planning?.uacName || s1?.uacName || '',
          component: planning?.component || s1?.component || '',
          curriculumName: planning?.curriculumName || '',
        });
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    blockWorkbooksSignature,
    sequenceData,
    planning?.uacName,
    planning?.component,
    planning?.curriculumName,
    s1?.uacName,
    s1?.component,
  ]);
}

/**
 * Aggregates R1 review status across generated blocks for a specific material category.
 */
export function summarizeMaterialReviewStatus(
  blockReviews: Record<number, MaterialReviewReport>,
  materialKey: keyof MaterialReviewReport['byMaterial'],
  generatedCount: number
): AggregatedMaterialStatus {
  const entries = Object.values(blockReviews);
  if (generatedCount === 0 && entries.length === 0) {
    return {
      status: 'pending',
      label: 'Pendiente de generar',
    };
  }

  let blockedCount = 0;
  let warnCount = 0;
  const issueLines: string[] = [];

  for (const [blockIdxStr, report] of Object.entries(blockReviews)) {
    const blockIdx = Number(blockIdxStr);
    const mat = report.byMaterial[materialKey];
    if (!mat) continue;
    if (!mat.ok) {
      blockedCount += 1;
    }
    const warnings = mat.issues.filter((i) => i.severity === 'warning');
    warnCount += warnings.length;
    for (const issue of mat.issues) {
      issueLines.push(`B${blockIdx + 1} [${issue.code}]: ${issue.message}`);
    }
  }

  if (blockedCount > 0) {
    return {
      status: 'blocked',
      label: `Bloqueado R1 (${blockedCount})`,
      tooltip: issueLines.slice(0, 8).join('\n'),
    };
  }

  if (warnCount > 0) {
    return {
      status: 'warn',
      label: `${warnCount} advertencia${warnCount === 1 ? '' : 's'} R1`,
      tooltip: issueLines.slice(0, 8).join('\n'),
    };
  }

  return {
    status: 'ok',
    label: 'Verificado R1',
  };
}

