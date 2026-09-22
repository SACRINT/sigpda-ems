'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, BarChart3, Calendar } from 'lucide-react';
import type { TrendData } from '@/types/analytics';

interface TrendChartsProps {
  trends: TrendData[];
  loading?: boolean;
}

export default function TrendCharts({ trends, loading = false }: TrendChartsProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-800 text-center text-slate-500 shadow-sm">
        <BarChart3 className="w-10 h-10 mx-auto text-slate-400 mb-2" />
        <p className="font-medium">Sin datos de tendencia temporal para este periodo</p>
        <p className="text-sm text-slate-400">Las métricas se consolidan automáticamente con cada planeación evaluada.</p>
      </div>
    );
  }

  const formattedData = trends.map((t) => ({
    ...t,
    displayDate: t.date ? t.date.slice(5) : '', // MM-DD
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfica 1: Calidad Pedagógica Promedio */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">Evolución de Calidad Zonal</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Puntaje promedio DBEPA (0-100 pts) últimos 30 días</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            <Calendar className="w-3.5 h-3.5" /> 30 días
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                formatter={(value: unknown) => {
                  const num = typeof value === 'number' ? value : Number(value);
                  return [Number.isNaN(num) ? '0 pts' : `${num.toFixed(1)} pts`, 'Calidad Promedio'];
                }}
              />
              <Area
                type="monotone"
                dataKey="avgQualityScore"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#qualityGradient)"
                name="Calidad Promedio"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfica 2: Volumen de Planeaciones y Actividad */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">Ritmo de Generación y Cobertura</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Planeaciones generadas y planteles activos diarios</p>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="planningsCount"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Planeaciones"
              />
              <Line
                type="monotone"
                dataKey="activeSchools"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Planteles Activos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
