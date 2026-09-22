'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  Building2,
} from 'lucide-react';
import type { PedagogicalAlert, AlertSeverity } from '@/types/analytics';

interface AlertPanelProps {
  initialAlerts?: PedagogicalAlert[];
  zoneId?: string;
  onAlertResolved?: (alertId: string) => void;
}

export default function AlertPanel({
  initialAlerts = [],
  zoneId,
  onAlertResolved,
}: AlertPanelProps) {
  const [alerts, setAlerts] = useState<PedagogicalAlert[]>(initialAlerts);
  const [loading, setLoading] = useState<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/v1/alerts?limit=30');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch {
      // Silencioso para no saturar UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/analytics/v1/alerts?limit=30')
      .then((res) => (res.ok ? res.json() : Promise.resolve({ alerts: [] })))
      .then((data) => {
        if (!ignore && data.alerts) {
          setAlerts(data.alerts);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  // Suscripción SSE nativa
  useEffect(() => {
    const streamUrl = `/api/analytics/v1/stream${zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : ''}`;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };

      // Escuchar eventos de tipo 'alert'
      eventSource.addEventListener('alert', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const newAlert: PedagogicalAlert = {
            id: payload.eventId || `alert-${Date.now()}`,
            alertType: payload.eventType || 'ALERT',
            title: payload.title || 'Nueva Alerta Pedagógica',
            description: payload.message || '',
            severity: (payload.severity as AlertSeverity) || 'P1',
            schoolCct: payload.schoolCct,
            schoolName: payload.schoolName,
            zoneId: payload.zoneId,
            channel: 'in_app',
            createdAt: payload.timestamp || new Date().toISOString(),
            resolved: false,
          };

          setAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)]);
        } catch {
          // parse error ignorable
        }
      });

      // Escuchar eventos de tipo 'quality_pulse'
      eventSource.addEventListener('quality_pulse', () => {
        // Pulso recibido
      });
    } catch {
      // Error al instanciar EventSource
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [zoneId]);

  const handleResolve = async (alertId: string) => {
    setResolvingId(alertId);
    try {
      const res = await fetch('/api/analytics/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', alertId }),
      });

      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
        if (onAlertResolved) onAlertResolved(alertId);
      }
    } catch {
      // error silenciado
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'P0':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-600 text-white animate-pulse">
            P0 · CRÍTICA
          </span>
        );
      case 'P1':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white">
            P1 · ALTA
          </span>
        );
      case 'P2':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-400 text-yellow-950">
            P2 · MEDIA
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            P3 · INFORMATIVA
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Alertas de Supervisión</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[10px] text-slate-400">
                {sseConnected ? 'SSE Tiempo Real' : 'Consultando...'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Actualizar alertas"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Lista de Alertas */}
      <div className="flex-1 overflow-y-auto space-y-3 max-h-[620px] pr-1">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Zona en Normalidad</p>
            <p className="text-[11px] text-slate-400">No hay alertas pedagógicas activas pendientes de atención.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-xl border transition-all ${
                alert.severity === 'P0'
                  ? 'border-red-300 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/20'
                  : alert.severity === 'P1'
                  ? 'border-amber-300 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                {getSeverityBadge(alert.severity)}
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {alert.createdAt ? alert.createdAt.slice(11, 16) : ''}
                </span>
              </div>

              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">{alert.title}</h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                {alert.description}
              </p>

              {(alert.schoolName || alert.schoolCct) && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{alert.schoolName || alert.schoolCct}</span>
                </div>
              )}

              <div className="flex justify-end pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolvingId === alert.id}
                  className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors disabled:opacity-50"
                >
                  {resolvingId === alert.id ? 'Marcando...' : 'Marcar atendida'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
