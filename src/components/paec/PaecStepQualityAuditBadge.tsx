'use client';

import React, { useState } from 'react';
import type { PaecQualityAudit, PaecAuditResult, PaecAuditCriterion } from '@/types/paec';

export interface PaecStepQualityAuditBadgeProps {
  step: number;
  stepAudit?: PaecQualityAudit | null;
  globalAudit?: PaecQualityAudit | PaecAuditResult | null;
  onReaudit?: () => void;
  isLoading?: boolean;
}

const STEP_CRITERIA_MAP: Record<number, number[]> = {
  1: [1, 2, 3, 4],
  2: [5, 6, 7],
  3: [8, 9, 10],
  4: [11, 12],
  5: [13, 14],
  6: [15, 16],
  7: [17, 18],
  8: [19, 20],
  9: [21, 22, 23],
};

function getScoreBadgeConfig(score: number) {
  if (score >= 85) {
    return {
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.35)',
      badgeBg: 'rgba(16, 185, 129, 0.2)',
      label: 'Excelente',
      sublabel: 'Cumple holgadamente con los estándares MCCEMS/NEM',
      icon: '🛡️',
      statusClass: 'text-emerald-400',
    };
  }
  if (score >= 70) {
    return {
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.35)',
      badgeBg: 'rgba(245, 158, 11, 0.2)',
      label: 'Satisfactorio',
      sublabel: 'Cumple criterios mínimos, con áreas de mejora identificadas',
      icon: '⚠️',
      statusClass: 'text-amber-400',
    };
  }
  return {
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.35)',
    badgeBg: 'rgba(239, 68, 68, 0.2)',
    label: 'Requiere Ajustes',
    sublabel: 'No alcanza los estándares pedagógicos o normativos requeridos',
    icon: '❌',
    statusClass: 'text-rose-400',
  };
}

export function PaecStepQualityAuditBadge({
  step,
  stepAudit,
  globalAudit,
  onReaudit,
  isLoading = false,
}: PaecStepQualityAuditBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'step' | 'global'>('step');
  const [filterGlobal, setFilterGlobal] = useState<'all' | 'deficient'>('all');

  const globalCriteriaList: PaecAuditCriterion[] = globalAudit
    ? (globalAudit.criterios || globalAudit.criteria || [])
    : [];

  // Resolver criterios para este paso: usar stepAudit si existe, o derivar de globalAudit
  let criteriaList: PaecAuditCriterion[] = stepAudit?.criterios || stepAudit?.criteria || [];
  let currentScore = typeof stepAudit?.score === 'number'
    ? stepAudit.score
    : typeof stepAudit?.percentage === 'number'
    ? Math.round(stepAudit.percentage)
    : 0;

  if (criteriaList.length === 0 && globalCriteriaList.length > 0) {
    const targetIds = STEP_CRITERIA_MAP[step] || [];
    criteriaList = globalCriteriaList.filter((c) => targetIds.includes(c.id));
    if (criteriaList.length > 0) {
      const maxPts = criteriaList.length * 4;
      const pts = criteriaList.reduce((sum, c) => sum + (c.score || 0), 0);
      currentScore = maxPts > 0 ? Math.round((pts / maxPts) * 100) : 0;
    }
  }

  if (criteriaList.length === 0 && !globalAudit) {
    return null;
  }

  const cfg = getScoreBadgeConfig(currentScore);

  const globalScore = globalAudit
    ? Math.round(globalAudit.score ?? globalAudit.percentage ?? 0)
    : 0;
  const globalCfg = getScoreBadgeConfig(globalScore);

  const isStep9 = step === 9;

  return (
    <div
      style={{
        background: 'rgba(13, 21, 48, 0.85)',
        border: `1px solid ${cfg.border}`,
        borderRadius: '12px',
        padding: '14px 18px',
        marginBottom: '20px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>{cfg.icon}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {`Auditoría Calidad Paso ${step}`}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: cfg.badgeBg,
                  color: cfg.color,
                  border: `1px solid ${cfg.border}`,
                }}
              >
                {cfg.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: cfg.color, lineHeight: 1.2 }}>
                {currentScore}
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                / 100 pts
              </span>
            </div>
          </div>
        </div>

        {/* Global tab button for Step 9 if available */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isStep9 && globalAudit && (
            <div
              style={{
                display: 'flex',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '8px',
                padding: '2px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <button
                type="button"
                onClick={() => { setActiveTab('step'); setIsOpen(true); }}
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'step' ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: activeTab === 'step' ? '#fff' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                }}
              >
                {`Paso 9 (${currentScore} pts)`}
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('global'); setIsOpen(true); }}
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'global' ? globalCfg.badgeBg : 'transparent',
                  color: activeTab === 'global' ? globalCfg.color : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                }}
              >
                {`🌐 Global 23 Criterios (${globalScore} pts)`}
              </button>
            </div>
          )}

          {onReaudit && (
            <button
              type="button"
              onClick={onReaudit}
              disabled={isLoading}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.8)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
              title="Volver a evaluar este paso"
            >
              {isLoading ? '⏳...' : '🔄 Re-evaluar'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: cfg.color,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              padding: '5px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{isOpen ? 'Ocultar Criterios' : 'Ver Desglose'}</span>
            <span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '6px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '3px',
          marginTop: '12px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(5, activeTab === 'step' ? currentScore : globalScore))}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${activeTab === 'step' ? cfg.color : globalCfg.color}, ${
              (activeTab === 'step' ? currentScore : globalScore) >= 85 ? '#34d399' : (activeTab === 'step' ? currentScore : globalScore) >= 70 ? '#fbbf24' : '#f87171'
            })`,
            borderRadius: '3px',
            transition: 'width 0.4s ease-in-out',
          }}
        />
      </div>

      {/* Accordion Content */}
      {isOpen && (
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {activeTab === 'step' ? (
            <div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Criterios normativos evaluados para el Paso {step}:</span>
                <span style={{ fontWeight: 600 }}>{criteriaList.length} criterio(s)</span>
              </div>

              {criteriaList.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', padding: '10px' }}>
                  No se registran criterios individuales para este paso.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {criteriaList.map((crit) => {
                    const isPass = crit.status === 'pass';
                    const isWarn = crit.status === 'warning';
                    const critColor = isPass ? '#10b981' : isWarn ? '#f59e0b' : '#ef4444';
                    const critBg = isPass ? 'rgba(16, 185, 129, 0.08)' : isWarn ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)';
                    const critBorder = isPass ? 'rgba(16, 185, 129, 0.25)' : isWarn ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)';

                    return (
                      <div
                        key={crit.id}
                        style={{
                          background: critBg,
                          border: `1px solid ${critBorder}`,
                          borderRadius: '8px',
                          padding: '10px 14px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#f0f4ff' }}>
                            Criterio {crit.id}: {crit.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                              Nivel esperado: {crit.expectedLevel}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: critColor,
                                background: 'rgba(0,0,0,0.3)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                              }}
                            >
                              {crit.score}/4 pts
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', marginBottom: '3px' }}>
                          {crit.feedback}
                        </div>

                        {crit.evidenceFound && (
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                            Evidencia: {crit.evidenceFound}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Global Audit Panel (Step 9 / Overall 23 criteria) */
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f0f4ff' }}>
                    Matriz Oficial de Calidad PAEC-PEC (23 Criterios NEM/MCCEMS)
                  </span>
                  <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', margin: '2px 0 0 0' }}>
                    Evaluación integral de coherencia comunitaria, curricular y territorial
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setFilterGlobal('all')}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: filterGlobal === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Todos ({globalCriteriaList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterGlobal('deficient')}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: filterGlobal === 'deficient' ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.05)',
                      color: filterGlobal === 'deficient' ? '#f59e0b' : 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                    }}
                  >
                    Solo Observaciones ({globalCriteriaList.filter(c => c.status !== 'pass').length})
                  </button>
                </div>
              </div>

              {/* Criteria list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                {globalCriteriaList
                  .filter((c) => filterGlobal === 'all' || c.status !== 'pass')
                  .map((crit) => {
                    const isPass = crit.status === 'pass';
                    const isWarn = crit.status === 'warning';
                    const critColor = isPass ? '#10b981' : isWarn ? '#f59e0b' : '#ef4444';
                    const critBg = isPass ? 'rgba(16, 185, 129, 0.08)' : isWarn ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)';
                    const critBorder = isPass ? 'rgba(16, 185, 129, 0.25)' : isWarn ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)';

                    return (
                      <div
                        key={crit.id}
                        style={{
                          background: critBg,
                          border: `1px solid ${critBorder}`,
                          borderRadius: '8px',
                          padding: '10px 14px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#f0f4ff' }}>
                            Criterio {crit.id}: {crit.name}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: critColor,
                              background: 'rgba(0,0,0,0.3)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {crit.score}/4 pts
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '3px' }}>
                          {crit.feedback}
                        </div>
                        {crit.evidenceFound && (
                          <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
                            Evidencia: {crit.evidenceFound}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
