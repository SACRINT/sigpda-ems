'use client';

import React from 'react';
import {
  type MetaPersonalItem,
  type MetaInstitucionalItem,
  type PlanAccionData,
  type StaffMemberData,
  type PmcMetasComplementariasProps,
} from './metas-complementarias/types';
import { usePmcMetasComplementarias } from './metas-complementarias/usePmcMetasComplementarias';
import { SubTabIaQuirurgica } from './metas-complementarias/SubTabIaQuirurgica';
import { SubTabPersonales } from './metas-complementarias/SubTabPersonales';
import { SubTabInstitucionales } from './metas-complementarias/SubTabInstitucionales';

export type {
  MetaPersonalItem,
  MetaInstitucionalItem,
  PlanAccionData,
  StaffMemberData,
  PmcMetasComplementariasProps,
};

export function PmcMetasComplementarias(props: PmcMetasComplementariasProps) {
  const ctrl = usePmcMetasComplementarias(props);
  const { saving, feedback, subTab, setSubTab, planAccion } = ctrl;

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.55)',
        border: '1.5px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Encabezado Principal */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#e0e7ff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎯</span> Adición Quirúrgica de Metas (Sin Afectar a Otros Docentes)
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 0', lineHeight: 1.5 }}>
              Agrega una o varias metas adicionales que hayan faltado o solicitado los docentes (ej. Docente 1).
              La plataforma <strong>las normaliza y las inserta quirúrgicamente</strong> en el Plan de Acción, Tablas 5.1/Adicionales, Fichas Técnicas, Metas Individuales y Monitoreo Trimestral{' '}
              <strong style={{ color: '#a7f3d0' }}>sin alterar nada de lo que ya aprobaron los demás docentes</strong>.
            </p>
          </div>
          {saving && (
            <span style={{ fontSize: '12px', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.2)', padding: '5px 12px', borderRadius: '6px' }}>
              <span>⏳</span> Guardando en base de datos...
            </span>
          )}
        </div>

        {feedback && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${feedback.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
              color: feedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Selector de Pestañas Superiores */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setSubTab('ia_quirurgica')}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            border: subTab === 'ia_quirurgica' ? '1px solid rgba(16,185,129,0.6)' : '1px solid transparent',
            background: subTab === 'ia_quirurgica' ? 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(5,150,105,0.2) 100%)' : 'rgba(255,255,255,0.04)',
            color: subTab === 'ia_quirurgica' ? '#a7f3d0' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: subTab === 'ia_quirurgica' ? '0 4px 12px rgba(16,185,129,0.25)' : 'none',
          }}
        >
          <span>🪄</span> Ingestión Quirúrgica Asistida por IA
          <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.3)', color: '#6ee7b7', padding: '2px 8px', borderRadius: '10px' }}>
            Recomendado
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('personales')}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            border: subTab === 'personales' ? '1px solid rgba(99,102,241,0.6)' : '1px solid transparent',
            background: subTab === 'personales' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
            color: subTab === 'personales' ? '#c7d2fe' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>👨‍🏫</span> Metas Individuales (Captura Manual)
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '10px' }}>
            {planAccion?.metas_personales?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('institucionales')}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            border: subTab === 'institucionales' ? '1px solid rgba(99,102,241,0.6)' : '1px solid transparent',
            background: subTab === 'institucionales' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
            color: subTab === 'institucionales' ? '#c7d2fe' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🏛️</span> Metas Institucionales Formato 5.1 (Captura Manual)
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '10px' }}>
            {planAccion?.metas_institucionales?.length || 0}
          </span>
        </button>
      </div>

      {subTab === 'ia_quirurgica' && <SubTabIaQuirurgica ctrl={ctrl} />}
      {subTab === 'personales' && <SubTabPersonales ctrl={ctrl} />}
      {subTab === 'institucionales' && <SubTabInstitucionales ctrl={ctrl} />}
    </div>
  );
}
