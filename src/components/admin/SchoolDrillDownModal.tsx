'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Building2,
  BookOpen,
  FileText,
} from 'lucide-react';
import type { SchoolMetric } from '@/types/analytics';

interface SchoolDetailResponse {
  school: SchoolMetric;
  uacBreakdown: Array<{
    uac: string;
    teachersCount: number;
    planningsCount: number;
    avgScore: number;
  }>;
  recentPlannings: Array<{
    id: string;
    subject: string;
    teacherName: string;
    score: number;
    qualityStatus: string;
    createdAt: string;
  }>;
}

interface SchoolDrillDownModalProps {
  schoolId: string | null;
  onClose: () => void;
}

export default function SchoolDrillDownModal({ schoolId, onClose }: SchoolDrillDownModalProps) {
  const [data, setData] = useState<SchoolDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    let isMounted = true;
    fetch(`/api/analytics/v1/school/${encodeURIComponent(schoolId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Error ${res.status}`);
        }
        return res.json();
      })
      .then((resData: SchoolDetailResponse) => {
        if (isMounted) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error cargando detalles del plantel');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!schoolId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {data?.school?.name || 'Detalles del Plantel'}
                </h2>
                {data?.school?.cct && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {data.school.cct}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data?.school?.municipality || 'Puebla'} · Subsistema {data?.school?.subsystem || 'BGE'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                ))}
              </div>
              <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-sm">
              <p className="font-semibold">Error al cargar datos:</p>
              <p>{error}</p>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Tarjetas KPI de Plantel */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Puntaje de Calidad</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {data.school.avgQualityScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400">/100</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Planeaciones</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                    {data.school.totalPlannings}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Docentes Activos</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                    {data.school.activeTeachers}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Estado PAEC / PMC</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white mt-2 block capitalize">
                    {data.school.paecStatus} / {data.school.pmcStatus}
                  </span>
                </div>
              </div>

              {/* Desglose por UAC */}
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Rendimiento por Asignatura / UAC
                </h4>

                {data.uacBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hay desglose de UACs disponible aún.</p>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4">Unidad de Aprendizaje Curricular (UAC)</th>
                          <th className="py-2.5 px-4 text-center">Planeaciones</th>
                          <th className="py-2.5 px-4 text-center">Docentes</th>
                          <th className="py-2.5 px-4 text-right">Calidad Promedio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.uacBreakdown.map((row) => (
                          <tr key={row.uac} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                            <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">{row.uac}</td>
                            <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-400">
                              {row.planningsCount}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-400">
                              {row.teachersCount}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                              {row.avgScore.toFixed(1)} pts
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Últimas Planeaciones */}
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Planeaciones Recientes Registradas
                </h4>

                {data.recentPlannings.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hay planeaciones registradas.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {data.recentPlannings.map((p) => (
                      <div key={p.id} className="p-3 bg-white dark:bg-slate-850 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{p.subject}</p>
                          <p className="text-slate-500 dark:text-slate-400">
                            Docente: {p.teacherName || 'Docente'} · {p.createdAt ? p.createdAt.slice(0, 10) : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold ${
                              p.score >= 80
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : p.score >= 60
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {p.score} pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
