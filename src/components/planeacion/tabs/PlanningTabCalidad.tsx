'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Evita cargar datos pesados mientras el eje Calidad está oculto. */
  isActive?: boolean;
}

export default function PlanningTabCalidad({
  planning,
  activeSubTab = 'audit',
  onSubTabChange,
  isActive = true,
}: PlanningTabCalidadProps) {
  const [internalSubTab, setInternalSubTab] = useState<QualitySubTab>('audit');
  const currentSubTab = onSubTabChange ? (activeSubTab || 'audit') : internalSubTab;

  // ── Audit state ─────────────────────────────────────────────────────────
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const auditRequestedRef = useRef(false);

  // ── Evaluador state ─────────────────────────────────────────────────────
  const [evalResult, setEvalResult] = useState<PlanningEvaluationResult | null>(
    (planning.evaluationJson as PlanningEvaluationResult) || null
  );
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  // ── Analytics state ──────────────────────────────────────────────────────
  const [analyticsData, setAnalyticsData] = useState<TeacherProgressSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const analyticsRequestedRef = useRef(false);

  const handleRunAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const getRes = await fetch(`/api/audit/${planning.id}`);
      if (getRes.ok) {
        const getData = await getRes.json();
        if (getData?.audit) {
          setAuditReport(getData.audit);
          setAuditLoaded(true);
          return;
        }
      }

      const postRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id }),
      });
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || 'Error al ejecutar la auditoría.');
      setAuditReport(postData.report);
      setAuditLoaded(true);
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setAuditLoading(false);
    }
  }, [planning.id]);

  const handleReAudit = useCallback(async () => {
    setAuditReport(null);
    setAuditLoaded(false);
    setAuditError(null);
    setAuditLoading(true);
    try {
      const postRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id }),
      });
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || 'Error al re-auditar.');
      setAuditReport(postData.report);
      setAuditLoaded(true);
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setAuditLoading(false);
    }
  }, [planning.id]);

  const handleRunEvaluacion = useCallback(
    async (forceReeval = false) => {
      setEvalLoading(true);
      setEvalError(null);
      try {
        const res = await fetch('/api/planeaciones/evaluar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planningId: planning.id, forceReeval }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al evaluar la planeación.');
        setEvalResult(data.resultado);
      } catch (err: unknown) {
        setEvalError(err instanceof Error ? err.message : 'Error desconocido.');
      } finally {
        setEvalLoading(false);
      }
    },
    [planning.id]
  );

  const handleLoadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch('/api/pedagogical-analytics');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar analytics.');
      setAnalyticsData(data);
      setAnalyticsLoaded(true);
    } catch (err: unknown) {
      setAnalyticsError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Lazy-load each heavy sub-tab only once, on first visit while the axis is visible.
  useEffect(() => {
    if (!isActive) return;
    if (currentSubTab === 'audit' && !auditRequestedRef.current) {
      auditRequestedRef.current = true;
      void handleRunAudit();
    }
  }, [isActive, currentSubTab, handleRunAudit]);

  useEffect(() => {
    if (!isActive) return;
    if (currentSubTab === 'analytics' && !analyticsRequestedRef.current) {
      analyticsRequestedRef.current = true;
      void handleLoadAnalytics();
    }
  }, [isActive, currentSubTab, handleLoadAnalytics]);

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
            aria-current={currentSubTab === 'audit' ? 'page' : undefined}
            className={`detail-subtab${currentSubTab === 'audit' ? ' is-active' : ''}`}
          >
            <BarChart3 size={14} style={{ color: '#10b981' }} />
            <span>Auditoría MCCEMS</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabSwitch('evaluador')}
            aria-current={currentSubTab === 'evaluador' ? 'page' : undefined}
            className={`detail-subtab${currentSubTab === 'evaluador' ? ' is-active' : ''}`}
          >
            <Award size={14} style={{ color: '#ef4444' }} />
            <span>Evaluador IA</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabSwitch('analytics')}
            aria-current={currentSubTab === 'analytics' ? 'page' : undefined}
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
