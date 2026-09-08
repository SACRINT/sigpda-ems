'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Table as TableExt } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useCallback, useState, useEffect } from 'react';
import { EditorToolbar } from './editor-toolbar';
import { BloqueApertura, BloqueDesarrollo, BloqueCierre, BloqueRubrica, BloqueProposito, BloqueActividad, BloqueSeccion } from './editor-extensions';
import type { GeneratedPlanningContent, ActivityPhase } from '@/types/planning';
import { Save, FileDown, Loader2, Check, Sparkles } from 'lucide-react';

interface PlanningEditorProps {
  planningId: string;
  content: GeneratedPlanningContent;
  onSave?: (content: GeneratedPlanningContent) => void;
}

function contentToHTML(content: GeneratedPlanningContent): string {
  const s = content;
  const lines: string[] = [];

  // Section I
  lines.push(`<div data-bloque="seccion" data-numero="I" data-titulo="Datos de la Planeación" class="bloque-seccion">`);
  lines.push(`<h2>SECCIÓN I — Datos de la Planeación</h2>`);
  lines.push(`<table><tbody>`);
  lines.push(`<tr><td><strong>Docente:</strong></td><td>${s.sectionI.teacherName || ''}</td><td><strong>UAC:</strong></td><td>${s.sectionI.uacName || ''}</td></tr>`);
  lines.push(`<tr><td><strong>Semestre:</strong></td><td>${s.sectionI.semester || ''}</td><td><strong>Componente:</strong></td><td>${s.sectionI.component || ''}</td></tr>`);
  lines.push(`<tr><td><strong>Grupo(s):</strong></td><td>${s.sectionI.groups || ''}</td><td><strong>Horas totales:</strong></td><td>${s.sectionI.totalHours || ''}</td></tr>`);
  lines.push(`<tr><td><strong>Ciclo escolar:</strong></td><td>${s.sectionI.schoolYear || ''}</td><td><strong>Periodo:</strong></td><td>${s.sectionI.applicationPeriod || ''}</td></tr>`);
  lines.push(`<tr><td><strong>Sesiones estimadas:</strong></td><td>${s.sectionI.estimatedSessions || ''}</td><td><strong>Subsistema:</strong></td><td>${s.sectionI.subsystem || ''}</td></tr>`);
  if (s.sectionI.schoolName) {
    lines.push(`<tr><td><strong>Plantel:</strong></td><td>${s.sectionI.schoolName}</td><td><strong>CCT:</strong></td><td>${s.sectionI.cct || ''}</td></tr>`);
  }
  lines.push(`</tbody></table></div>`);

  // Section II
  lines.push(`<div data-bloque="seccion" data-numero="II" data-titulo="Intención Curricular" class="bloque-seccion">`);
  lines.push(`<h2>SECCIÓN II — Intención Curricular</h2>`);
  lines.push(`<div data-bloque="proposito" class="bloque-proposito">`);
  lines.push(`<h3>Propósito formativo</h3><p>${s.sectionII.purpose || ''}</p>`);
  lines.push(`</div>`);
  if (s.sectionII.learningOutcomes?.length) {
    lines.push(`<h3>Aprendizajes de trayectoria</h3><ul>`);
    s.sectionII.learningOutcomes.forEach(lo => lines.push(`<li>${lo}</li>`));
    lines.push(`</ul>`);
  }
  if (s.sectionII.paecConnection) {
    lines.push(`<h3>Conexión PAEC</h3><p>${s.sectionII.paecConnection}</p>`);
  }
  lines.push(`</div>`);

  // Section III
  lines.push(`<div data-bloque="seccion" data-numero="III" data-titulo="Transversalidad Curricular" class="bloque-seccion">`);
  lines.push(`<h2>SECCIÓN III — Transversalidad Curricular</h2>`);
  if (s.sectionIII.fundamentalCurriculum?.length) {
    lines.push(`<h3>Plan Fundamental</h3><ul>`);
    s.sectionIII.fundamentalCurriculum.forEach(fc => lines.push(`<li><strong>${fc.area}:</strong> ${fc.description}</li>`));
    lines.push(`</ul>`);
  }
  if (s.sectionIII.expandedCurriculum?.length) {
    lines.push(`<h3>Plan Ampliado</h3><ul>`);
    s.sectionIII.expandedCurriculum.forEach(ec => lines.push(`<li><strong>${ec.area}:</strong> ${ec.description}</li>`));
    lines.push(`</ul>`);
  }
  lines.push(`</div>`);

  // Section IV
  lines.push(`<div data-bloque="seccion" data-numero="IV" data-titulo="Secuencia Didáctica" class="bloque-seccion">`);
  lines.push(`<h2>SECCIÓN IV — Secuencia Didáctica</h2>`);
  if (s.sectionIV.note) lines.push(`<p><em>${s.sectionIV.note}</em></p>`);
  s.sectionIV.activities?.forEach((act, i) => {
    lines.push(`<div data-bloque="actividad" data-nombre="${act.name || ''}" data-horas="${act.hours || ''}" class="bloque-actividad">`);
    lines.push(`<h3>Actividad Clave ${i + 1}: ${act.name || ''} (${act.hours || ''} hrs)</h3>`);
    if (act.contenidoFormativo) lines.push(`<p><strong>Contenido formativo:</strong> ${act.contenidoFormativo}</p>`);
    if (act.methodology) lines.push(`<p><strong>Metodología:</strong> ${act.methodology}</p>`);
    ['apertura', 'ejecucion', 'conclusion'].forEach(phase => {
      const p = (act as Record<string, any>)[phase];
      if (p) {
        const label = phase === 'apertura' ? 'Apertura' : phase === 'ejecucion' ? 'Desarrollo' : 'Cierre';
        lines.push(`<div data-bloque="${phase}" class="bloque-${phase}">`);
        lines.push(`<h4>${label}</h4>`);
        if (p.activities) lines.push(`<p><strong>Actividades:</strong> ${p.activities}</p>`);
        if (p.processes) lines.push(`<p><strong>Procesos:</strong> ${p.processes}</p>`);
        if (p.materials) lines.push(`<p><strong>Materiales:</strong> ${p.materials}</p>`);
        lines.push(`</div>`);
      }
    });
    lines.push(`</div>`);
  });
  lines.push(`</div>`);

  // Section V
  lines.push(`<div data-bloque="seccion" data-numero="V" data-titulo="Evaluación Formativa" class="bloque-seccion">`);
  lines.push(`<h2>SECCIÓN V — Evaluación Formativa</h2>`);
  if (s.sectionV.evaluationAgreement) {
    lines.push(`<p><strong>Acuerdo de acreditación:</strong> ${s.sectionV.evaluationAgreement}</p>`);
  }
  if (s.sectionV.evaluations?.length) {
    lines.push(`<table><thead><tr><th>Tipo</th><th>Agente</th><th>Momento</th><th>Evidencia</th><th>Instrumento</th><th>%</th></tr></thead><tbody>`);
    s.sectionV.evaluations.forEach(ev => {
      lines.push(`<tr><td>${ev.type}</td><td>${ev.agent}</td><td>${ev.moment}</td><td>${ev.evidence}</td><td>${ev.instrument}</td><td>${ev.percentage}%</td></tr>`);
    });
    lines.push(`</tbody></table>`);
  }
  lines.push(`</div>`);

  // Section VI
  lines.push(`<div data-bloque="seccion" data-numero="VI" data-titulo="Recursos" class="bloque-seccion">`);
  lines.push(`<h2>SECCIÓN VI — Recursos y Materiales</h2>`);
  const resourceLists: [string, string[]][] = [
    ['Materiales del estudiante', s.sectionVI.studentMaterials],
    ['Materiales del docente', s.sectionVI.teacherMaterials],
    ['Recursos digitales', s.sectionVI.digital],
    ['Espacios', s.sectionVI.spaces],
    ['Referencias', s.sectionVI.references],
  ];
  resourceLists.forEach(([title, items]) => {
    if (items?.length) {
      lines.push(`<h3>${title}</h3><ul>`);
      items.forEach(item => lines.push(`<li>${item}</li>`));
      lines.push(`</ul>`);
    }
  });
  lines.push(`</div>`);

  // Section VII
  lines.push(`<div data-bloque="seccion" data-numero="VII" data-titulo="Firmas" class="bloque-seccion">`);
  lines.push(`<h2>SECCIÓN VII — Firmas</h2>`);
  lines.push(`<table><tbody>`);
  lines.push(`<tr><td style="width:33%;text-align:center"><br><br>________________________<br><strong>Docente</strong></td>`);
  lines.push(`<td style="width:33%;text-align:center"><br><br>________________________<br><strong>Director(a)</strong></td>`);
  lines.push(`<td style="width:33%;text-align:center"><br><br>________________________<br><strong>Supervisión</strong></td></tr>`);
  lines.push(`</tbody></table></div>`);

  return lines.join('\n');
}

function htmlToContent(html: string, original: GeneratedPlanningContent): GeneratedPlanningContent {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const getSectionText = (num: string): string => {
    const section = doc.querySelector(`[data-numero="${num}"]`);
    return section?.innerHTML || '';
  };

  const getTextBetween = (html: string, startTag: string, endTag?: string): string => {
    const regex = endTag
      ? new RegExp(`${startTag}([\\s\\S]*?)${endTag}`, 'i')
      : new RegExp(`${startTag}([\\s\\S]*?)</`, 'i');
    const match = html.match(regex);
    return match ? match[1].trim() : '';
  };

  const extractTableRow = (tableHtml: string, row: number, col: number): string => {
    const fragment = parser.parseFromString(tableHtml, 'text/html');
    const rows = fragment.querySelectorAll('tr');
    if (rows[row]) {
      const cells = rows[row].querySelectorAll('td, th');
      if (cells[col]) return cells[col].textContent?.trim() || '';
    }
    return '';
  };

  const secII = getSectionText('II');
  const secIII = getSectionText('III');
  const secIV = getSectionText('IV');
  const secV = getSectionText('V');
  const secVI = getSectionText('VI');

  return {
    ...original,
    sectionII: {
      ...original.sectionII,
      purpose: getTextBetween(secII, 'Propósito formativo', '</h3>') || original.sectionII.purpose,
    },
    sectionIV: {
      ...original.sectionIV,
      note: getTextBetween(secIV, '<p><em>', '</em></p>') || original.sectionIV.note,
    },
    sectionV: {
      ...original.sectionV,
      evaluationAgreement: getTextBetween(secV, 'Acuerdo de acreditación:</strong> ', '</p>') || original.sectionV.evaluationAgreement,
    },
  };
}

export function PlanningEditor({ planningId, content, onSave }: PlanningEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState('');

  const initialHTML = contentToHTML(content);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Comienza a editar tu planeación...' }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      TableExt.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      BloqueApertura,
      BloqueDesarrollo,
      BloqueCierre,
      BloqueRubrica,
      BloqueProposito,
      BloqueActividad,
      BloqueSeccion,
    ],
    content: initialHTML,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[600px] px-8 py-6',
      },
    },
  }, [planningId]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setIsSaving(true);
    setSaved(false);
    try {
      const html = editor.getHTML();
      const updatedContent = htmlToContent(html, content);
      const res = await fetch(`/api/plannings/${planningId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_json: updatedContent }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setSaved(true);
      onSave?.(updatedContent);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [editor, planningId, content, onSave]);

  const handleAICommand = useCallback(async (command: string, selectedText: string) => {
    if (!editor) return;
    setIsGenerating(true);
    setAiStatus(`Ejecutando ${command}...`);
    try {
      const res = await fetch('/api/planeaciones/evaluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planningId,
          command,
          selectedText,
          currentContent: editor.getHTML(),
        }),
      });
      if (!res.ok) throw new Error('Error en comando IA');
      const data = await res.json();
      if (data.html) {
        editor.commands.setContent(data.html);
      } else if (data.text) {
        editor.commands.insertContent(data.text);
      }
      setAiStatus('Comando ejecutado');
      setTimeout(() => setAiStatus(''), 2000);
    } catch (err) {
      console.error('AI command error:', err);
      setAiStatus('Error al ejecutar');
      setTimeout(() => setAiStatus(''), 3000);
    } finally {
      setIsGenerating(false);
    }
  }, [editor, planningId]);

  const handleExportDOCX = useCallback(() => {
    window.open(`/api/docx/${planningId}`, '_blank');
  }, [planningId]);

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-[var(--c-border)] rounded-xl overflow-hidden bg-[var(--c-card-bg)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--c-bg-surface)] border-b border-[var(--c-border)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--c-text)]">Editor de Planeación</span>
          {aiStatus && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isGenerating ? 'bg-violet-500/20 text-violet-300' : saved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-[var(--c-text-muted)]'}`}>
              {isGenerating ? <Loader2 size={10} className="inline animate-spin mr-1" /> : saved ? <Check size={10} className="inline mr-1" /> : null}
              {aiStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportDOCX}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            <FileDown size={14} />
            DOCX
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {isSaving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} onAICommand={handleAICommand} />

      {/* Editor Content */}
      <div className="max-h-[70vh] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-[var(--c-bg-surface)] border-t border-[var(--c-border)] flex items-center justify-between text-xs text-[var(--c-text-muted)]">
        <span>{editor.storage.characterCount?.characters?.() ?? editor.getText().length} caracteres</span>
        <span>Los cambios se guardan en JSON estructurado</span>
      </div>
    </div>
  );
}
