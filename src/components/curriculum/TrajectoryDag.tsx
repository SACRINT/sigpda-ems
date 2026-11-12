'use client';

import { useMemo, useState } from 'react';
import type { CurriculumTrajectory, TrajectoryNode } from '@/lib/curriculum/trajectory-types';
import { validateCurriculumTrajectory } from '@/lib/curriculum/trajectory-validator';

export interface CatalogProgramRef {
  id: string;
  uac_name: string;
  semester: number;
  component: string;
  total_hours: number;
}

interface TrajectoryDagProps {
  trajectory: CurriculumTrajectory;
  programs?: CatalogProgramRef[];
  onOpenProgram?: (programId: string) => void;
}

const SEMESTER_COLORS: Record<number, string> = {
  3: '#38bdf8',
  4: '#34d399',
  5: '#a78bfa',
  6: '#f59e0b',
};

const NODE_WIDTH = 236;
const NODE_HEIGHT = 132;
const COL_GAP = 286;
const ROW_GAP = 178;
const MARGIN_X = 28;
const MARGIN_Y = 56;

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function wrapText(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.length > 0) {
    const joined = lines.join(' ');
    if (joined.length < value.length) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:]$/, '')}…`;
    }
  }
  return lines;
}

function edgePath(source: { x: number; y: number }, target: { x: number; y: number }): string {
  if (source.x === target.x) {
    const startX = source.x + NODE_WIDTH / 2;
    const startY = source.y + NODE_HEIGHT;
    const endX = target.x + NODE_WIDTH / 2;
    const endY = target.y;
    return `M ${startX} ${startY} C ${startX} ${startY + 34}, ${endX} ${endY - 34}, ${endX} ${endY}`;
  }

  const startX = source.x + NODE_WIDTH;
  const startY = source.y + NODE_HEIGHT / 2;
  const endX = target.x;
  const endY = target.y + NODE_HEIGHT / 2;
  const midX = (startX + endX) / 2;
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

export default function TrajectoryDag({ trajectory, programs = [], onOpenProgram }: TrajectoryDagProps) {
  const [selectedId, setSelectedId] = useState(trajectory.nodes[0]?.id ?? '');

  const report = useMemo(() => validateCurriculumTrajectory(trajectory), [trajectory]);

  const layout = useMemo(() => {
    const nodes = [...trajectory.nodes].sort(
      (a, b) => a.semester - b.semester || a.order - b.order
    );
    const positions = new Map<string, { x: number; y: number; node: TrajectoryNode }>();

    for (const node of nodes) {
      positions.set(node.id, {
        x: MARGIN_X + (node.semester - 3) * COL_GAP,
        y: MARGIN_Y + (node.order - 1) * ROW_GAP,
        node,
      });
    }

    const semesters = [...new Set(nodes.map((node) => node.semester))].sort((a, b) => a - b);
    const width = MARGIN_X * 2 + Math.max(1, semesters.length - 1) * COL_GAP + NODE_WIDTH;
    const height = MARGIN_Y * 2 + ROW_GAP + NODE_HEIGHT;

    return { positions, semesters, width, height };
  }, [trajectory.nodes]);

  const selected = layout.positions.get(selectedId)?.node ?? trajectory.nodes[0];
  const selectedProgram = selected
    ? programs.find((program) => normalizeName(program.uac_name) === normalizeName(selected.uacName))
    : undefined;

  if (!selected) {
    return null;
  }

  const color = SEMESTER_COLORS[selected.semester] ?? '#38bdf8';
  const prerequisites = selected.prerequisites
    .map((id) => trajectory.nodes.find((node) => node.id === id))
    .filter((node): node is TrajectoryNode => Boolean(node));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(30,27,75,0.55), rgba(15,23,42,0.85))',
          border: '1px solid rgba(129,140,248,0.25)',
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#c7d2fe',
                  background: 'rgba(99,102,241,0.18)',
                  border: '1px solid rgba(129,140,248,0.35)',
                  borderRadius: 999,
                  padding: '3px 10px',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Trayectoria formativa
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: report.ok ? '#6ee7b7' : '#fca5a5',
                  background: report.ok ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                  border: `1px solid ${report.ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
                  borderRadius: 999,
                  padding: '3px 10px',
                }}
              >
                {report.ok ? 'DAG validado · sin ciclos' : `${report.errors.length} errores de validación`}
              </span>
            </div>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>{trajectory.name}</h3>
            <p style={{ margin: '4px 0 0', color: 'rgba(226,232,240,0.62)', fontSize: 12 }}>
              {trajectory.curriculumName} · {trajectory.generation} · {trajectory.agreement}
            </p>
            <p style={{ margin: '6px 0 0', color: 'rgba(148,163,184,0.55)', fontSize: 11 }}>
              La vista DAG muestra la trayectoria piloto completa; los filtros de catálogo aplican a Malla y Tabla.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {[
              ['UAC', trajectory.totalUacs],
              ['Actividades', report.stats.activities],
              ['Horas', trajectory.totalHours],
              ['Hitos', report.stats.projectMilestones],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  minWidth: 74,
                  background: 'rgba(15,23,42,0.7)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  textAlign: 'center',
                }}
              >
                <div style={{ color: '#f8fafc', fontSize: 18, fontWeight: 800 }}>{value}</div>
                <div style={{ color: 'rgba(226,232,240,0.5)', fontSize: 10, textTransform: 'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(15,23,42,0.68)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 14,
          overflowX: 'auto',
        }}
      >
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={`Diagrama de prerrequisitos de ${trajectory.name}`}
          style={{ minWidth: 1080, width: '100%', height: 'auto', display: 'block' }}
        >
          <defs>
            {layout.semesters.map((semester) => (
              <marker
                key={semester}
                id={`dag-arrow-${semester}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={SEMESTER_COLORS[semester] ?? '#94a3b8'} />
              </marker>
            ))}
          </defs>

          {layout.semesters.map((semester) => {
            const x = MARGIN_X + (semester - 3) * COL_GAP;
            const semesterNodes = trajectory.nodes.filter((node) => node.semester === semester);
            const hours = semesterNodes.reduce((sum, node) => sum + node.totalHours, 0);
            return (
              <g key={semester}>
                <text x={x} y={20} fill={SEMESTER_COLORS[semester] ?? '#94a3b8'} fontSize={13} fontWeight={800}>
                  {semester}.º semestre
                </text>
                <text x={x} y={36} fill="rgba(226,232,240,0.45)" fontSize={10}>
                  {semesterNodes.length} UAC · {hours} h
                </text>
              </g>
            );
          })}

          {trajectory.nodes.flatMap((node) => {
            const target = layout.positions.get(node.id);
            if (!target) return [];
            return node.prerequisites.flatMap((prerequisiteId) => {
              const source = layout.positions.get(prerequisiteId);
              if (!source) return [];
              return [
                <path
                  key={`${prerequisiteId}-${node.id}`}
                  d={edgePath(source, target)}
                  fill="none"
                  stroke={SEMESTER_COLORS[source.node.semester] ?? '#94a3b8'}
                  strokeWidth={1.7}
                  strokeOpacity={0.55}
                  markerEnd={`url(#dag-arrow-${source.node.semester})`}
                />,
              ];
            });
          })}

          {[...layout.positions.values()].map(({ node, x, y }) => {
            const nodeColor = SEMESTER_COLORS[node.semester] ?? '#38bdf8';
            const active = node.id === selected.id;
            const titleLines = wrapText(node.uacName, 34, 3);
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${node.id}: ${node.uacName}`}
                onClick={() => setSelectedId(node.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedId(node.id);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={12}
                  fill={active ? 'rgba(30,41,59,0.98)' : 'rgba(30,41,59,0.72)'}
                  stroke={active ? nodeColor : 'rgba(148,163,184,0.22)'}
                  strokeWidth={active ? 2 : 1}
                />
                <rect x={x} y={y} width={NODE_WIDTH} height={4} rx={2} fill={nodeColor} />
                <text x={x + 14} y={y + 24} fill={nodeColor} fontSize={11} fontWeight={800}>
                  {node.id}
                </text>
                <text x={x + NODE_WIDTH - 14} y={y + 24} textAnchor="end" fill="rgba(226,232,240,0.55)" fontSize={10}>
                  {node.semester}.º · {node.order}
                </text>
                {titleLines.map((line, index) => (
                  <text
                    key={line + index}
                    x={x + 14}
                    y={y + 46 + index * 14}
                    fill="#f8fafc"
                    fontSize={11.5}
                    fontWeight={600}
                  >
                    {line}
                  </text>
                ))}
                <text x={x + 14} y={y + 104} fill="rgba(226,232,240,0.55)" fontSize={10}>
                  {node.keyActivities.length} act. clave · {node.totalHours} h
                </text>
                <text x={x + 14} y={y + 119} fill={nodeColor} fontSize={9.5}>
                  {wrapText(node.projectMilestone, 38, 1)[0]}
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, paddingLeft: 4 }}>
          {layout.semesters.map((semester) => (
            <div key={semester} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(226,232,240,0.6)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: SEMESTER_COLORS[semester] }} />
              {semester}.º semestre
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(226,232,240,0.6)' }}>
            <span style={{ width: 18, height: 2, background: '#94a3b8' }} />
            prerrequisito
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        <div
          style={{
            background: 'rgba(15,23,42,0.68)',
            border: `1px solid ${color}55`,
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color,
                background: `${color}18`,
                border: `1px solid ${color}44`,
                borderRadius: 999,
                padding: '3px 9px',
              }}
            >
              {selected.id}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.55)' }}>
              {selected.semester}.º semestre · {selected.totalHours} h · {selected.blocks} bloques
            </span>
          </div>
          <h4 style={{ margin: '0 0 10px', color: '#f8fafc', fontSize: 16, lineHeight: 1.35 }}>{selected.uacName}</h4>
          <p style={{ margin: '0 0 14px', color: 'rgba(226,232,240,0.72)', fontSize: 12, lineHeight: 1.55 }}>
            {selected.learningOutcome}
          </p>

          <div style={{ display: 'grid', gap: 10, fontSize: 12 }}>
            <div>
              <div style={{ color: 'rgba(226,232,240,0.45)', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>
                Hito del proyecto integrador
              </div>
              <div style={{ color: '#fcd34d' }}>{selected.projectMilestone}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(226,232,240,0.45)', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>
                Prerrequisitos
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {prerequisites.length === 0 ? (
                  <span style={{ color: 'rgba(226,232,240,0.55)' }}>Sin prerrequisitos · UAC de entrada</span>
                ) : (
                  prerequisites.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedId(node.id)}
                      style={{
                        background: 'rgba(99,102,241,0.12)',
                        border: '1px solid rgba(129,140,248,0.35)',
                        borderRadius: 999,
                        color: '#c7d2fe',
                        padding: '3px 9px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      {node.id}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div>
              <div style={{ color: 'rgba(226,232,240,0.45)', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>
                Ocupaciones SINCO / SCIAN
              </div>
              <div style={{ color: 'rgba(226,232,240,0.68)', lineHeight: 1.5 }}>
                {[...selected.sinco, ...selected.scian].join(' · ')}
              </div>
            </div>
          </div>

          {selectedProgram && onOpenProgram && (
            <button
              type="button"
              className="btn-sm btn-primary"
              onClick={() => onOpenProgram(selectedProgram.id)}
              style={{ marginTop: 16 }}
            >
              Ver programa oficial
            </button>
          )}
        </div>

        <div
          style={{
            background: 'rgba(15,23,42,0.68)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            Actividades clave y contenidos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selected.keyActivities.map((activity, index) => (
              <div
                key={activity.id}
                style={{
                  background: 'rgba(30,41,59,0.55)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>
                    {index + 1}. {activity.name}
                  </span>
                  <span style={{ color: color, fontSize: 11, whiteSpace: 'nowrap' }}>{activity.hours} h</span>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {activity.contents.map((content) => (
                    <span
                      key={content}
                      style={{
                        background: 'rgba(148,163,184,0.1)',
                        border: '1px solid rgba(148,163,184,0.18)',
                        borderRadius: 6,
                        color: 'rgba(226,232,240,0.65)',
                        padding: '2px 6px',
                        fontSize: 10,
                      }}
                    >
                      {content}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
