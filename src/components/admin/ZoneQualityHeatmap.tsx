'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
} from 'lucide-react';
import type { SchoolMetric } from '@/types/analytics';

interface ZoneQualityHeatmapProps {
  schools: SchoolMetric[];
  onSelectSchool: (school: SchoolMetric) => void;
  loading?: boolean;
}

export default function ZoneQualityHeatmap({
  schools,
  onSelectSchool,
  loading = false,
}: ZoneQualityHeatmapProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'acceptable' | 'excellent'>('all');

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const matchesSearch =
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        school.cct.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.municipality && school.municipality.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterStatus === 'critical') return school.avgQualityScore < 60;
      if (filterStatus === 'acceptable') return school.avgQualityScore >= 60 && school.avgQualityScore < 80;
      if (filterStatus === 'excellent') return school.avgQualityScore >= 80;

      return true;
    });
  }, [schools, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    const total = schools.length;
    const excellent = schools.filter((s) => s.avgQualityScore >= 80).length;
    const acceptable = schools.filter((s) => s.avgQualityScore >= 60 && s.avgQualityScore < 80).length;
    const critical = schools.filter((s) => s.avgQualityScore < 60).length;
    return { total, excellent, acceptable, critical };
  }, [schools]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-slate-200 dark:bg-slate-850 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      {/* Header y Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Mapa de Calor de Calidad por Plantel
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitoreo semafórico y diagnóstico pedagógico instantáneo por CCT
          </p>
        </div>

        {/* Buscador y Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por CCT, nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="inline-flex rounded-lg p-1 bg-slate-100 dark:bg-slate-800 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('excellent')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'excellent'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
              }`}
            >
              Óptimos ({stats.excellent})
            </button>
            <button
              onClick={() => setFilterStatus('acceptable')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'acceptable'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
              }`}
            >
              Aceptables ({stats.acceptable})
            </button>
            <button
              onClick={() => setFilterStatus('critical')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'critical'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
              }`}
            >
              Críticos ({stats.critical})
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Planteles */}
      {filteredSchools.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium">No se encontraron planteles con los criterios seleccionados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSchools.map((school) => {
            const score = school.avgQualityScore;
            const isExcellent = score >= 80;
            const isAcceptable = score >= 60 && score < 80;

            const badgeBg = isExcellent
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              : isAcceptable
              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';

            const scoreBarColor = isExcellent ? 'bg-emerald-500' : isAcceptable ? 'bg-amber-500' : 'bg-rose-500';

            return (
              <div
                key={school.schoolId || school.cct}
                onClick={() => onSelectSchool(school)}
                className="group relative p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      {school.cct}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badgeBg} flex items-center gap-1`}>
                      {isExcellent ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : isAcceptable ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {score.toFixed(1)} pts
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {school.name}
                  </h4>
                  {school.municipality && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{school.municipality}</p>
                  )}

                  {/* Barra de Progreso de Calidad */}
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-3">
                    <div className={`h-full ${scoreBarColor} transition-all duration-300`} style={{ width: `${Math.min(score, 100)}%` }} />
                  </div>
                </div>

                {/* Métricas clave */}
                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Planeaciones</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{school.totalPlannings}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Docentes</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{school.activeTeachers}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">PAEC / PMC</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize text-[10px]">
                      {school.paecStatus}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="font-medium">Ver desglose y UACs</span>
                  <span>→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
