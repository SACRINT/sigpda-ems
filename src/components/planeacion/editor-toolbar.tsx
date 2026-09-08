'use client';

import { type Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Highlighter, Undo2, Redo2, Sparkles,
  Heading1, Heading2, Heading3, Minus, Quote, Table as TableIcon, Link as LinkIcon, Plus, Trash2,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

interface ToolbarProps {
  editor: Editor | null;
  onAICommand?: (command: string, prompt: string) => void;
}

const AI_COMMANDS = [
  { cmd: '/rubrica', label: 'Generar Rúbrica', desc: 'Inserta rúbrica analítica calibrada para la actividad' },
  { cmd: '/adaptar-abp', label: 'Adaptar a ABP', desc: 'Transforma actividad en Aprendizaje Basado en Proyectos' },
  { cmd: '/simplificar-bap', label: 'Simplificar (BAP)', desc: 'Reduce complejidad para barreras de aprendizaje' },
  { cmd: '/ejercicios', label: 'Generar Ejercicios', desc: 'Crea ejercicios prácticos del tema' },
  { cmd: '/contenido', label: 'Insertar Contenido', desc: 'Consulta el programa oficial e inserta contenido temático' },
  { cmd: '/evaluacion', label: 'Instrumento Evaluación', desc: 'Genera instrumento formativo para la actividad' },
  { cmd: '/reflexion', label: 'Preguntas Reflexivas', desc: 'Genera preguntas de reflexión metacognitiva' },
];

export function EditorToolbar({ editor, onAICommand }: ToolbarProps) {
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [aiQuery, setAIQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAIMenu(false);
        setAIQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showAIMenu && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAIMenu]);

  const filteredCommands = AI_COMMANDS.filter(c =>
    c.cmd.toLowerCase().includes(aiQuery.toLowerCase()) ||
    c.label.toLowerCase().includes(aiQuery.toLowerCase())
  );

  const handleAISelect = useCallback((cmd: string) => {
    const selectedText = editor?.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
    );
    onAICommand?.(cmd, selectedText || '');
    setShowAIMenu(false);
    setAIQuery('');
  }, [editor, onAICommand]);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `p-1.5 rounded transition-colors ${
      active
        ? 'bg-indigo-500/20 text-indigo-300'
        : 'text-[var(--c-text-muted)] hover:bg-white/[0.08] hover:text-[var(--c-text)]'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--c-border)] bg-[var(--c-bg-surface)] px-3 py-1.5 sticky top-0 z-10">
      {/* Text formatting */}
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="Negrita">
        <Bold size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="Cursiva">
        <Italic size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))} title="Subrayado">
        <UnderlineIcon size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))} title="Tachado">
        <Strikethrough size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={btnClass(editor.isActive('highlight'))} title="Resaltar">
        <Highlighter size={16} />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Headings */}
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive('heading', { level: 1 }))} title="Título 1">
        <Heading1 size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="Título 2">
        <Heading2 size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive('heading', { level: 3 }))} title="Título 3">
        <Heading3 size={16} />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Lists */}
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Lista con viñetas">
        <List size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Lista numerada">
        <ListOrdered size={16} />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Alignment */}
      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))} title="Alinear izquierda">
        <AlignLeft size={16} />
      </button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))} title="Centrar">
        <AlignCenter size={16} />
      </button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btnClass(editor.isActive({ textAlign: 'right' }))} title="Alinear derecha">
        <AlignRight size={16} />
      </button>
      <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={btnClass(editor.isActive({ textAlign: 'justify' }))} title="Justificar">
        <AlignJustify size={16} />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Insert */}
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="Cita">
        <Quote size={16} />
      </button>
      <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btnClass(false)} title="Línea horizontal">
        <Minus size={16} />
      </button>
      <button
        onClick={() => {
          const url = window.prompt('URL del enlace:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        className={btnClass(editor.isActive('link'))}
        title="Enlace"
      >
        <LinkIcon size={16} />
      </button>

      {/* Table buttons */}
      <button
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className={btnClass(editor.isActive('table'))}
        title="Insertar tabla"
      >
        <TableIcon size={16} />
      </button>
      {editor.isActive('table') && (
        <>
          <button onClick={() => editor.chain().focus().addRowAfter().run()} className={btnClass(false)} title="Agregar fila">
            <Plus size={14} /> Fila
          </button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()} className={btnClass(false)} title="Agregar columna">
            <Plus size={14} /> Col
          </button>
          <button onClick={() => editor.chain().focus().deleteRow().run()} className={btnClass(false)} title="Eliminar fila">
            <Trash2 size={14} /> Fila
          </button>
          <button onClick={() => editor.chain().focus().deleteTable().run()} className={btnClass(false)} title="Eliminar tabla">
            <Trash2 size={14} /> Tabla
          </button>
        </>
      )}

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Undo / Redo */}
      <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={`${btnClass(false)} disabled:opacity-30`} title="Deshacer">
        <Undo2 size={16} />
      </button>
      <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={`${btnClass(false)} disabled:opacity-30`} title="Rehacer">
        <Redo2 size={16} />
      </button>

      <div className="flex-1" />

      {/* AI Command Button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowAIMenu(!showAIMenu)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-medium hover:from-violet-700 hover:to-blue-700 transition-all shadow-sm"
        >
          <Sparkles size={14} />
          Comando IA
        </button>

        {showAIMenu && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-[var(--c-card-bg)] rounded-xl shadow-2xl border border-[var(--c-border-2)] z-50 overflow-hidden">
            <div className="p-2 border-b border-[var(--c-border)]">
              <input
                ref={inputRef}
                type="text"
                value={aiQuery}
                onChange={(e) => setAIQuery(e.target.value)}
                placeholder="Escribe un comando / o busca..."
                className="w-full px-3 py-2 text-sm border border-[var(--c-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredCommands.length > 0) {
                    handleAISelect(filteredCommands[0].cmd);
                  }
                  if (e.key === 'Escape') {
                    setShowAIMenu(false);
                    setAIQuery('');
                  }
                }}
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredCommands.length === 0 ? (
                <div className="p-3 text-sm text-[var(--c-text-muted)] text-center">Sin resultados</div>
              ) : (
                filteredCommands.map((cmd) => (
                  <button
                    key={cmd.cmd}
                    onClick={() => handleAISelect(cmd.cmd)}
                    className="w-full px-3 py-2.5 text-left hover:bg-violet-500/15 transition-colors flex flex-col gap-0.5"
                  >
                    <span className="text-sm font-medium text-[var(--c-text)] flex items-center gap-2">
                      <span className="text-violet-300 font-mono text-xs bg-violet-500/20 px-1.5 py-0.5 rounded">{cmd.cmd}</span>
                      {cmd.label}
                    </span>
                    <span className="text-xs text-[var(--c-text-muted)]">{cmd.desc}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
