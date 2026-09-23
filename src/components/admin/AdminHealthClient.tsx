'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Database, 
  Cpu, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowLeft, 
  Clock, 
  Server,
  Zap,
  Image as ImageIcon
} from 'lucide-react';
import type { AdminHealthResponse } from '@/app/api/admin/health/route';

interface AdminHealthClientProps {
  locale: string;
}

export default function AdminHealthClient({ locale }: AdminHealthClientProps) {
  const [data, setData] = useState<AdminHealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/health', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      // Both 200 (healthy/degraded) and 503 (unhealthy) return AdminHealthResponse JSON
      const json = (await res.json()) as AdminHealthResponse;
      setData(json);
      setLastChecked(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de comunicación con el servidor';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/admin/health', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
      .then((res) => res.json() as Promise<AdminHealthResponse>)
      .then((json) => {
        if (!ignore) {
          setData(json);
          setLastChecked(new Date());
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Error al consultar diagnóstico');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Semáforo determinations
  const getLatencySemaphore = (latencyMs: number, isDbUp: boolean) => {
    if (!isDbUp || latencyMs < 0) {
      return {
        color: '#fb7185',
        bg: 'rgba(244, 63, 94, 0.12)',
        border: 'rgba(244, 63, 94, 0.35)',
        label: 'Inactivo / Error',
        level: 'rojo',
        icon: XCircle,
      };
    }
    if (latencyMs < 300) {
      return {
        color: '#34d399',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.35)',
        label: 'Excelente (< 300 ms)',
        level: 'verde',
        icon: CheckCircle2,
      };
    }
    if (latencyMs <= 1000) {
      return {
        color: '#fcd34d',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.35)',
        label: 'Moderado (300 - 1000 ms)',
        level: 'amarillo',
        icon: AlertTriangle,
      };
    }
    return {
      color: '#fb7185',
      bg: 'rgba(244, 63, 94, 0.12)',
      border: 'rgba(244, 63, 94, 0.35)',
      label: 'Crítico (> 1000 ms)',
      level: 'rojo',
      icon: AlertTriangle,
    };
  };

  const getSystemStatusBadge = (status: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy':
        return {
          text: 'Todos los sistemas operativos',
          subtext: 'Base de datos y servicios de IA respondiendo adecuadamente.',
          badge: 'badge-green',
          color: '#34d399',
          icon: CheckCircle2,
        };
      case 'degraded':
        return {
          text: 'Rendimiento degradado',
          subtext: 'Latencia elevada o proveedor de IA secundario sin configurar.',
          badge: 'badge-yellow',
          color: '#fcd34d',
          icon: AlertTriangle,
        };
      case 'unhealthy':
      default:
        return {
          text: 'Alerta de sistema',
          subtext: 'Fallo crítico en conexión a Neon PostgreSQL o autenticación.',
          badge: 'badge-red',
          color: '#fb7185',
          icon: XCircle,
        };
    }
  };

  const dbSemaphore = data ? getLatencySemaphore(data.latencyMs, data.db) : null;
  const sysStatus = data ? getSystemStatusBadge(data.status) : null;

  return (
    <div className="health-container">
      <style>{`
        .health-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 16px 48px;
          color: #f0f4ff;
          font-family: inherit;
        }
        .health-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(240, 244, 255, 0.6);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          margin-bottom: 10px;
          transition: color 0.15s;
        }
        .back-link:hover {
          color: #818cf8;
        }
        .title-group h1 {
          font-size: 24px;
          font-weight: 800;
          margin: 0 0 6px 0;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .title-group p {
          margin: 0;
          font-size: 13px;
          color: rgba(240, 244, 255, 0.5);
        }
        .actions-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .btn-refresh {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
        }
        .btn-refresh:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .btn-refresh:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .banner-card {
          background: rgba(8, 12, 24, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          position: relative;
          overflow: hidden;
        }
        .banner-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .banner-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .banner-icon-box {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .grid-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
          margin-bottom: 28px;
        }
        .card {
          background: rgba(8, 12, 24, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 22px;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
          transition: border-color 0.2s, transform 0.2s;
        }
        .card:hover {
          border-color: rgba(99, 102, 241, 0.3);
          transform: translateY(-2px);
        }
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .card-title {
          font-size: 15px;
          font-weight: 700;
          color: #f0f4ff;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .semaphore-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 10px;
        }
        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 10px currentColor;
        }
        .dot-pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { opacity: 0.6; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.6; transform: scale(0.95); }
        }
        .metric-big {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -1px;
          margin: 6px 0;
        }
        .metric-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: rgba(240, 244, 255, 0.45);
        }
        .status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 13px;
        }
        .status-row:last-child {
          border-bottom: none;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }
        .badge-green  { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.25); }
        .badge-yellow { background: rgba(245,158,11,0.12); color: #fcd34d; border: 1px solid rgba(245,158,11,0.25); }
        .badge-red    { background: rgba(244,63,94,0.12);  color: #fb7185; border: 1px solid rgba(244,63,94,0.25); }
        .badge-blue   { background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.25); }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .error-box {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          color: #fb7185;
          font-size: 13px;
        }
      `}</style>

      {/* Navigation & Header */}
      <div>
        <Link href={`/${locale}/admin`} className="back-link">
          <ArrowLeft size={16} /> Volver al Panel de Administración
        </Link>
        <div className="health-header">
          <div className="title-group">
            <h1>
              <Activity size={24} style={{ color: '#818cf8' }} /> Diagnóstico del Sistema y Semáforo
            </h1>
            <p>
              Monitoreo continuo de conexión a Neon PostgreSQL y disponibilidad de proveedores de Inteligencia Artificial
            </p>
          </div>
          <div className="actions-group">
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="btn-refresh"
              title="Volver a consultar estado"
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              {loading ? 'Diagnosticando...' : 'Diagnosticar ahora'}
            </button>
          </div>
        </div>
      </div>

      {/* Network or General Error */}
      {error && (
        <div className="error-box">
          <strong>Error de diagnóstico:</strong> {error}
        </div>
      )}

      {/* Overall Status Banner */}
      {sysStatus && data && (
        <div className="banner-card">
          <div className="banner-content">
            <div className="banner-left">
              <div
                className="banner-icon-box"
                style={{
                  background: `${sysStatus.color}22`,
                  color: sysStatus.color,
                  border: `1px solid ${sysStatus.color}44`,
                }}
              >
                <sysStatus.icon size={28} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: sysStatus.color }}>
                  {sysStatus.text}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(240, 244, 255, 0.6)', marginTop: 2 }}>
                  {sysStatus.subtext}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: 'rgba(240, 244, 255, 0.4)' }}>
              <div>Entorno: <span style={{ color: '#818cf8', fontWeight: 600 }}>{data.environment}</span></div>
              {lastChecked && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Clock size={12} /> Último chequeo: {lastChecked.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid-cards">
        {/* Card 1: Neon DB */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Database size={18} style={{ color: '#818cf8' }} /> Neon PostgreSQL
            </span>
            <span className={`badge ${data?.db ? 'badge-green' : 'badge-red'}`}>
              {data?.db ? 'Conectado' : 'Fallo de Red'}
            </span>
          </div>

          {dbSemaphore && data ? (
            <>
              <div
                className="semaphore-indicator"
                style={{
                  background: dbSemaphore.bg,
                  border: `1px solid ${dbSemaphore.border}`,
                  color: dbSemaphore.color,
                }}
              >
                <span
                  className="dot dot-pulse"
                  style={{ color: dbSemaphore.color, background: dbSemaphore.color }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{dbSemaphore.label}</span>
              </div>

              <div className="metric-label">Latencia del Ping (`SELECT 1`)</div>
              <div className="metric-big" style={{ color: dbSemaphore.color }}>
                {data.latencyMs >= 0 ? `${data.latencyMs} ms` : 'N/A'}
              </div>

              {data.dbError && (
                <div style={{ marginTop: 12, padding: 8, background: 'rgba(244,63,94,0.1)', borderRadius: 6, color: '#fb7185', fontSize: 12 }}>
                  <strong>Detalle error:</strong> {data.dbError}
                </div>
              )}

              <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                <div className="status-row">
                  <span style={{ color: 'rgba(240,244,255,0.5)' }}>Driver</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>@neondatabase/serverless</span>
                </div>
                <div className="status-row">
                  <span style={{ color: 'rgba(240,244,255,0.5)' }}>Pool de conexiones</span>
                  <span className="badge badge-green">Pool Unificado</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(240,244,255,0.4)', fontSize: 13 }}>
              {loading ? 'Consultando latencia...' : 'Sin datos disponibles'}
            </div>
          )}
        </div>

        {/* Card 2: AI Core Providers */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Cpu size={18} style={{ color: '#818cf8' }} /> Proveedores de IA Core
            </span>
            <span className="badge badge-blue">API Keys</span>
          </div>

          <p style={{ fontSize: 12, color: 'rgba(240,244,255,0.5)', margin: '0 0 16px 0' }}>
            Verificación de presencia y validez mínima de tokens en variables de entorno del servidor.
          </p>

          <div className="status-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} style={{ color: '#f59e0b' }} />
              <div>
                <div style={{ fontWeight: 600 }}>Google Gemini</div>
                <div style={{ fontSize: 11, color: 'rgba(240,244,255,0.4)' }}>GEMINI_API_KEY</div>
              </div>
            </div>
            <span className={`badge ${data?.aiProviders.gemini ? 'badge-green' : 'badge-red'}`}>
              {data?.aiProviders.gemini ? 'Configurada ✓' : 'No Detectada'}
            </span>
          </div>

          <div className="status-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} style={{ color: '#818cf8' }} />
              <div>
                <div style={{ fontWeight: 600 }}>Groq Cloud</div>
                <div style={{ fontSize: 11, color: 'rgba(240,244,255,0.4)' }}>GROQ_API_KEY</div>
              </div>
            </div>
            <span className={`badge ${data?.aiProviders.groq ? 'badge-green' : 'badge-red'}`}>
              {data?.aiProviders.groq ? 'Configurada ✓' : 'No Detectada'}
            </span>
          </div>

          <div className="status-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ImageIcon size={16} style={{ color: '#ec4899' }} />
              <div>
                <div style={{ fontWeight: 600 }}>Flux (BFL)</div>
                <div style={{ fontSize: 11, color: 'rgba(240,244,255,0.4)' }}>FLUX_API_KEY</div>
              </div>
            </div>
            <span className={`badge ${data?.aiProviders.flux ? 'badge-green' : 'badge-yellow'}`}>
              {data?.aiProviders.flux ? 'Configurada ✓' : 'Opcional / Ausente'}
            </span>
          </div>
        </div>

        {/* Card 3: Runtime Specs & Semáforo Legend */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Server size={18} style={{ color: '#818cf8' }} /> Criterios del Semáforo
            </span>
            <span className="badge badge-blue">Norma MCCEMS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dot" style={{ color: '#34d399', background: '#34d399' }} />
              <span style={{ color: '#34d399', fontWeight: 600 }}>Verde (&lt; 300 ms):</span>
              <span style={{ color: 'rgba(240,244,255,0.6)' }}>Tiempo de respuesta óptimo sin retrasos perceptibles.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dot" style={{ color: '#fcd34d', background: '#fcd34d' }} />
              <span style={{ color: '#fcd34d', fontWeight: 600 }}>Amarillo (300 - 1000 ms):</span>
              <span style={{ color: 'rgba(240,244,255,0.6)' }}>Latencia moderada, posible congestión de red transitoria.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dot" style={{ color: '#fb7185', background: '#fb7185' }} />
              <span style={{ color: '#fb7185', fontWeight: 600 }}>Rojo (&gt; 1000 ms o Fallo):</span>
              <span style={{ color: 'rgba(240,244,255,0.6)' }}>Inestabilidad o desconexión con el pool de base de datos.</span>
            </div>
          </div>

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="status-row">
              <span style={{ color: 'rgba(240,244,255,0.5)' }}>Endpoint auditado</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>/api/admin/health</span>
            </div>
            <div className="status-row">
              <span style={{ color: 'rgba(240,244,255,0.5)' }}>Seguridad</span>
              <span className="badge badge-green">requireAdmin Guard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
