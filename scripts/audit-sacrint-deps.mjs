import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Auditor estático de dependencias y capas para el motor SACRINT y editorial.
 * Verifica 3 invariantes arquitectónicas sin dependencias externas:
 *  1. Cero dependencias circulares entre módulos.
 *  2. DAG estricto de capas (Capa N solo importa de Capa <= N, nunca > N).
 *  3. Cero imports internos a fachadas/barrels desde módulos extraídos en subdirectorios.
 */

export const SACRINT_LAYER_ORDER = [
  'types',       // Capa 0: tipos compartidos y editorial/fitter
  'text',        // Capa 1: normalización, 6-gramas, guardias de objetivo/actividad
  'distiller',   // Capa 2: destilación de sesión y fórmulas
  'diagrams',    // Capa 3: modelado de diagramas y registro
  'builders',    // Capa 4: presupuesto, integridad, deck-builder, infographic-builder
  'renderers',   // Capa 5: svg/*, pptx/*, slide-renderer, infographic-renderer, rasterizer
  'facade',      // Capa 6: fachadas temporales de retrocompatibilidad (spec.ts, content-distiller.ts, diagrams.ts, etc.)
];

const FACADE_BASENAMES = new Set([
  'src/lib/visual-engine/sacrint/spec.ts',
  'src/lib/visual-engine/sacrint/content-distiller.ts',
  'src/lib/visual-engine/sacrint/diagrams.ts',
  'src/lib/visual-engine/sacrint/sacrint-pptx-generator.ts',
  'src/lib/visual-engine/sacrint/svg-primitives.ts',
  'src/lib/editorial/pedagogical-text-fitter.ts',
]);

export function classifyLayer(relPosixPath) {
  if (
    relPosixPath === 'src/lib/visual-engine/sacrint/types.ts' ||
    relPosixPath.startsWith('src/lib/editorial/fitter/') ||
    relPosixPath === 'src/lib/visual-engine/sacrint/palette.ts' ||
    relPosixPath === 'src/lib/visual-engine/sacrint/discipline-packs.ts' ||
    relPosixPath === 'src/lib/visual-engine/sacrint/topic-classifier.ts'
  ) {
    return 0;
  }
  if (relPosixPath.startsWith('src/lib/visual-engine/sacrint/text/')) return 1;
  if (relPosixPath.startsWith('src/lib/visual-engine/sacrint/distiller/')) return 2;
  if (relPosixPath.startsWith('src/lib/visual-engine/sacrint/diagrams/')) return 3;
  if (relPosixPath.startsWith('src/lib/visual-engine/sacrint/builders/')) return 4;
  if (
    relPosixPath.startsWith('src/lib/visual-engine/sacrint/svg/') ||
    relPosixPath.startsWith('src/lib/visual-engine/sacrint/pptx/') ||
    relPosixPath === 'src/lib/visual-engine/sacrint/slide-renderer.ts' ||
    relPosixPath === 'src/lib/visual-engine/sacrint/infographic-renderer.ts' ||
    relPosixPath === 'src/lib/visual-engine/sacrint/sacrint-rasterizer.ts'
  ) {
    return 5;
  }
  if (FACADE_BASENAMES.has(relPosixPath)) return 6;
  return -1;
}

export function isExtractedSubmodule(relPosixPath) {
  return (
    relPosixPath === 'src/lib/visual-engine/sacrint/types.ts' ||
    relPosixPath.startsWith('src/lib/visual-engine/sacrint/text/') ||
    relPosixPath.startsWith('src/lib/visual-engine/sacrint/distiller/') ||
    relPosixPath.startsWith('src/lib/visual-engine/sacrint/diagrams/') ||
    relPosixPath.startsWith('src/lib/visual-engine/sacrint/builders/') ||
    relPosixPath.startsWith('src/lib/visual-engine/sacrint/svg/') ||
    relPosixPath.startsWith('src/lib/visual-engine/sacrint/pptx/') ||
    relPosixPath.startsWith('src/lib/editorial/fitter/')
  );
}

export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

export function extractImportSpecifiers(source) {
  const clean = stripComments(source);
  const specifiers = [];
  const re = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    if (m[1]) specifiers.push(m[1]);
  }
  return specifiers;
}

function collectTsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'fixtures' || entry.name === 'node_modules') continue;
      results.push(...collectTsFiles(full));
    } else if (entry.isFile() && /\.(?:ts|tsx|mts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

function resolveImportPath(rootDir, fromAbsPath, specifier) {
  let candidateBase = null;
  if (specifier.startsWith('@/')) {
    candidateBase = path.join(rootDir, 'src', specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    candidateBase = path.resolve(path.dirname(fromAbsPath), specifier);
  } else {
    return null;
  }

  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    `${candidateBase}.mts`,
    path.join(candidateBase, 'index.ts'),
    path.join(candidateBase, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.relative(rootDir, c).split(path.sep).join('/');
    }
  }
  return null;
}

export function findCycles(adjacency) {
  const cycles = [];
  const state = new Map(); // 0=unvisited, 1=visiting, 2=done
  const stack = [];
  const seenKeys = new Set();

  const dfs = (node) => {
    state.set(node, 1);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      if (!adjacency.has(next)) continue;
      const st = state.get(next) ?? 0;
      if (st === 1) {
        const idx = stack.indexOf(next);
        const cycle = [...stack.slice(idx), next];
        const key = [...cycle].slice(0, -1).sort().join('|');
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          cycles.push(cycle);
        }
      } else if (st === 0) {
        dfs(next);
      }
    }
    stack.pop();
    state.set(node, 2);
  };

  for (const node of [...adjacency.keys()].sort()) {
    if ((state.get(node) ?? 0) === 0) dfs(node);
  }
  return cycles;
}

export function auditSacrintDependencies(rootDir, options = {}) {
  const targetDirs = options.targetDirs ?? [
    path.join(rootDir, 'src', 'lib', 'visual-engine', 'sacrint'),
    path.join(rootDir, 'src', 'lib', 'editorial'),
  ];
  const files = targetDirs.flatMap((d) => collectTsFiles(d));
  const adjacency = new Map();
  const layerViolations = [];
  const barrelViolations = [];

  for (const abs of files) {
    const rel = path.relative(rootDir, abs).split(path.sep).join('/');
    const src = fs.readFileSync(abs, 'utf8');
    const specs = extractImportSpecifiers(src);
    const deps = [];
    for (const sp of specs) {
      const resolved = resolveImportPath(rootDir, abs, sp);
      if (resolved) deps.push(resolved);
    }
    adjacency.set(rel, deps);
  }

  for (const [from, deps] of adjacency.entries()) {
    const fromLayer = classifyLayer(from);
    const fromExtracted = isExtractedSubmodule(from);
    for (const to of deps) {
      const toLayer = classifyLayer(to);
      if (fromExtracted && FACADE_BASENAMES.has(to)) {
        barrelViolations.push({ from, to, reason: 'Módulo extraído no debe importar desde una fachada/barrel' });
      }
      if (fromLayer >= 0 && toLayer >= 0 && fromLayer < 6 && toLayer < 6 && toLayer > fromLayer) {
        layerViolations.push({
          from,
          to,
          fromLayer: SACRINT_LAYER_ORDER[fromLayer],
          toLayer: SACRINT_LAYER_ORDER[toLayer],
        });
      }
    }
  }

  const cycles = findCycles(adjacency);
  return {
    fileCount: adjacency.size,
    cycles,
    layerViolations,
    barrelViolations,
    passed: cycles.length === 0 && layerViolations.length === 0 && barrelViolations.length === 0,
  };
}

const isEntrypoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntrypoint) {
  const rootDir = process.cwd();
  const report = auditSacrintDependencies(rootDir);
  console.log(
    `[audit-sacrint-deps] files=${report.fileCount} | cycles=${report.cycles.length} | layerViolations=${report.layerViolations.length} | barrelViolations=${report.barrelViolations.length}`
  );
  if (report.cycles.length > 0) {
    console.error('CICLOS DETECTADOS:');
    for (const c of report.cycles) console.error('  -', c.join(' -> '));
  }
  if (report.layerViolations.length > 0) {
    console.error('VIOLACIONES DE CAPA:');
    for (const v of report.layerViolations) {
      console.error(`  - ${v.from} (${v.fromLayer}) -> ${v.to} (${v.toLayer})`);
    }
  }
  if (report.barrelViolations.length > 0) {
    console.error('IMPORTS INTERNOS POR BARREL:');
    for (const b of report.barrelViolations) {
      console.error(`  - ${b.from} -> ${b.to} (${b.reason})`);
    }
  }
  process.exit(report.passed ? 0 : 1);
}
