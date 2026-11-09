'use client';

import React, { useState } from 'react';
import type { Planning } from '@/types/planning';
import type { AuditReport } from '@/lib/audit-engine';
import PlanningTabAuditoria from './PlanningTabAuditoria';
import PlanningTabEvaluador, { type PlanningEvaluationResult } from './PlanningTabEvaluador';
import PlanningTabAnalitica from './PlanningTabAnalitica';
import type { TeacherProgressSummary } from '@/lib/pedagogical-analytics';
import { BarChart3, Award, TrendingUp } from 'lucide-react';

export type QualitySubTab = 'audit' | 'evaluador' | 'analytics';

export interface PlanningTabCalidadProps {
  planning: Planning;
  activeSubTab?: QualitySubTab;
  onSubTabChange?: (tab: QualitySubTab) => void;
  // Auditoría props
  auditReport: AuditReport | null;
  auditLoading: boolean;
  auditError: string | null;
  auditLoaded: boolean;
  expandedDimension: string | null;
  setExpandedDimension: React.Dispatch<React.SetStateAction<string | null>>;
  handleRunAudit: () => Promise<void> | void;
  handleReAudit: () => Promise<void> | void;
  // Evaluador props
  evalResult: PlanningEvaluationResult | null;
  evalLoading: boolean;
  evalError: string | null;
  handleRunEvaluacion: (forceReeval?: boolean) => Promise<void> | void;
  // Analytics props
  analyticsData: TeacherProgressSummary | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
  analyticsLoaded: boolean;
  handleLoadAnalytics: () => Promise<void> | void;
}

export default function PlanningTabCalidad({
  planning,
  activeSubTab = 'audit',
  onSubTabChange,
  auditReport,
  auditLoading,
  auditError,
  auditLoaded,
  expandedDimension,
  setExpandedDimension,
  handleRunAudit,
  handleReAudit,
  evalResult,
  evalLoading,
  evalError,
  handleRunEvaluacion,
  analyticsData,
  analyticsLoading,
  analyticsError,
  analyticsLoaded,
  handleLoadAnalytics,
}: PlanningTabCalidadProps) {
  const [internalSubTab, setInternalSubTab] = useState<QualitySubTab>('audit');
  const currentSubTab = onSubTabChange ? (activeSubTab || 'audit') : internalSubTab;

  const handleSubTabSwitch = (next: QualitySubTab) => {
    if (onSubTabChange) {
      onSubTabChange(next);
    } else {
      setInternalSubTab(next);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} data-testid="planning-tab-calidad">
      {/* Subtabs bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div className="detail-subtabs">
          <button
            type="button"
            onClick={() => handleSubTabSwitch('audit')}
            className={`detail-subtab${currentSubTab === 'audit' ? ' is-active' : ''}`}
          >
            <BarChart3 size={14} style={{ color: '#10b981' }} />
            <span>Auditoría MCCEMS</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabSwitch('evaluador')}
            className={`detail-subtab${currentSubTab === 'evaluador' ? ' is-active' : ''}`}
          >
            <Award size={14} style={{ color: '#ef4444' }} />
            <span>Evaluador IA</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabSwitch('analytics')}
            className={`detail-subtab${currentSubTab === 'analytics' ? ' is-active' : ''}`}
          >
            <TrendingUp size={14} style={{ color: '#06b6d4' }} />
            <span>Analytics y Métricas</span>
          </button>
        </div>
      </div>

      {/* Subtab content */}
      {currentSubTab === 'audit' && (
        <PlanningTabAuditoria
          planning={planning}
          auditReport={auditReport}
          auditLoading={auditLoading}
          auditError={auditError}
          auditLoaded={auditLoaded}
          expandedDimension={expandedDimension}
          setExpandedDimension={setExpandedDimension}
          handleRunAudit={handleRunAudit}
          handleReAudit={handleReAudit}
        />
      )}

      {currentSubTab === 'evaluador' && (
        <PlanningTabEvaluador
          planning={planning}
          evalResult={evalResult}
          evalLoading={evalLoading}
          evalError={evalError}
          handleRunEvaluacion={handleRunEvaluacion}
        />
      )}

      {currentSubTab === 'analytics' && (
        <PlanningTabAnalitica
          planning={planning}
          analyticsData={analyticsData}
          analyticsLoading={analyticsLoading}
          analyticsError={analyticsError}
          analyticsLoaded={analyticsLoaded}
          handleLoadAnalytics={handleLoadAnalytics}
        />
      )}
    </div>
  );
}

