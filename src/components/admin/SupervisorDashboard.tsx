'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  FileCheck2,
  RefreshCw,
  Award,
  AlertOctagon,
} from 'lucide-react';
import type { ZoneMetric, SchoolMetric, TrendData } from '@/types/analytics';
import ZoneQualityHeatmap from './ZoneQualityHeatmap';
import SchoolDrillDownModal from './SchoolDrillDownModal';
import AlertPanel from './AlertPanel';
import TrendCharts from './TrendCharts';

interface SupervisorDashboardProps {
  initialZoneId?: string;
  userRole?: string;
  userName?: string;
}

export default function SupervisorDashboard({
  initialZoneId = 'zona-01',
  userRole = 'supervisor',
  userName = 'Supervisor Escolar',
}: SupervisorDashboardProps) {
  const [zoneId, setZoneId] = useState<string>(initialZoneId);
  const [zoneData, setZoneData] = useState<ZoneMetric | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/analytics/v1/zone/${encodeURIComponent(zoneId)}?days=30`)
      .then(async (res) => {
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `Error ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!ignore) {
          setZoneData(json.zone || null);
          setTrends(json.trends || []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Error cargando datos de supervisión';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [zoneId]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/v1/zone/${encodeURIComponent(zoneId)}?days=30`);
      if (res.ok) {
        const json = await res.json();
        setZoneData(json.zone || null);
        setTrends(json.trends || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSchool = (school: SchoolMetric) => {
    setSelectedSchoolId(school.schoolId || school.cct);
  };

  const handleCloseModal = () => {
    setSelectedSchoolId(null);
  };

  const avgScore = zoneData?.avgQualityScore ?? 0;
  const isHealthy = avgScore >= 75;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Supervisión Inteligente Fase 5
            </span>
            <span className="text-xs text-slate-400 font-mono">DBEPA Puebla MCCEMS · {userRole.toUpperCase()}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Centro de Mando y Analítica Pedagógica Zonal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Bienvenido, <span className="font-semibold text-slate-700 dark:text-slate-300">{userName}</span> ·
            Monitoreo en tiempo real de planeaciones, PAEC, PMC y alertas pedagógicas.
          </p>
        </div>

        {/* Controles de Zona y Recarga */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <label htmlFor="zoneSelect" className="text-xs text-slate-500 font-medium">Zona:</label>
            <select
              id="zoneSelect"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="zona-01">Zona 01 — Puebla Oriente</option>
              <option value="zona-02">Zona 02 — Tehuacán</option>
              <option value="zona-03">Zona 03 — Huauchinango</option>
              <option value="zona-04">Zona 04 — Teziutlán</option>
              <option value="zona-05">Zona 05 — Atlixco</option>
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Refrescar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-sm flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-rose-500 shrink-0" />
          <div>
            <p className="font-bold">Aviso de Supervisión:</p>
            <p className="text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* KPI Cards Superiores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Calidad Zonal */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Calidad Zonal Promedio</span>
            <div className={`p-2 rounded-lg ${isHealthy ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'}`}>
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? '--' : avgScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">/ 100 pts</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Normativa DBEPA Puebla MCCEMS</p>
        </div>

        {/* KPI 2: Planeaciones Supervisadas */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Planeaciones Registradas</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? '--' : zoneData?.totalPlannings ?? 0}
            </span>
            <span className="text-xs text-slate-400">secuencias</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Auditadas con calidad determinista</p>
        </div>

        {/* KPI 3: Planteles Activos */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Planteles de la Zona</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? '--' : zoneData?.schools?.length ?? 0}
            </span>
            <span className="text-xs text-slate-400">CCTs activos</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Con cobertura de supervisión</p>
        </div>

        {/* KPI 4: Docentes en Plataforma */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Docentes Supervisados</span>
            <div className="p-2 rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? '--' : zoneData?.totalTeachers ?? 0}
            </span>
            <span className="text-xs text-slate-400">docentes</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Generando planeaciones y PAEC</p>
        </div>
      </div>

      {/* Grid Central: Heatmap & Charts a la izquierda (8 cols), Alertas a la derecha (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Principal: Mapa de Calor + Tendencias */}
        <div className="lg:col-span-8 space-y-6">
          <ZoneQualityHeatmap
            schools={zoneData?.schools || []}
            onSelectSchool={handleSelectSchool}
            loading={loading}
          />

          <TrendCharts trends={trends} loading={loading} />
        </div>

        {/* Columna Lateral: Panel de Alertas en Tiempo Real */}
        <div className="lg:col-span-4">
          <AlertPanel zoneId={zoneId} onAlertResolved={handleRefresh} />
        </div>
      </div>

      {/* Modal Drill-Down de Plantel */}
      <SchoolDrillDownModal schoolId={selectedSchoolId} onClose={handleCloseModal} />
    </div>
  );
}
