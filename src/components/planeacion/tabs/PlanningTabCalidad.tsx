'use client';

import React, { useState, useEffect } from 'react';
import type { Planning } from '@/types/planning';
import PlanningTabAuditoria from './PlanningTabAuditoria';
import PlanningTabEvaluador from './PlanningTabEvaluador';
import PlanningTabAnalitica from './PlanningTabAnalitica';
import { BarChart3, Award, TrendingUp } from 'lucide-react';

export type QualitySubTab = 'audit' | 'evaluador' | 'analytics';

export interface PlanningTabCalidadProps {
  planning: Planning;
  activeSubTab?: QualitySubTab;
  onSubTabChange?: (tab: QualitySubTab) => void;
  // Auditoría props
  auditReport: any;
  auditLoading: boolean;
  auditError: string | null;
  auditLoaded: boolean;
  expandedDimension: string | null;
  setExpandedDimension: React.Dispatch<React.SetStateAction<string | null>>;
  handleRunAudit: () => Promise<void> | void;
  handleReAudit: () => Promise<void> | void;
  // Evaluador props
  evalResult: any;
  evalLoading: boolean;
  evalError: string | null;
  handleRunEvaluacion: (forceReeval?: boolean) => Promise<void> | void;
  // Analytics props
  analyticsData: any;
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
  const [subTab, setSubTab] = useState<QualitySubTab>(activeSubTab);

  useEffect(() => {
    if (activeSubTab) {
      setSubTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleSubTabSwitch = (next: QualitySubTab) => {
    setSubTab(next);
    if (onSubTabChange) {
      onSubTabChange(next);
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
            className={`detail-subtab${subTab === 'audit' ? ' is-active' : ''}`}
          >
            <BarChart3 size={14} style={{ color: '#10b981' }} />
            <span>Auditoría MCCEMS</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabSwitch('evaluador')}
            className={`detail-subtab${subTab === 'evaluador' ? ' is-active' : ''}`}
          >
            <Award size={14} style={{ color: '#ef4444' }} />
            <span>Evaluador IA</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabSwitch('analytics')}
            className={`detail-subtab${subTab === 'analytics' ? ' is-active' : ''}`}
          >
            <TrendingUp size={14} style={{ color: '#06b6d4' }} />
            <span>Analytics y Métricas</span>
          </button>
        </div>
      </div>

      {/* Subtab content */}
      {subTab === 'audit' && (
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

      {subTab === 'evaluador' && (
        <PlanningTabEvaluador
          planning={planning}
          evalResult={evalResult}
          evalLoading={evalLoading}
          evalError={evalError}
          handleRunEvaluacion={handleRunEvaluacion}
        />
      )}

      {subTab === 'analytics' && (
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

