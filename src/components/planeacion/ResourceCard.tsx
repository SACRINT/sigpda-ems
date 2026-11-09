'use client';

import React from 'react';
import { Download, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export type ResourceFormat = 'PDF' | 'Word' | 'PPTX' | 'JSON' | 'ZIP';

export interface ResourceFormatAction {
  format: ResourceFormat;
  label?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  download?: boolean;
  targetBlank?: boolean;
}

export interface ResourceCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  metaBadge?: string;
  statusBadge?: {
    status: 'ok' | 'warn' | 'blocked' | 'pending';
    label: string;
    tooltip?: string;
  };
  actions: ResourceFormatAction[];
  onOpenDetail?: () => void;
  detailLabel?: string;
  testId?: string;
}

function getFormatChipClass(format: ResourceFormat): string {
  switch (format) {
    case 'PDF':
      return 'format-chip format-chip--pdf';
    case 'Word':
      return 'format-chip format-chip--word';
    case 'PPTX':
      return 'format-chip format-chip--pptx';
    case 'JSON':
      return 'format-chip format-chip--json';
    case 'ZIP':
      return 'format-chip format-chip--zip';
    default:
      return 'format-chip format-chip--word';
  }
}

function renderStatusBadge(statusBadge: NonNullable<ResourceCardProps['statusBadge']>) {
  const styles: Record<
    NonNullable<ResourceCardProps['statusBadge']>['status'],
    { bg: string; border: string; color: string; icon: React.ReactNode }
  > = {
    ok: {
      bg: 'rgba(16, 185, 129, 0.14)',
      border: 'rgba(16, 185, 129, 0.35)',
      color: '#34d399',
      icon: <CheckCircle2 size={11} />,
    },
    warn: {
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.38)',
      color: '#fbbf24',
      icon: <AlertTriangle size={11} />,
    },
    blocked: {
      bg: 'rgba(244, 63, 94, 0.16)',
      border: 'rgba(244, 63, 94, 0.42)',
      color: '#fb7185',
      icon: <AlertTriangle size={11} />,
    },
    pending: {
      bg: 'rgba(148, 163, 184, 0.12)',
      border: 'rgba(148, 163, 184, 0.28)',
      color: '#94a3b8',
      icon: <Clock size={11} />,
    },
  };

  const s = styles[statusBadge.status];
  return (
    <span
      title={statusBadge.tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 700,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        whiteSpace: 'nowrap',
      }}
    >
      {s.icon}
      {statusBadge.label}
    </span>
  );
}

export default function ResourceCard({
  icon,
  title,
  subtitle,
  metaBadge,
  statusBadge,
  actions,
  onOpenDetail,
  detailLabel = 'Ver desglose',
  testId,
}: ResourceCardProps) {
  return (
    <div className="resource-card" data-testid={testId}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'var(--c-bg-elevated)',
                border: '1px solid var(--c-border-2)',
                color: 'var(--c-accent-bright)',
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
            <h4
              style={{
                margin: 0,
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--c-text)',
                lineHeight: 1.3,
              }}
            >
              {title}
            </h4>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
            {metaBadge && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: 'rgba(99, 102, 241, 0.14)',
                  color: 'var(--c-accent-bright)',
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                  whiteSpace: 'nowrap',
                }}
              >
                {metaBadge}
              </span>
            )}
            {statusBadge && renderStatusBadge(statusBadge)}
          </div>
        </div>

        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: 'var(--c-text-muted)',
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {actions.map((act, idx) => {
            const chipClass = getFormatChipClass(act.format);
            const isDisabled = Boolean(act.disabled || act.loading);
            const labelText = act.label || act.format;

            if (act.href && !act.onClick) {
              return (
                <a
                  key={`${act.format}-${idx}`}
                  href={isDisabled ? undefined : act.href}
                  download={!isDisabled ? act.download : undefined}
                  target={act.targetBlank && !isDisabled ? '_blank' : undefined}
                  rel={act.targetBlank && !isDisabled ? 'noopener noreferrer' : undefined}
                  tabIndex={isDisabled ? -1 : undefined}
                  aria-disabled={isDisabled}
                  title={act.disabledReason || `Descargar en formato ${act.format}`}
                  onClick={(e) => {
                    if (isDisabled) e.preventDefault();
                  }}
                  className={chipClass}
                >
                  {act.loading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                  {labelText}
                </a>
              );
            }

            return (
              <button
                key={`${act.format}-${idx}`}
                type="button"
                disabled={isDisabled}
                title={act.disabledReason || `Descargar en formato ${act.format}`}
                onClick={act.onClick}
                className={chipClass}
              >
                {act.loading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                {labelText}
              </button>
            );
          })}
        </div>

        {onOpenDetail && (
          <button
            type="button"
            onClick={onOpenDetail}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color: 'var(--c-accent-bright)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: '6px',
            }}
          >
            {detailLabel} <ExternalLink size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

