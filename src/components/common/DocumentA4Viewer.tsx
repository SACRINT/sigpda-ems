'use client';

import React, { useState } from 'react';
import type { Planning, GeneratedPlanningContent } from '@/types/planning';
import { generatePlanningPDF } from '@/lib/pdf-generator';
import { enrichWithExplicitSaberes } from '@/lib/planning-integrity-system';

interface DocumentA4ViewerProps {
  planning: Planning;
  onDownloadDocx?: () => void;
}

export default function DocumentA4Viewer({
  planning,
  onDownloadDocx,
}: DocumentA4ViewerProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const rawContent = planning.contentJson as GeneratedPlanningContent | null;
  const content = rawContent ? enrichWithExplicitSaberes(rawContent) : null;
  const s1 = content?.sectionI;
  const s2 = content?.sectionII;
  const s3 = content?.sectionIII;
  const s4 = content?.sectionIV;
  const s5 = content?.sectionV;
  const s6 = content?.sectionVI;

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const pdf = await generatePlanningPDF(planning);
      const filename = `Planeacion_${planning.uacName.replace(/\s+/g, '_')}_Semestre_${planning.semester}.pdf`;
      pdf.save(filename);
    } catch (e) {
      console.error('Error generating PDF:', e);
      alert('Hubo un error al generar el archivo PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <style>{`
        .a4-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #1e293b;
          color: #f8fafc;
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          flex-wrap: wrap;
          gap: 12px;
        }
        .a4-page {
          width: 816px;
          min-height: 1056px;
          background: #ffffff;
          color: #1e293b;
          margin: 0 auto 32px auto;
          padding: 36px 44px 50px 44px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08);
          border-radius: 2px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          position: relative;
          page-break-after: always;
          break-after: page;
        }
        .a4-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          font-size: 11px;
        }
        .a4-table th {
          background: #1f3864;
          color: #ffffff;
          font-weight: 700;
          text-align: left;
          padding: 6px 8px;
          border: 1px solid #1f3864;
          font-size: 11px;
        }
        .a4-table td {
          border: 1px solid #cbd5e1;
          padding: 5px 8px;
          vertical-align: top;
          font-size: 10px;
          line-height: 1.4;
        }
        .a4-table .label-cell {
          background: #f1f5f9;
          font-weight: 600;
          color: #334155;
          width: 25%;
        }
        .header-continuity {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #2e74b5;
          padding-bottom: 6px;
          margin-bottom: 14px;
          font-size: 9px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .footer-page {
          position: absolute;
          bottom: 16px;
          left: 44px;
          right: 44px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8.5px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 6px;
        }
        @media print {
          @page {
            size: letter portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden;
          }
          .a4-printable-area, .a4-printable-area * {
            visibility: visible;
          }
          .a4-printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .a4-toolbar {
            display: none !important;
          }
          .a4-page {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 15px 20px !important;
            width: 100% !important;
            min-height: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .footer-page {
            position: static !important;
            margin-top: 15px !important;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div className="a4-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Visor Editorial Carta:</span>
          <span style={{ fontSize: '12px', background: '#3b82f6', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
            {planning.uacName} ({planning.semester}° Semestre)
          </span>
          <span style={{ fontSize: '11px', background: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
            {s4?.activities?.length || 3} Bloques Formativos · {s1?.totalHours || 54}h
          </span>
        </div>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold' }}
            title="Reducir zoom"
          >
            -
          </button>
          <span style={{ fontSize: '12px', minWidth: '45px', textAlign: 'center', fontWeight: 600 }}>{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(150, zoom + 10))}
            style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold' }}
            title="Aumentar zoom"
          >
            +
          </button>
          <button
            onClick={() => setZoom(100)}
            style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', marginLeft: '4px' }}
          >
            100%
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handlePrint}
            style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            🖨️ Imprimir
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {downloadingPdf ? '⏳ Generando PDF...' : '↓ Descargar PDF'}
          </button>
          {onDownloadDocx && (
            <button
              onClick={onDownloadDocx}
              style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              ↓ Descargar DOCX
            </button>
          )}
        </div>
      </div>

      {/* Printable / Viewable Container with Zoom */}
      <div
        style={{
          background: '#cbd5e1',
          padding: '24px',
          borderRadius: '10px',
          overflowX: 'auto',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          className="a4-printable-area"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease',
          }}
        >
          {/* ════════════════════════════════════════════════════════════════════
              PÁGINA 1: CARÁTULA OFICIAL, DATOS GENERALES Y TRANSVERSALIDAD
          ════════════════════════════════════════════════════════════════════ */}
          <div className="a4-page">
            {/* Header Oficial con 3 Logos */}
            <div style={{ borderBottom: '3px solid #E8A020', paddingBottom: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <img
                  src="/images/logo-gobierno-puebla.png"
                  alt="Gobierno de Puebla"
                  style={{ height: '44px', maxWidth: '140px', objectFit: 'contain' }}
                />
                <img
                  src="/images/logo-sep-puebla.png"
                  alt="Secretaría de Educación Pública"
                  style={{ height: '34px', maxWidth: '140px', objectFit: 'contain' }}
                />
                <img
                  src="/images/logo-supervision-004.png"
                  alt="Supervisión Escolar 004"
                  style={{ height: '40px', maxWidth: '120px', objectFit: 'contain' }}
                />
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#1f3864', letterSpacing: '0.02em' }}>
                  SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA
                </div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#1e293b', marginTop: '1px' }}>
                  SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA · DIRECCIÓN DE BACHILLERATOS ESTATALES
                </div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#2e74b5', marginTop: '2px' }}>
                  SUPERVISIÓN ESCOLAR DE BACHILLERATOS ZONA 004
                </div>
                <div style={{ fontSize: '11px', fontWeight: 900, color: '#1f3864', marginTop: '4px', letterSpacing: '0.03em' }}>
                  INSTRUMENTO OFICIAL DE PLANEACIÓN DIDÁCTICA (MCCEMS NEM 2026-2027)
                </div>
              </div>
            </div>

            {/* SECCIÓN I */}
            <table className="a4-table">
              <thead>
                <tr>
                  <th colSpan={4}>I. DATOS DE IDENTIFICACIÓN INSTITUCIONAL Y CURRICULAR</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="label-cell">Plantel / Escuela:</td>
                  <td>{s1?.schoolName || 'Bachillerato General Oficial'}</td>
                  <td className="label-cell">Clave C.C.T.:</td>
                  <td>{s1?.cct || '21EBH0000X'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Docente Titular:</td>
                  <td>{s1?.teacherName || 'Docente Responsable'}</td>
                  <td className="label-cell">Semestre / Grupo:</td>
                  <td>{planning.semester}° Semestre · {s1?.groups || 'Grupos Únicos'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Unidad de Aprendizaje:</td>
                  <td style={{ fontWeight: 'bold', color: '#1f3864' }}>{planning.uacName}</td>
                  <td className="label-cell">Componente:</td>
                  <td>{planning.component === 'laboral' ? 'Formación Laboral' : 'Fundamental / Ampliado'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Horas Semanales / Totales:</td>
                  <td>{s1?.totalHoursWeekly || 4} hrs/sem · {s1?.totalHours || 54} hrs/semestre</td>
                  <td className="label-cell">Periodo / Ciclo:</td>
                  <td>{s1?.applicationPeriod || s1?.period || 'Semestre 2026-2027'}</td>
                </tr>
              </tbody>
            </table>

            {/* SECCIÓN II */}
            <table className="a4-table">
              <thead>
                <tr>
                  <th colSpan={2}>II. PROPÓSITO FORMATIVO Y METAS DE APRENDIZAJE</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="label-cell" style={{ width: '28%' }}>Propósito General:</td>
                  <td>{s2?.purpose || 'Desarrollo de competencias socioformativas y pensamiento reflexivo.'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Metas de Aprendizaje:</td>
                  <td>{s2?.learningOutcomes?.join('; ') || 'Logro de aprendizajes de trayectoria e integración comunitaria.'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Contexto y Problemática:</td>
                  <td>{s2?.paecConnection || planning.paecContext || 'Contextualización a las necesidades de la comunidad.'}</td>
                </tr>
              </tbody>
            </table>

            {/* SECCIÓN II: Dosificación de Cortes */}
            {s2?.activities && s2.activities.length > 0 && (
              <table className="a4-table">
                <thead>
                  <tr style={{ background: '#2e74b5' }}>
                    <th style={{ background: '#2e74b5', width: '55%' }}>Dosificación de Bloques / Actividades Clave</th>
                    <th style={{ background: '#2e74b5', textAlign: 'center', width: '25%' }}>Corte de Evaluación</th>
                    <th style={{ background: '#2e74b5', textAlign: 'center', width: '20%' }}>Horas Asignadas</th>
                  </tr>
                </thead>
                <tbody>
                  {s2.activities.map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{i + 1}. {a.name}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#1f3864' }}>{a.corte || `Corte ${i + 1}`}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{a.hours} hrs.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* SECCIÓN III */}
            <table className="a4-table">
              <thead>
                <tr>
                  <th colSpan={2}>III. TRANSVERSALIDAD Y VINCULACIÓN COMUNITARIA (PAEC)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="label-cell" style={{ width: '28%' }}>Proyecto PAEC:</td>
                  <td>{s2?.paecConnection || planning.paecContext || 'Articulación con el Proyecto Comunitario del Plantel.'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Currículum Fundamental:</td>
                  <td>
                    {s3?.fundamentalCurriculum?.length
                      ? s3.fundamentalCurriculum.map((t) => `${t.area}: ${t.description}`).join(' | ')
                      : 'Cultura Digital, Lengua y Comunicación, Conciencia Histórica, Pensamiento Matemático.'}
                  </td>
                </tr>
                <tr>
                  <td className="label-cell">Currículum Ampliado:</td>
                  <td>
                    {s3?.expandedCurriculum?.length
                      ? s3.expandedCurriculum.map((t) => `${t.area}: ${t.description}`).join(' | ')
                      : 'Habilidades para la Vida y el Trabajo (HVyT) · CoCEDS.'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footer */}
            <div className="footer-page">
              <span>SIGPDA-EMS · Sistema Integral de Gestión Pedagógica y Didáctica</span>
              <span>Página 1 de 3</span>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              PÁGINA 2: SECUENCIA DIDÁCTICA COMPLETA POR MOMENTOS FORMATIVOS
              (Renders TODOS los bloques sin recortes ni .slice)
          ════════════════════════════════════════════════════════════════════ */}
          <div className="a4-page">
            {/* Header de continuidad */}
            <div className="header-continuity">
              <span>SEP PUEBLA · SUPERVISIÓN ESCOLAR 004 · DBEPA</span>
              <span>{planning.uacName} · {planning.semester}° SEMESTRE</span>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#1f3864' }}>
                IV. SECUENCIA DIDÁCTICA POR MOMENTOS PEDAGÓGICOS (SECUENCIA COMPLETA)
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', fontStyle: 'italic' }}>
                {s4?.note || 'Metodología activa con rigor técnico, prácticas de taller y evaluación socioformativa continua.'}
              </div>
            </div>

            {/* Renders ALL activities with .map() — NO SLICE! */}
            {(s4?.activities || []).map((act, idx) => (
              <table className="a4-table" key={idx} style={{ marginBottom: '14px' }}>
                <thead>
                  <tr style={{ background: '#1f3864', color: '#fff' }}>
                    <th colSpan={4} style={{ padding: '6px 8px', fontSize: '10.5px' }}>
                      Bloque {idx + 1}: {act.name} ({act.hours || 18} Horas) — Metodología: {act.methodology}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Desglose Explícito de los Tres Saberes */}
                  {act.saberes && (
                    <tr style={{ background: '#f8fafc' }}>
                      <td className="label-cell" style={{ color: '#0369a1', fontWeight: 700 }}>
                        Taxonomía de los Tres Saberes:
                      </td>
                      <td colSpan={3} style={{ fontSize: '9.5px', lineHeight: 1.45 }}>
                        <div><strong style={{ color: '#0369a1' }}>• Saber (Teórico / Normativo NOM):</strong> {act.saberes.saber}</div>
                        <div style={{ marginTop: '2px' }}><strong style={{ color: '#047857' }}>• Saber Hacer (Práctico / Taller):</strong> {act.saberes.saberHacer}</div>
                        <div style={{ marginTop: '2px' }}><strong style={{ color: '#b45309' }}>• Saber Ser (Actitudinal / Seguridad):</strong> {act.saberes.saberSer}</div>
                      </td>
                    </tr>
                  )}

                  {/* Apertura */}
                  <tr>
                    <td className="label-cell" style={{ width: '22%' }}>Apertura:</td>
                    <td colSpan={3} style={{ fontSize: '9.5px' }}>
                      <div>{act.apertura?.activities || 'Exploración y recuperación de saberes previos.'}</div>
                      {act.apertura?.materials && (
                        <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>
                          <em>Insumos/Recursos:</em> {act.apertura.materials}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Desarrollo */}
                  <tr>
                    <td className="label-cell">Desarrollo (Ejecución):</td>
                    <td colSpan={3} style={{ fontSize: '9.5px' }}>
                      <div>{act.ejecucion?.activities || 'Construcción activa del conocimiento y práctica técnica.'}</div>
                      {act.ejecucion?.materials && (
                        <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>
                          <em>Herramientas, Insumos y EPP:</em> {act.ejecucion.materials}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Cierre */}
                  <tr>
                    <td className="label-cell">Cierre (Evaluación):</td>
                    <td colSpan={3} style={{ fontSize: '9.5px' }}>
                      <div>{act.conclusion?.activities || 'Metacognición, defensa técnica y entrega de evidencias.'}</div>
                      {act.conclusion?.materials && (
                        <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>
                          <em>Evidencias e Instrumentos:</em> {act.conclusion.materials}
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            ))}

            {/* Footer */}
            <div className="footer-page">
              <span>SIGPDA-EMS · Sistema Integral de Gestión Pedagógica y Didáctica</span>
              <span>Página 2 de 3</span>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              PÁGINA 3: EVALUACIÓN, RECURSOS Y VALIDACIÓN INSTITUCIONAL
          ════════════════════════════════════════════════════════════════════ */}
          <div className="a4-page">
            {/* Header de continuidad */}
            <div className="header-continuity">
              <span>SEP PUEBLA · SUPERVISIÓN ESCOLAR 004 · DBEPA</span>
              <span>{planning.uacName} · {planning.semester}° SEMESTRE</span>
            </div>

            {/* SECCIÓN V: Estrategia de Evaluación Formativa */}
            <table className="a4-table">
              <thead>
                <tr>
                  <th colSpan={5}>V. ESTRATEGIA DE EVALUACIÓN FORMATIVA Y TRINOMIO DE EVALUACIÓN</th>
                </tr>
              </thead>
              <tbody>
                {s5?.evaluationAgreement && (
                  <tr style={{ background: '#f8fafc' }}>
                    <td className="label-cell" style={{ width: '22%' }}>Acuerdo de Acreditación:</td>
                    <td colSpan={4} style={{ fontSize: '9.5px', fontStyle: 'italic', color: '#334155' }}>
                      {s5.evaluationAgreement}
                    </td>
                  </tr>
                )}
                <tr style={{ background: '#2e74b5', color: '#fff', fontWeight: 'bold' }}>
                  <td style={{ color: '#fff', width: '20%' }}>Corte / Momento</td>
                  <td style={{ color: '#fff', width: '30%' }}>Evidencia de Aprendizaje</td>
                  <td style={{ color: '#fff', width: '25%' }}>Instrumento Propuesto</td>
                  <td style={{ color: '#fff', width: '15%' }}>Agente</td>
                  <td style={{ color: '#fff', textAlign: 'center', width: '10%' }}>%</td>
                </tr>
                {(s5?.evaluations || []).map((ev, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{ev.moment}</td>
                    <td>{ev.evidence}</td>
                    <td>{ev.instrument}</td>
                    <td style={{ fontSize: '9px', color: '#475569' }}>{ev.agent}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{ev.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* SECCIÓN VI: Recursos y Materiales */}
            <table className="a4-table">
              <thead>
                <tr>
                  <th colSpan={2}>VI. MATERIALES, RECURSOS Y ESPACIOS DIDÁCTICOS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="label-cell" style={{ width: '25%' }}>Materiales del Estudiante:</td>
                  <td>{(s6?.studentMaterials || []).join('; ') || 'Libreta de apuntes, útiles básicos, celular para consulta.'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Materiales del Docente:</td>
                  <td>{(s6?.teacherMaterials || []).join('; ') || 'Manual de prácticas impreso, guías didácticas, rúbricas analíticas.'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Recursos Digitales / TICCAD:</td>
                  <td>{(s6?.digital || []).join('; ') || 'Software visor de planos, proyector del plantel, simuladores en línea.'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Espacios de Aprendizaje:</td>
                  <td>{(s6?.spaces || []).join('; ') || 'Aula de clases, Laboratorio de cómputo, Taller de prácticas.'}</td>
                </tr>
                <tr>
                  <td className="label-cell">Normatividad y Referencias:</td>
                  <td>{(s6?.references || []).join('; ') || 'Normas Oficiales Mexicanas aplicables y bibliografía técnica básica.'}</td>
                </tr>
              </tbody>
            </table>

            {/* SECCIÓN VII: Validación y Firmas Oficiales */}
            <table className="a4-table" style={{ marginTop: '20px' }}>
              <thead>
                <tr>
                  <th colSpan={3} style={{ textAlign: 'center' }}>VII. VALIDACIÓN Y AUTORIZACIÓN OFICIAL</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ height: '75px', verticalAlign: 'bottom' }}>
                  <td style={{ textAlign: 'center', width: '33.3%', paddingBottom: '10px' }}>
                    <div style={{ borderTop: '1px solid #000', margin: '36px 12px 4px 12px' }} />
                    <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#1f3864' }}>DOCENTE TITULAR</div>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>{s1?.teacherName || 'Nombre y Firma'}</div>
                  </td>
                  <td style={{ textAlign: 'center', width: '33.3%', paddingBottom: '10px' }}>
                    <div style={{ borderTop: '1px solid #000', margin: '36px 12px 4px 12px' }} />
                    <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#1f3864' }}>DIRECTOR DEL PLANTEL</div>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>Firma y Sello</div>
                  </td>
                  <td style={{ textAlign: 'center', width: '33.3%', paddingBottom: '10px' }}>
                    <div style={{ borderTop: '1px solid #000', margin: '36px 12px 4px 12px' }} />
                    <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#1f3864' }}>SUPERVISIÓN DE ZONA</div>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>Vo. Bo. Oficial</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footer */}
            <div className="footer-page">
              <span>SIGPDA-EMS · Sistema Integral de Gestión Pedagógica y Didáctica</span>
              <span>Página 3 de 3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
