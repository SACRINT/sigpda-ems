# QA semántico PAEC / PMC — especificación consolidada (v2)

- Fecha: 2026-11-24 (v2: incorpora los 8 ajustes de OpenCode + 2 precisiones de Antigravity + 3 precisiones nuevas verificadas).
- Contexto: `HEAD` = `2f076b92` (refactor SACRINT cerrado, árbol limpio).
- Estado: **ACORDADO**. OpenCode especifica y audita; **Antigravity implementa** (código, tests, migraciones).
- Regla de oro: **no mezclar fixes funcionales con refactor de monolitos**. Cada fase con `tsc`, `eslint --max-warnings=0`, `vitest` y validación en BD.

---

## 0. Decisiones acordadas (cierre de preguntas)

- **Q2 — Datos históricos: SÍ se remedian**, en **Fase C.5**, con script **idempotente y transaccional** (dry-run primero, backup/rollback, aprobación explícita). Alcance:
  1. ~~**6 filas paridad rota** en `fase3_plan_operativo_a`~~ *(Falsado contra BD en Fase A/C.5: en MCCEMS, `Conciencia Histórica II` es 5.° semestre = impar → Semestre A válido; **0 violaciones reales de paridad en PAEC**, ver §11.2)*.
  2. **2 metas de reprobación invertidas**: Moisés Sáenz Garza `ant 0 → meta 7.5`; Héroes de la Patria `ant 11.6 → meta 11.9` (más `et_meta` invertida en Supervisión Escolar 004).
  3. **Categorías mixtas** en los 3 PMC (códigos `1/2/3` + llaves legacy + nombres).
- **Q3 — Exportación: SÍ.** `HTTP 422` **solo en FAIL duro**; los **WARN** se registran en log y **permiten la descarga** con aviso. No se bloquea por WARN.

---

## 1. Hallazgos verificados (evidencia)

| Hallazgo | Evidencia | Estado |
|---|---|---|
| FODA sintetizado se descarta | `api/pmc/[id]/generate-step/route.ts:476` guarda `currentFoda` cuando `fodaNeedsSynthesis`; usa `effectiveFoda` solo en prompt (352/368). | CONFIRMADO |
| `reprobacion_meta` invertida | BD: Héroes `11.6 → 11.9`; Moisés `0 → 7.5`. Fórmula `max(0,100−aprobacion_meta)` en `PmcWizardClient.tsx:1682/1707` y `pmc-indicator-calculator.ts:114-116`. | CONFIRMADO |
| Paridad en Semestre A (`Conciencia Histórica II`) | BD (`fase2_mapeo`): `Conciencia Histórica II` es **5.° semestre (impar)** en ambos PAEC → paridad válida en Sem A (**0 violaciones reales**, ver §11.2). | FALSADO (OK EN BD) |
| `paec-context` devuelve 1 fila y sin semestre | `matchOperationalActivity` retorna en la 1.ª coincidencia (`paec-context.ts:143`); `planRows` concatena fase2+A+B sin filtro (258-262). `matchCurricularMapping` ya filtra por semestre (163/171). | CONFIRMADO |
| PMC-C8 laxo | `pmc-quality-gate.ts:455` `creaaCompliant >= 1` da puntaje completo. | CONFIRMADO |
| Taxonomía sucia | BD: 8 etiquetas en Héroes; Moisés mezcla `1/2` + nombres; Supervisión solo `1/2/3`. | CONFIRMADO |
| `pmc_projects` sin `quality_audit` | Solo `paec_projects` tiene la columna. | CONFIRMADO |
| `staffData.slice(0,35)` | `prompts/pmc-prompts.ts:299`. | CONFIRMADO |
| `VERB` del borrador marcaba ~85% | En el borrador era **WARN** (no FAIL), pero el léxico debe aceptar nominalizaciones. | MATIZADO |

---

## 2. Modelo de severidad (FAIL vs WARN)

- **FAIL duro (CI rojo + export HTTP 422):** duplicados fuera de Semana 16, paridad A/B rota, inversión matemática direccional, placeholders, campos obligatorios vacíos, categoría no canónica, `progression` con nomenclatura prohibida (en generación nueva), FODA cruzado ausente (en generación nueva).
- **WARN (no bloquea; se registra y avisa):** verbo/nominalización, near-duplicados, longitud/brevedad, `progression` cruda histórica, near-copia actividad↔progresión, faltantes blandos (fórmula/fuente, bullets FODA, periodo).

---

## 3. QA semántico PAEC — umbrales

| Métrica | Regla | Nivel |
|---|---|---|
| Cobertura semanal | semanas 1–16 presentes | FAIL si <16; WARN si 14–15 |
| 8 columnas | `phase, activity, uac, progression, strategy, week, responsibles, evaluationInstrument` no vacías | FAIL si <95 % |
| Placeholders/genéricos | `sin registro\|lorem\|tbd\|n/a\|pendiente de definir` | FAIL si >0 |
| Brevedad actividad | 6–45 palabras; promedio ≤30 | FAIL si <6w; WARN si >45w o prom >30 |
| Verbo o nominalización operativa | verbo conjugado/infinitivo **o** nominalización (diseño, aplicación, ejecución, elaboración, medición, construcción, modelado, diagnóstico, instalación, evaluación, monitoreo, recolección, análisis, campaña, taller) | WARN |
| Duplicados exactos | por `activity` normalizada, **ignorando Semana 16** | FAIL si >0 |
| Near-duplicados | overlap 6-gramas ≥0.80 (sin Sem 16) | WARN |
| Copia de progresión | overlap actividad↔`progression` ≥0.70 | WARN |
| Progresión cruda | `progression` >400 chars (histórico); nueva generación destila ≤280 | WARN histórico / FAIL en generación nueva |
| Paridad semestre | Sem A = semestres impares (I/III/V); Sem B = pares (II/IV/VI), **derivado del mapeo/catálogo** | FAIL |
| Nomenclatura MCCEMS | data-driven por `semester` + `component` + **ciclo escolar** (ver §5.1) | WARN histórico / FAIL en generación nueva |
| Cobertura UAC | UAC del plan ⊆ mapeo; mapeo sin actividad | WARN |
| Cierre Sem 16 | contiene cierre/feria/entrega/evaluación/difusión | WARN |

## 4. QA semántico PMC — umbrales

| Métrica | Regla | Nivel |
|---|---|---|
| Identificación | `school_name`, `school_cct` | FAIL si faltan |
| Indicadores | validar `_calc` **si existe**; **siempre** validar campos canónicos (`aprobacion_ant, reprobacion_ant, abandono_ant, et_ant, matricula`); FAIL solo si no hay ningún indicador | FAIL si 0 indicadores; WARN faltante individual |
| Invariantes direccionales | `aprobacion_meta ≥ aprobacion_ant`, `reprobacion_meta ≤ reprobacion_ant`, `abandono_meta ≤ abandono_ant`, `et_meta ≥ et_ant` | FAIL |
| Coherencia dimensional | `|reprobacion_meta − (100 − aprobacion_meta − bajas)| ≤ 0.6` (§5.3) | WARN |
| Diagnóstico | `presentacion, contexto, priorizacion, analisis_indicadores, sintesis_foda` ≥200 chars, sin placeholders | FAIL placeholder; WARN ausente/corto |
| FODA cuadrantes | cada cuadrante ≥3 bullets | WARN |
| FODA cruzado | `FO, DO, FA, DA` presentes | WARN histórico / FAIL en generación nueva |
| Categoría canónica | exactamente una de las 3 oficiales (§5.2) | FAIL |
| Metas institucionales | `meta` con número, `entregable`, `periodo` | WARN |
| Metas personales | `cargo`, `nombre`, `meta_individual` con número, `entregable`; sin duplicados | FAIL duplicado; WARN faltantes |
| CREAA | ratio ≥85 % + 0 invertidas + 0 duplicados | FAIL si <85 % (Fase B) |
| Tamaño plan | `plan_accion` >150 000 chars | WARN |

---

## 5. Precisiones normativas (verificadas en código)

### 5.1 MCCEMS — nomenclatura **depende del ciclo escolar**
Fuente: `lib/prompts/paec-prompts.ts`.
- **Formación Laboral** (`competencias_laborales`, semestres 2–6): **"Actividad Clave [N]" + "Saberes"**. Prohibido "Propósito" y "Progresión".
- **Fundamental 1.º–4.º:** **"Propósito Formativo [N]"**. Prohibido "Progresión".
- **Fundamental 5.º–6.º:** **"Progresión de Aprendizaje [N]"** (solo ciclos **antes** de 2027-2028).
- **Ciclo 2027-2028 y posteriores:** **todos** los semestres fundamentales usan **"Propósito Formativo"** (el 5.º–6.º ya no usa "Progresión").
- **Conclusión:** el guard debe ser **data-driven por `ciclo_escolar` + `semester` + `component`**, no una regla fija 1–4/5–6.
  El label de línea 176 (`Ámbitos de formación socioemocional…`) es un **tema**, no una categoría.

### 5.2 Categorías PMC — 3 canónicas + bug del normalizador
Fuente: `lib/constants/pmc-categorias.ts`.
- Canónicas: `Desarrollo académico y aprendizaje` (1), `Gestión y administración escolar` (2), `Desarrollo socioemocional y prevención de la violencia en la escuela` (3).
- `normalizePmcCategoria()` existe, **pero no maneja códigos numéricos**: `'1'` cae por fallback a Cat 1 (correcto por accidente); **`'2'` y `'3'` caen también a Cat 1 (BUG real)**. `'practica_docente'` cae a Cat 1 (implícito); `'convivencia_paec'` → Cat 3 (por `convivencia`).
- **Acción:** añadir mapeo explícito `1→Cat1, 2→Cat2, 3→Cat3`, `practica_docente→Cat1`, `convivencia_paec→Cat3`, y usar el **tema** como desempate. Aplicarlo al guardar `plan_accion` y en el QA (FAIL si la categoría cruda no es canónica).

### 5.3 Reprobación — fórmula correcta (validada con F11)
Fuente: `lib/f11-layout-calculator.ts:523-535`.
- `aprobados + reprobados + bajas = totalAlumnos`; **todos** los porcentajes usan el mismo denominador (`totalAlumnos`).
- Por tanto: `reprobacion_meta = min(reprobacion_ant, max(0, 100 − aprobacion_meta − bajas_pct))`.
- Si no hay `bajas_pct`: `min(reprobacion_ant, max(0, 100 − aprobacion_meta))`.
- Caso `reprobacion_ant = 0` ⇒ meta **0** (nunca subir la reprobación).
- Unificar texto con `correctInvertedMetricGoals` (`lib/pmc/plan-element-normalizer.ts`) y actualizar los tests que hoy codifican `100 − aprobacion` (`pmc-indicator-parity.test.ts:172`, `f11-layout-calculator.test.ts`).

### 5.4 Cortes — no son semanas fijas
Fuente: `lib/curricular-blocks.ts` (y REGLA INMORTAL de sesiones por bloque).
- El mapeo **progresión→Corte 1/2/3** es **por UAC** (reparto de progresiones), no `1–5/6–11/12–16` fijo.
- **Acción:** para `operationalActivities[]` por corte, usar el SSoT de `curricular-blocks.ts` / `resolveCurricularBlocks`; no hardcodear rangos de semana.

---

## 6. Script de referencia v2

Ruta: `scripts/qa-paec-pmc.ts` (solo lecturas; sale con código 1 si hay `fails` duros).

```ts
import { sql } from '../src/lib/db/client';
import { PMC_NOMBRES_CATEGORIAS, normalizePmcCategoria } from '../src/lib/constants/pmc-categorias';

const PLACEHOLDER = /\b(sin registro|lorem|ipsum|tbd|n\/a|pendiente de definir|por definir)\b/i;
const CLOSURE = /cierre|feria|entrega|evaluaci[oó]n|difusi[oó]n|clausura|exposici[oó]n|socializaci[oó]n/i;
const ACTION = /\b(dise[nñ]|aplica|aplicaci[oó]n|recolecta|recolecci[oó]n|elabora|elaboraci[oó]n|mide|medici[oó]n|analiza|an[aá]lisis|construye|construcci[oó]n|integra|integraci[oó]n|gestiona|gesti[oó]n|organiza|organizaci[oó]n|redacta|redacci[oó]n|realiza|ejecuta|ejecuci[oó]n|implementa|implementaci[oó]n|eval[uú]a|evaluaci[oó]n|simula|simulaci[oó]n|digitaliza|digitalizaci[oó]n|calcula|c[aá]lculo|diagnostica|diagn[oó]stico|instala|instalaci[oó]n|monitorea|monitoreo|campa[nñ]a|taller)\b/i;

const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const wc = (s = '') => (s.trim() ? s.trim().split(/\s+/).length : 0);
function ngrams(s: string, n = 6) { const w = norm(s).split(' ').filter(Boolean); const set = new Set<string>(); for (let i = 0; i + n <= w.length; i++) set.add(w.slice(i, i + n).join(' ')); return set; }
function overlap(a: string, b: string, n = 6) { const A = ngrams(a, n), B = ngrams(b, n); if (!A.size) return 0; let s = 0; for (const g of A) if (B.has(g)) s++; return s / A.size; }

const TH = { weeksMin: 16, actMin: 6, actMax: 45, actAvgMax: 30, nearDup: 0.8, progCopy: 0.7, progWarn: 400, progHard: 280 };

function isLaboral(component = '') { return /laboral|competencias_laborales|capacitaci[oó]n/i.test(component); }
function fundamentalLabel(sem: number, ciclo = '') {
  const year = Number((ciclo.match(/\d{4}/) || ['0'])[0]);
  if (year >= 2027) return 'Propósito Formativo'; // 2027-2028+: todo fundamental usa Propósito
  return sem >= 5 ? 'Progresión' : 'Propósito Formativo';
}
function findUac(map: Map<string, { semester: number; component: string }>, name: string) {
  const n = norm(name); if (map.has(n)) return map.get(n);
  for (const [k, v] of map) if (k.includes(n) || n.includes(k)) return v;
  return undefined;
}

function auditPaecPlan(rows: any[], map: Map<string, { semester: number; component: string }>, parity: 1 | 0, ciclo: string, label: string, strict = false) {
  const fails: string[] = [], warns: string[] = [];
  const weeks = new Set(rows.map((r) => (String(r.week || '').match(/\d+/) || [''])[0]).filter(Boolean));
  for (let w = 1; w <= TH.weeksMin; w++) if (!weeks.has(String(w))) fails.push(`semana ${w} sin actividad`);

  const cols = ['phase', 'activity', 'uac', 'progression', 'strategy', 'week', 'responsibles', 'evaluationInstrument'];
  rows.forEach((r, i) => cols.forEach((c) => { if (!String(r[c] || '').trim()) fails.push(`fila ${i + 1}: columna ${c} vacía`); }));

  rows.forEach((r, i) => {
    const a = String(r.activity || ''); const w = wc(a);
    if (PLACEHOLDER.test(a)) fails.push(`fila ${i + 1}: placeholder`);
    if (w < TH.actMin) fails.push(`fila ${i + 1}: activity muy corta (${w}w)`);
    if (w > TH.actMax) warns.push(`fila ${i + 1}: activity larga (${w}w)`);
    if (!ACTION.test(a)) warns.push(`fila ${i + 1}: sin verbo/nominalización de acción`);
    if (r.progression && overlap(a, r.progression) >= TH.progCopy) warns.push(`fila ${i + 1}: muy similar a la progresión`);
    const plen = String(r.progression || '').length;
    if (plen > TH.progWarn) warns.push(`fila ${i + 1}: progression cruda (${plen} chars)`);
    if (strict && plen > TH.progHard) fails.push(`fila ${i + 1}: progression no destilada (${plen} > ${TH.progHard})`);

    const u = findUac(map, String(r.uac || ''));
    if (!u) warns.push(`fila ${i + 1}: UAC sin mapeo (${String(r.uac).slice(0, 40)})`);
    else {
      if (Number.isFinite(u.semester) && (u.semester % 2) !== parity) fails.push(`fila ${i + 1}: UAC de semestre ${u.semester} en bloque ${parity ? 'A (impar)' : 'B (par)'}`);
      const expected = isLaboral(u.component) ? 'Actividad Clave' : fundamentalLabel(u.semester, ciclo);
      if (r.progression && !String(r.progression).toLowerCase().includes(expected.toLowerCase().split(' ')[0])) warns.push(`fila ${i + 1}: se esperaba "${expected}" en progression`);
    }
  });

  const avg = rows.length ? rows.reduce((s, r) => s + wc(r.activity), 0) / rows.length : 0;
  if (avg > TH.actAvgMax) warns.push(`promedio ${avg.toFixed(1)}w > ${TH.actAvgMax}`);

  const dup = new Map<string, number[]>();
  rows.forEach((r, i) => { if (String(r.week || '').match(/semana\s*16/i)) return; const k = norm(r.activity); if (!k) return; const arr = dup.get(k) ?? []; arr.push(i + 1); dup.set(k, arr); });
  for (const [k, idx] of dup) if (idx.length > 1) fails.push(`duplicado x${idx.length} filas ${idx.join(',')}: ${k.slice(0, 50)}`);

  const acts = rows.filter((r) => !String(r.week || '').match(/semana\s*16/i)).map((r) => r.activity);
  for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) if (overlap(acts[i], acts[j]) >= TH.nearDup) warns.push(`near-dup: "${acts[i].slice(0, 30)}…" ~ "${acts[j].slice(0, 30)}…"`);

  const w16 = rows.filter((r) => String(r.week || '').match(/semana\s*16/i)).map((r) => `${r.activity} ${r.strategy}`).join(' ');
  if (w16 && !CLOSURE.test(w16)) warns.push('Semana 16 sin hito de cierre');

  const passed = fails.length === 0;
  console.log(`[PAEC ${label}] rows=${rows.length} weeks=${weeks.size} avg=${avg.toFixed(1)}w PASS=${passed} fails=${fails.length} warns=${warns.length}`);
  fails.slice(0, 12).forEach((f) => console.log('  FAIL ' + f));
  warns.slice(0, 12).forEach((w) => console.log('  WARN ' + w));
  return { passed };
}

function pick(ind: any, key: string): number | undefined {
  const direct = ind?.[key];
  if (typeof direct === 'number') return direct;
  const calc = ind?._calc?.[key]?.valor;
  return typeof calc === 'number' ? calc : undefined;
}

function auditPmc(p: any, strict = false) {
  const fails: string[] = [], warns: string[] = [];
  if (!p.school_name || !p.school_cct) fails.push('falta school_name/cct');

  const ind = p.indicadores_academicos ?? {};
  const keys = ['aprobacion_ant', 'reprobacion_ant', 'abandono_ant', 'et_ant', 'matricula'];
  const present = keys.filter((k) => pick(ind, k) !== undefined);
  if (!present.length) fails.push('sin indicadores');
  else if (present.length < keys.length) warns.push(`indicadores faltantes: ${keys.filter((k) => !present.includes(k)).join(', ')}`);

  const c = ind._calc ?? {};
  for (const k of Object.keys(c)) {
    const v = c[k]; if (!v || v.valor == null) fails.push(`_calc.${k} sin valor`);
    if (!v?.formula) warns.push(`_calc.${k} sin fórmula`);
    if (!Array.isArray(v?.fuentes) || !v.fuentes.length) warns.push(`_calc.${k} sin fuentes`);
  }

  const apA = pick(ind, 'aprobacion_ant'), apM = pick(ind, 'aprobacion_meta');
  const rpA = pick(ind, 'reprobacion_ant'), rpM = pick(ind, 'reprobacion_meta');
  const abA = pick(ind, 'abandono_ant'), abM = pick(ind, 'abandono_meta');
  const etA = pick(ind, 'et_ant'), etM = pick(ind, 'et_meta');
  if (apA != null && apM != null && apM < apA) fails.push(`aprobacion_meta ${apM} < ant ${apA}`);
  if (rpA != null && rpM != null && rpM > rpA) fails.push(`reprobacion_meta ${rpM} > ant ${rpA} (empeora)`);
  if (abA != null && abM != null && abM > abA) fails.push(`abandono_meta ${abM} > ant ${abA} (empeora)`);
  if (etA != null && etM != null && etM < etA) fails.push(`et_meta ${etM} < ant ${etA} (empeora)`);

  const bajas = pick(ind, 'bajas_ant') ?? pick(ind, 'bajas');
  if (apM != null && rpM != null && bajas != null) {
    const expected = 100 - apM - bajas;
    if (Math.abs(rpM - expected) > 0.6) warns.push(`reprobacion_meta ${rpM} ≠ 100 − ${apM} − ${bajas} = ${expected.toFixed(1)}`);
  }

  const d = p.diagnostico_generado ?? {};
  for (const k of ['presentacion', 'contexto', 'priorizacion', 'analisis_indicadores', 'sintesis_foda']) {
    const t = String(d[k] ?? ''); if (t.length < 200) warns.push(`diagnóstico ${k} ausente/corto`); if (PLACEHOLDER.test(t)) fails.push(`placeholder en ${k}`);
  }

  const f = p.foda ?? {};
  for (const k of ['fortalezas', 'debilidades', 'oportunidades', 'amenazas']) { const n = (String(f[k] ?? '').match(/•/g) || []).length; if (n < 3) warns.push(`FODA ${k} con ${n} bullets (<3)`); }
  const cross = p.foda_cruzado ?? f.cruzado ?? {};
  for (const k of ['fo', 'do', 'fa', 'da']) if (!cross?.[k]) (strict ? fails : warns).push(`FODA cruzado sin ${k.toUpperCase()}`);

  const pa = p.plan_accion ?? {};
  const mi: any[] = pa.metas_institucionales ?? [];
  const mp: any[] = pa.metas_personales ?? [];
  if (!mi.length) fails.push('sin metas_institucionales');
  if (!mp.length) warns.push('sin metas_personales');

  for (const m of mi) {
    if (!/\d/.test(String(m.meta ?? ''))) warns.push(`meta inst. no cuantificada: ${String(m.meta ?? '').slice(0, 40)}`);
    if (!m.entregable) warns.push('meta inst. sin entregable');
    if (!m.periodo_fin && !m.periodo_inicio) warns.push('meta inst. sin periodo');
    if (PLACEHOLDER.test(String(m.meta ?? ''))) fails.push('placeholder en meta inst.');
    const raw = String(m.categoria ?? '').trim();
    if (!PMC_NOMBRES_CATEGORIAS.includes(raw)) fails.push(`categoría no canónica "${raw}" → ${normalizePmcCategoria(raw)}`);
  }
  for (const m of mp) {
    if (!/\d/.test(String(m.meta_individual ?? ''))) warns.push(`meta personal no cuantificada: ${String(m.meta_individual ?? '').slice(0, 40)}`);
    if (!m.entregable) warns.push('meta personal sin entregable');
    if (!m.nombre || !m.cargo) warns.push('meta personal sin nombre/cargo');
    if (PLACEHOLDER.test(String(m.meta_individual ?? ''))) fails.push('placeholder en meta personal');
  }

  const miDup = mi.length - new Set(mi.map((m) => norm(m.meta))).size;
  if (miDup > 0) warns.push(`${miDup} metas inst. duplicadas`);
  const mpDup = mp.length - new Set(mp.map((m) => norm(m.meta_individual))).size;
  if (mpDup > 0) fails.push(`${mpDup} metas personales duplicadas`);

  const size = pa ? JSON.stringify(pa).length : 0;
  if (size > 150000) warns.push(`plan_accion grande (${size} chars)`);

  const passed = fails.length === 0;
  console.log(`[PMC ${p.school_name}] ind=${present.length} mi=${mi.length} mp=${mp.length} PASS=${passed} fails=${fails.length} warns=${warns.length}`);
  fails.slice(0, 12).forEach((f) => console.log('  FAIL ' + f));
  warns.slice(0, 12).forEach((w) => console.log('  WARN ' + w));
  return { passed };
}

(async () => {
  let anyFail = false;
  const projects: any[] = await sql()`select project_name, ciclo_escolar, fase2_mapeo, fase3_plan_operativo_a, fase3_plan_operativo_b from paec_projects order by created_at`;
  for (const p of projects) {
    const map = new Map<string, { semester: number; component: string }>();
    for (const m of (p.fase2_mapeo ?? [])) {
      const name = norm(m.uacName ?? m.uac ?? '');
      if (name) map.set(name, { semester: Number(m.semester ?? m.semestre ?? 0), component: String(m.component ?? m.componente ?? '') });
    }
    const ciclo = String(p.ciclo_escolar ?? '');
    for (const [sem, key, parity] of [['A', 'fase3_plan_operativo_a', 1], ['B', 'fase3_plan_operativo_b', 0]] as const) {
      const rows = (p[key] ?? []) as any[];
      if (!rows.length) { console.log(`[PAEC ${p.project_name} ${sem}] SIN DATOS`); continue; }
      if (!auditPaecPlan(rows, map, parity as 1 | 0, ciclo, `${String(p.project_name).slice(0, 30)} ${sem}`, false).passed) anyFail = true;
    }
  }

  const pmcs: any[] = await sql()`select school_name, school_cct, indicadores_academicos, foda, foda_cruzado, diagnostico_generado, plan_accion from pmc_projects order by created_at`;
  for (const p of pmcs) {
    if (!p.plan_accion) continue;
    if (!auditPmc(p, false).passed) anyFail = true;
  }
  process.exit(anyFail ? 1 : 0);
})();
```

### `package.json`
```json
"qa:paec-pmc": "node --env-file=.env.local --import tsx scripts/qa-paec-pmc.ts"
```
Si `--env-file`/`--import tsx` no aplica en su Node, usar `npx tsx` + dotenv. Verificar antes de fijarlo.

---

## 7. Plan por fases (orden seguro)

- **Fase A — QA + invariantes (solo lectura + CI)**
  `scripts/qa-paec-pmc.ts` v2 + `qa:paec-pmc` + suite Vitest de invariantes (sin snapshots). Severidad FAIL/WARN. Léxico verbo+nominalización, paridad derivada, `_calc` opcional, invariantes direccionales, 3 categorías, FODA cruzado, CREAA.
  **Gate:** QA revela el baseline real (se esperan FAIL de paridad/reprobación/categorías); `tsc`+`eslint`+`vitest` verdes.
- **Fase B — Fixes PMC**
  Persistir `effectiveFoda` (route:476) + FODA cruzado FO/DO/FA/DA; fórmula de reprobación con `bajas` + invariante (Wizard/calculator/correctInvertedMetricGoals); normalización a 3 categorías (con mapeo `1/2/3` y legacy); PMC-C8 ratio ≥85 % + 0 invertidas + 0 duplicados; `staffData` con tope documentado; migración aditiva `quality_audit` en `pmc_projects`.
  **Gate:** PMC sin FAIL duro; tests actualizados; export 422 solo FAIL.
- **Fase C — Fixes PAEC + alineación**
  Post-procesador en Pasos 5/6/7 (destilar `progression` ≤280, guard paridad, MCCEMS data-driven por ciclo, dedupe S16); endurecer `paec-quality-gate.ts` (C15–C18) y gate de exportación; `paec-context.ts` devuelve `operationalActivities[]` por corte (SSoT `curricular-blocks.ts`) manteniendo `operationalActivity`; actualizar `build-prompt.ts` y proyecto PAEC del libro.
  **Gate:** PAEC sin FAIL duro; alineación por 3 cortes verificada.
- **Fase C.5 — Golden limpios + remediación de BD (aprobada)**
  Congelar golden PAEC/PMC (diff=0) **después** de B/C; script idempotente/transaccional con dry-run + backup para: 2 reprobaciones invertidas, categorías mixtas y validación de paridad (en BD real se confirmó 0 violaciones de paridad al verificar `Conciencia Histórica II` = sem 5, ver §11.2).
  **Gate:** golden verde; remediación aplicada y re-auditada.
- **Fase D — Refactor de monolitos (PMC y PAEC) con golden diff=0**
  Ver §8. No cambia comportamiento. Luego: Horarios (auditoría + golden + refactor) y Cartografía (solo auditoría de calidad; sin monolitos).

---

## 8. Censo de monolitos (verificado; LOC medido ±1)

| Módulo | Archivo | LOC |
|---|---|---|
| PMC | `app/[locale]/pmc/nuevo/PmcWizardClient.tsx` | 5410 |
| PMC | `lib/pmc-docx-generator.ts` | 2256 |
| PMC | `app/[locale]/pmc/nuevo/PmcMetasComplementarias.tsx` | 2203 |
| PMC | `lib/pmc-pdf-generator.ts` | 1204 |
| PMC | `lib/pmc/pmc-partitioner.ts` | 1144 |
| PMC | `lib/pmc-docx-maestro-builder.ts` | 1112 |
| PAEC | `app/[locale]/paec/nuevo/legacy/PaecWizardLegacy.tsx` | 4079 |
| PAEC | `app/[locale]/paec/nuevo/PaecWizardClient.tsx` | 3839 |
| PAEC | `lib/paec-pdf-generator.ts` | 2394 |
| PAEC | `lib/paec-docx-generator.ts` | 1855 |
| PAEC | `lib/paec-quality-gate.ts` | 1713 |
| PAEC | `app/api/paec/[id]/generate-step/route.ts` | 1047 |
| Horarios | `components/horarios/WizardConfiguracionLegacy.tsx` | 3838 |
| Horarios | `components/horarios/EditorHorarios.tsx` | 2060 |
| Horarios | `components/horarios/WizardConfiguracion.tsx` | 1853 |
| Horarios | `lib/horarios/exportador.ts` | 1537 |
| Horarios | `lib/horarios/solver.ts` | 1345 |
| Horarios | `components/horarios/sections/HorariosModales.tsx` | 1163 |
| Cartografía | `lib/cartografia-zona-docx-generator.ts` | 760 |
| Cartografía | `app/[locale]/mi-zona/MiZonaClient.tsx` | 738 |

- **Cartografía no tiene monolitos** (máx. 760). No requiere refactor por tamaño.
- Los `*Legacy.tsx` siguen como **fallback de feature flags**: se auditan antes de modularizar y **nunca se borran a ciegas**.

---

## 9. Criterios de aceptación

- `qa:paec-pmc` sin FAIL duro en los 2 PAEC y 3 PMC tras B/C/C.5; WARN documentados.
- `tsc`, `eslint --max-warnings=0`, `vitest` verdes.
- Exportación: 422 solo FAIL duro; WARN registrados.
- Golden PAEC/PMC diff=0 tras C.5.
- Fase D: refactor de monolitos **sin cambio de comportamiento** (golden diff=0).
- Sin cambios funcionales fuera de lo acordado; REGLA INMORTAL de sesiones intacta.

---

## 10. Baseline esperado de Fase A (rojo controlado)

Fase A **debe** mostrar FAIL duros conocidos (es el objetivo, no un error):
- **PAEC:** 0 filas de paridad rota tras validar `fase2_mapeo` en BD (`Conciencia Histórica II` es 5.° semestre = impar en ambos PAEC; ver §11.2).
- **PMC:** 2 metas de reprobación invertidas (Moisés 0→7.5; Héroes 11.6→11.9) y categorías no canónicas (`1/2/3/practica_docente/convivencia_paec`).
- WARN esperados: `progression` cruda histórica, FODA sin cruce, faltantes de fórmula/fuente, bullets <3.

Tras B/C (generación) y C.5 (datos históricos), el QA debe quedar sin FAIL duro.

---

## 11. Registro de Ejecución y Cierre (Fases A → D)

- **Estado:** **CERRADO Y VERIFICADO** (2026-11-24).
- **Alcance ejecutado:** Fases A, B, C, C.5 y D (batches D1–D4) sobre PMC y PAEC. Horarios y Cartografía quedan diferidos para la siguiente iteración conforme a lo acordado.

### 11.1 Historial de commits atómicos (`main`)

| Fase | Commit | Descripción |
|---|---|---|
| **Fase A** | `8f4cad7e` | Motor SSoT `src/lib/qa/paec-pmc-semantic-qa.ts`, CLI solo-lectura `scripts/qa-paec-pmc.ts` (`npm run qa:paec-pmc`) y suite `paec-pmc-semantic-invariants.test.ts`. |
| **Fase B** | `ea9cc214` | Fixes PMC: persistencia `effectiveFoda` + FODA cruzado `FO/DO/FA/DA`, fórmula F11 exacta de `reprobacion_meta` (con `bajas`), normalización canónica de categorías (`1/2/3/practica_docente/convivencia_paec`), fix regex de `pmc-meta-deduplicator`, endurecimiento `PMC-C3/C5/C8`, migración aditiva `pmc_projects.quality_audit JSONB` aplicada en Neon DB y gate de exportación HTTP 422 (solo FAIL duro; WARN en `X-Quality-Warnings-Count`). |
| **Fase C** | `d764c75c` | Fixes PAEC: `plan-operativo-postprocessor.ts` (destilación `progression ≤280`, guard de paridad, nomenclatura MCCEMS por ciclo escolar, dedupe sin romper S16), endurecimiento `evaluateCriterio15/16`, gate de exportación HTTP 422 (solo FAIL duro), `paec-context.ts` con `operationalActivities[]` por Corte 1/2/3 vía `curricular-blocks.ts` + fix colisión romana (`II` vs `I`) + inyección multi-corte en `build-prompt.ts`, `StepContext.tsx` y `plannings/[id]/generate/route.ts`. |
| **Fase C.5** | `cc28fdfe` | Script transaccional e idempotente `scripts/remediate-paec-pmc-historical.ts` (`--dry-run`, `--apply` con backup JSON, `--rollback`) ejecutado en Neon DB + arnés golden determinista `scripts/verify-paec-pmc-golden.ts` (`npm run test:paec-pmc-golden`) y `paec-pmc-golden.test.ts` (0 diffs). |
| **Fase D · D1** | `894beb8a` | Descomposición de los 4 monolitos backend de PMC (`pmc-docx-generator`, `pmc-pdf-generator`, `pmc-docx-maestro-builder`, `pmc-partitioner`) con **0 diffs** en golden. |
| **Fase D · D3** | `0c55c245` | Descomposición de los 4 monolitos backend de PAEC (`paec-pdf-generator`, `paec-docx-generator`, `paec-quality-gate`, `api/paec/[id]/generate-step/route.ts`) con **0 diffs** en golden. |
| **Fase D · D2** | `dd1d4b7f` | Descomposición de los 2 monolitos UI de PMC (`PmcWizardClient`, `PmcMetasComplementarias`). |
| **Test sync** | `c0a80fc0` | Actualización de 2 aserciones heredadas en `pmc-catalogo-criterios.test.ts` que esperaban `'2'` en lugar de la categoría canónica `'Gestión y administración escolar'` de Fase B. |
| **Fase D · D4** | `243ca87c` | Descomposición del monolito UI de PAEC (`PaecWizardClient`), preservando `PaecWizardLegacy.tsx` intacto como fallback controlado por `NEXT_PUBLIC_FF_NEW_PAEC_WIZARD === 'false'`. |

### 11.2 Hallazgo normativo MCCEMS verificado en BD (Paridad `Conciencia Histórica II`)

Al auditar `paec_projects.fase2_mapeo` directamente en Neon DB durante Fase A y Fase C.5, se comprobó que en el currículo oficial MCCEMS:
- `Conciencia Histórica I` corresponde a **4° semestre (par → Semestre B)**,
- `Conciencia Histórica II. México Durante el Expansionismo Capitalista` corresponde a **5° semestre (impar → Semestre A)**,
- `Conciencia Histórica III` corresponde a **6° semestre (par → Semestre B)** (idéntico patrón en `Taller de Ciencias I/II/III`).

En consecuencia, las 6 filas de `Conciencia Histórica II` en `fase3_plan_operativo_a` (4 en *Eco-Cuenca* y 2 en *Comunidad Resiliente*) cumplen **100% paridad impar válida** (`0` violaciones reales de paridad en PAEC). Por ello **no fueron eliminadas ni movidas** en Fase C.5.

### 11.3 Resultado de Remediación Histórica en Neon DB (Fase C.5)

- **Respaldo pre-remediación:** generado automáticamente antes de la transacción (`--rollback` disponible).
- **Idempotencia verificada:** segunda ejecución consecutiva con `--apply` reportó `0 proyectos requieren cambios`.
- **Correcciones aplicadas en una sola transacción:**
  1. **Supervisión Escolar 004:** `et_meta` `5 → 15` (`et_ant = 10`, inversión corregida); 5 categorías numéricas normalizadas; `foda.cruzado` (`FO/DO/FA/DA`) generado; `quality_audit` persistido (`95/100 EXCELENTE`).
  2. **BGO “Moisés Sáenz Garza”:** `reprobacion_meta` `7.5 → 0` (F11 exacto con `reprobacion_ant = 0`, `bajas = 12.5%`); 4 categorías numéricas normalizadas; textos corruptos corregidos (`mi[0]` `"elevar al 4.4% la aprobación"` → `92.5%`, `mi[18]` `"del 3% al 7.5%"` → `0%`); `foda.cruzado` generado; `quality_audit` persistido (`95/100 EXCELENTE`).
  3. **BGO “Héroes de la Patria”:** `reprobacion_meta` `11.9 → 6.6` (F11 exacto con `aprobacion_meta = 88.1%`, `bajas = 5.3%`); 16 categorías no canónicas (`1/2/3/practica_docente/convivencia_paec`) normalizadas con desempate por `tema`; `foda.cruzado` generado; `quality_audit` persistido (`95/100 EXCELENTE`).
- **`npm run qa:paec-pmc` (post-remediación):** **PASS · 0 errores duros** en los 2 PAEC (Sem A y Sem B) y en los 3 PMC completados (código de salida `0`; solo WARN históricos documentados).

### 11.4 Tabla Antes / Después de Monolitos (Fase D)

| Módulo | Archivo (fachada / entrada) | LOC Antes | LOC Después | Submódulos extraídos (máx. LOC) |
|---|---|---:|---:|---|
| PMC UI | `src/app/[locale]/pmc/nuevo/PmcWizardClient.tsx` | 5,410 | **154** | `wizard/*` (10 archivos, máx. 882 LOC) |
| PMC Backend | `src/lib/pmc-docx-generator.ts` | 2,256 | **106** | `src/lib/pmc/docx/*` (4 archivos, máx. 761 LOC) |
| PMC UI | `src/app/[locale]/pmc/nuevo/PmcMetasComplementarias.tsx` | 2,203 | **159** | `metas-complementarias/*` (5 archivos, máx. 750 LOC) |
| PMC Backend | `src/lib/pmc-pdf-generator.ts` | 1,204 | **54** | `src/lib/pmc/pdf/*` (3 archivos, máx. 647 LOC) |
| PMC Backend | `src/lib/pmc/pmc-partitioner.ts` | 1,144 | **26** | `src/lib/pmc/partitioner/*` (3 archivos, máx. 584 LOC) |
| PMC Backend | `src/lib/pmc-docx-maestro-builder.ts` | 1,112 | **134** | `src/lib/pmc/maestro/*` (3 archivos, máx. 422 LOC) |
| PAEC UI | `src/app/[locale]/paec/nuevo/PaecWizardClient.tsx` | 3,839 | **71** | `wizard/*` (9 archivos, máx. 775 LOC) |
| PAEC Backend | `src/lib/paec-pdf-generator.ts` | 2,394 | **88** | `src/lib/paec/pdf/*` (5 archivos, máx. 666 LOC) |
| PAEC Backend | `src/lib/paec-docx-generator.ts` | 1,855 | **163** | `src/lib/paec/docx/*` (4 archivos, máx. 686 LOC) |
| PAEC Backend | `src/lib/paec-quality-gate.ts` | 1,713 | **41** | `src/lib/paec/quality-gate/*` (5 archivos, máx. 607 LOC) |
| PAEC API | `src/app/api/paec/[id]/generate-step/route.ts` | 1,047 | **270** | `src/lib/paec/step-handlers/*` (4 archivos, máx. 297 LOC) |
| PAEC Legacy | `src/app/[locale]/paec/nuevo/legacy/PaecWizardLegacy.tsx` | 4,079 | 4,079 | **Preservado sin cambios** (fallback activo bajo `NEXT_PUBLIC_FF_NEW_PAEC_WIZARD === 'false'`) |

### 11.5 Verificación Integral de Cierre

- `npx tsc --noEmit`: **0 errores**.
- `npx eslint --max-warnings=0`: **0 advertencias** en todos los archivos tocados y extraídos.
- `npm run qa:paec-pmc`: **PASS (exit 0 · 0 FAIL duros)** sobre Neon DB real.
- `npm run test:paec-pmc-golden`: **PASS · 0 diffs** (`PMC(docx=5625w, maestro=2809w, pdf=16p, gate=94%) · PAEC(docx=5793w, pdf=35p, gate=83%)`).
- `npm run test:sacrint-golden`: **PASS · 0 diffs** (`fixtures=12 | diffs=0 | qaFailures=0`).
- `npm run audit:sacrint-deps`: **PASS** (`files=55 | cycles=0 | layerViolations=0 | barrelViolations=0`).
- Auditoría de ciclos y tamaño PAEC/PMC: **PASS** (`files=93 | cycles=0 | files>=1000LOC=0` excluyendo `legacy/`).
- `npm run test:isolation`: **OK** (`309 archivos unitarios sin acceso directo a Neon`).
- Regla inmutable de sesiones por bloque (`6/12/18/24/30`): intacta, sin modificaciones.
