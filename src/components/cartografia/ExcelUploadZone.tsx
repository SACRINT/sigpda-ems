'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { CartografiaPlantelItem, CartografiaMomento1Conocer, CartografiaMomento2Organizar } from '@/types/cartografia';
import type { PipsPlantele } from '@/types/pips';
import { parsePmcStatistics } from '@/lib/pmc-statistics-parser';
import { formatZoneMetric } from '@/lib/zone-metric-format';

interface ExcelUploadZoneProps {
  zonaNumero?: string;
  cicloEscolar?: string;
  onDataInjected: (payload: {
    planteles: PipsPlantele[];
    momento1?: CartografiaMomento1Conocer;
    momento2?: CartografiaMomento2Organizar;
    diagnosticoText?: string;
  }) => void;
  onClose?: () => void;
}

interface ParsedZoneData {
  filename: string;
  planteles: CartografiaPlantelItem[];
  matriculaTotal: number;
  promedioEficiencia?: number;
  promedioAbandono?: number;
  promedioAprovechamiento?: number;
  promedioReprobacion?: number;
  plantelesPrioritarios: string[];
  momento1?: CartografiaMomento1Conocer;
  momento2?: CartografiaMomento2Organizar;
}

export default function ExcelUploadZone({
  zonaNumero = '004',
  cicloEscolar = '2026-2027',
  onDataInjected,
  onClose,
}: ExcelUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedZoneData | null>(null);
  const [selectedCcts, setSelectedCcts] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);

    try {
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
        throw new Error('Formato no soportado. Sube un archivo Excel (.xlsx, .xls) o CSV.');
      }

      // Intentar primero procesar vía API con enriquecimiento PAEC de base de datos
      const formData = new FormData();
      formData.append('file', file);
      formData.append('zonaNumero', zonaNumero);
      formData.append('cicloEscolar', cicloEscolar);

      let usedApi = false;
      try {
        const res = await fetch('/api/pips/parse-excel', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.momento1?.planteles?.length > 0) {
            const m1: CartografiaMomento1Conocer = json.momento1;
            const m2: CartografiaMomento2Organizar = json.momento2;
            const planteles: CartografiaPlantelItem[] = m1.planteles;

            setParsedData({
              filename: file.name,
              planteles,
              matriculaTotal: m1.matriculaTotalZona,
              promedioEficiencia: m2.capaCuantitativa.promedioEficienciaZona,
              promedioAbandono: m2.capaCuantitativa.promedioAbandonoZona,
              promedioAprovechamiento: m2.capaCuantitativa.promedioAprovechamientoZona,
              promedioReprobacion: m2.capaCuantitativa.promedioReprobacionZona,
              plantelesPrioritarios: m2.capaCuantitativa.plantelesAtencionPrioritaria || [],
              momento1: m1,
              momento2: m2,
            });
            setSelectedCcts(new Set(planteles.map(p => p.cct)));
            usedApi = true;
          }
        }
      } catch {
        // Fallback a parser cliente si la API no estuviera disponible
        usedApi = false;
      }

      if (!usedApi) {
        // Parser directo en cliente con pmc-statistics-parser
        const arrayBuffer = await file.arrayBuffer();
        const clientResult = parsePmcStatistics(arrayBuffer, {
          zonaNumero,
          cicloEscolar,
        });

        if (!clientResult.success || clientResult.allPlanteles.length === 0) {
          throw new Error(clientResult.error || 'No se pudieron extraer planteles del archivo Excel.');
        }

        const planteles: CartografiaPlantelItem[] = clientResult.allPlanteles.map((p, i) => ({
          no: i + 1,
          cct: p.cct,
          nombre: p.nombre,
          localidad: 'Comunidad escolar',
          municipio: 'Zona Escolar',
          turno: p.turno || 'MATUTINO',
          matricula: p.matricula,
          egresados: p.egresados,
          bajasDefinitivas: p.bajasDefinitivas,
          eficienciaTerminal: p.eficienciaTerminal,
          abandono: p.abandono,
          reprobacion: p.reprobacion,
          promedioGeneral: p.promedioGeneral ?? p.promedioCalificaciones,
        }));

        const matriculaTotal = planteles.reduce((sum, p) => sum + (p.matricula ?? 0), 0);

        const conET = planteles.filter(p => p.eficienciaTerminal !== undefined && p.eficienciaTerminal > 0);
        const promEficiencia = clientResult.zona?.promedioEficiencia ?? (conET.length > 0 ? parseFloat((conET.reduce((a, b) => a + (b.eficienciaTerminal ?? 0), 0) / conET.length).toFixed(2)) : undefined);
        const conAbandono = planteles.filter(p => p.abandono !== undefined);
        const promAbandono = clientResult.zona?.promedioAbandono ?? (conAbandono.length > 0 ? parseFloat((conAbandono.reduce((a, b) => a + (b.abandono ?? 0), 0) / conAbandono.length).toFixed(2)) : undefined);
        const conProm = planteles.filter(p => p.promedioGeneral !== undefined);
        const promAprov = clientResult.zona?.promedioCalificaciones ?? (conProm.length > 0 ? parseFloat((conProm.reduce((a, b) => a + (b.promedioGeneral ?? 0), 0) / conProm.length).toFixed(2)) : undefined);
        const conReprob = planteles.filter(p => p.reprobacion !== undefined);
        const promReprob = clientResult.zona?.promedioReprobacion ?? (conReprob.length > 0 ? parseFloat((conReprob.reduce((a, b) => a + (b.reprobacion ?? 0), 0) / conReprob.length).toFixed(2)) : undefined);

        const prioritarios = planteles
          .filter(p => (p.abandono !== undefined && promAbandono !== undefined && p.abandono > promAbandono + 3) || (p.eficienciaTerminal !== undefined && promEficiencia !== undefined && p.eficienciaTerminal < promEficiencia - 5))
          .map(p => `${p.nombre} (Abandono: ${formatZoneMetric(p.abandono, { pct: true })}, ET: ${formatZoneMetric(p.eficienciaTerminal, { pct: true })})`);

        setParsedData({
          filename: file.name,
          planteles,
          matriculaTotal,
          promedioEficiencia: promEficiencia,
          promedioAbandono: promAbandono,
          promedioAprovechamiento: promAprov,
          promedioReprobacion: promReprob,
          plantelesPrioritarios: prioritarios,
        });
        setSelectedCcts(new Set(planteles.map(p => p.cct)));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al leer el archivo Excel.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [zonaNumero, cicloEscolar]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const toggleCct = (cct: string) => {
    const next = new Set(selectedCcts);
    if (next.has(cct)) {
      next.delete(cct);
    } else {
      next.add(cct);
    }
    setSelectedCcts(next);
  };

  const toggleAll = () => {
    if (!parsedData) return;
    if (selectedCcts.size === parsedData.planteles.length) {
      setSelectedCcts(new Set());
    } else {
      setSelectedCcts(new Set(parsedData.planteles.map(p => p.cct)));
    }
  };

  const handleConfirm = () => {
    if (!parsedData) return;

    // Filtrar planteles seleccionados
    const activePlanteles = parsedData.planteles.filter(p => selectedCcts.has(p.cct));

    // Mapear a formato PipsPlantele compatible con el wizard
    const pipsPlanteles: PipsPlantele[] = activePlanteles.map((p, idx) => {
      // Estimación 50/50 de género si no viene desglosado en el archivo
      const mat = p.matricula ?? 0;
      const hombres = Math.round(mat * 0.49);
      const mujeres = mat - hombres;
      return {
        no: idx + 1,
        cct: p.cct,
        nombre: p.nombre,
        localidad: p.localidad || 'Comunidad Escolar',
        municipio: p.municipio || 'Zona Escolar',
        hombres,
        mujeres,
        total: mat,
      };
    });

    // Construir texto de diagnóstico automático enriquecido
    const diagText = `Diagnóstico territorial consolidado a partir de la estadística oficial 911.7G y F11C (Zona ${zonaNumero}, Ciclo ${cicloEscolar}):\n` +
      `• Cobertura Zonal: ${pipsPlanteles.length} planteles analizados con una matrícula total de ${parsedData.matriculaTotal} estudiantes.\n` +
      `• Línea Base Cuantitativa: Eficiencia Terminal Zonal del ${formatZoneMetric(parsedData.promedioEficiencia, { pct: true })}, Abandono Escolar Zonal del ${formatZoneMetric(parsedData.promedioAbandono, { pct: true })}, Promedio General de Aprovechamiento en ${formatZoneMetric(parsedData.promedioAprovechamiento)} y Reprobación del ${formatZoneMetric(parsedData.promedioReprobacion, { pct: true })}.\n` +
      (parsedData.plantelesPrioritarios.length > 0 
        ? `• Planteles con Atención Prioritaria: ${parsedData.plantelesPrioritarios.join('; ')}.\n` 
        : '') +
      `• Retos Identificados: Dispersión geográfica, trabajo juvenil estacional y necesidades de nivelación académica en pensamiento matemático y comunicación integral.`;

    onDataInjected({
      planteles: pipsPlanteles,
      momento1: parsedData.momento1,
      momento2: parsedData.momento2,
      diagnosticoText: diagText,
    });
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(99, 102, 241, 0.4)',
      borderRadius: 14,
      padding: 24,
      marginBottom: 24,
      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.02em' }}>
              Asistente de Carga de Matriz Estadística (Formato 911.7G / F11C / Oficial)
            </h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Importa la sábana oficial de Excel de la zona para poblar el directorio de escuelas y calcular automáticamente las metas CREAA y brechas diagnósticas.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}
            title="Cerrar importador"
          >
            ✕
          </button>
        )}
      </div>

      {/* Drop Zone */}
      {!parsedData && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragging ? '2px dashed #6366f1' : '2px dashed rgba(99, 102, 241, 0.3)',
            borderRadius: 12,
            padding: '36px 20px',
            textAlign: 'center',
            background: isDragging ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                processFile(e.target.files[0]);
              }
            }}
          />
          <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
            {loading ? '⏳ Procesando matriz de zona...' : 'Arrastra aquí tu archivo Excel o haz clic para seleccionarlo'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Soporta libros oficiales de zona (.xlsx, .xls) con columnas de Matrícula, 911.7G (Fin de Cursos), F11C (Control Escolar) o EDIEMS/ESA
          </div>
          {loading && (
            <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#818cf8', fontWeight: 600 }}>
              <span className="spinner" /> Extrayendo datos de planteles y calculando promedios de zona...
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 12 }}>
          ⚠️ <strong>Error al procesar:</strong> {error}
        </div>
      )}

      {/* Preview Section */}
      {parsedData && (
        <div>
          {/* Header del archivo cargado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.25)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c7d2fe' }}>{parsedData.filename}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {parsedData.planteles.length} planteles detectados · {selectedCcts.size} seleccionados
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setParsedData(null);
                setError(null);
              }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              🔄 Cargar otro archivo
            </button>
          </div>

          {/* KPI Cards de Zona */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Matrícula Zona</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>{parsedData.matriculaTotal}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Eficiencia Term.</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#4ade80', marginTop: 2 }}>
                {formatZoneMetric(parsedData.promedioEficiencia, { pct: true })}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Abandono Esc.</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#f87171', marginTop: 2 }}>{formatZoneMetric(parsedData.promedioAbandono, { pct: true })}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Aprov. F11C</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>{parsedData.promedioAprovechamiento}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Reprobación</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#a78bfa', marginTop: 2 }}>{parsedData.promedioReprobacion}%</div>
            </div>
          </div>

          {/* Planteles de Atención Prioritaria */}
          {parsedData.plantelesPrioritarios.length > 0 && (
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚠️ Planteles con Alerta por Brecha Zonal (Atención Prioritaria):
              </div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11, color: '#fde68a' }}>
                {parsedData.plantelesPrioritarios.map((pl, i) => (
                  <li key={i}>{pl}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabla de Planteles con Selección */}
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginBottom: 18 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'rgba(30, 41, 59, 0.9)', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ padding: '7px 8px', textAlign: 'center', width: 32 }}>
                    <input
                      type="checkbox"
                      checked={selectedCcts.size === parsedData.planteles.length}
                      onChange={toggleAll}
                      title="Seleccionar / Deseleccionar todos"
                    />
                  </th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', color: '#c7d2fe', width: 28 }}>No.</th>
                  <th style={{ padding: '7px 8px', textAlign: 'left', color: '#c7d2fe' }}>Plantel</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', color: '#c7d2fe', width: 90 }}>CCT</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', color: '#38bdf8', width: 65 }}>Matrícula</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', color: '#4ade80', width: 70 }}>Eficiencia</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', color: '#f87171', width: 70 }}>Abandono</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', color: '#fbbf24', width: 65 }}>Prom. F11C</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.planteles.map((p, i) => {
                  const isChecked = selectedCcts.has(p.cct);
                  return (
                    <tr
                      key={p.cct || i}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: isChecked ? (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)') : 'rgba(0,0,0,0.2)',
                        opacity: isChecked ? 1 : 0.45,
                      }}
                    >
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCct(p.cct)}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                      <td style={{ padding: '6px 8px', color: '#f8fafc', fontWeight: 600 }}>{p.nombre}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace' }}>{p.cct}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#38bdf8', fontWeight: 700 }}>{formatZoneMetric(p.matricula)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#4ade80' }}>
                        {formatZoneMetric(p.eficienciaTerminal, { pct: true })}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f87171' }}>{formatZoneMetric(p.abandono, { pct: true })}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>{formatZoneMetric(p.promedioGeneral)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#cbd5e1',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              disabled={selectedCcts.size === 0}
              onClick={handleConfirm}
              style={{
                background: selectedCcts.size > 0 ? '#10b981' : '#334155',
                border: 'none',
                color: '#ffffff',
                borderRadius: 8,
                padding: '9px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: selectedCcts.size > 0 ? 'pointer' : 'not-allowed',
                boxShadow: selectedCcts.size > 0 ? '0 4px 14px rgba(16, 185, 129, 0.4)' : 'none',
              }}
            >
              ✅ Confirmar e Inyectar ({selectedCcts.size} planteles)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
