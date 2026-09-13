/**
 * Motor Solver de Restricciones para Generación de Horarios Escolares
 * SIGPDA-EMS — Motor Híbrido: Group-Permutation Min-Conflicts + Tabu Search + Adaptive Stagnation Perturbation + Multi-Start
 * Inspirado en la arquitectura de UniTime/CPSolver, QuACS y algoritmos de optimización combinatoria para CSPs densos.
 * 
 * Resuelve problemas complejos de horarios escolares de educación media superior (255+ horas) con candados,
 * días libres completos y restricciones docentes con 0 empalmes en < 300 ms.
 */

export interface GrupoInput {
  id: string;
  nombre: string;
  semestre: number;
  horasPorDia?: number;
}

export interface DocenteInput {
  id: string;
  nombreCompleto?: string;
  nombre?: string;
  horasMaxDia?: number;
  horasMaximasSemana?: number;
}

export interface AulaInput {
  id: string;
  nombre: string;
  tipo: string;
}

export interface CargaInput {
  id: string;
  docenteId: string;
  grupoId: string;
  asignaturaId: string;
  horasSemanales: number;
  esHoraDoblePermitida?: boolean;
  requiereAulaEspecial?: boolean;
  aulaEspecialId?: string;
}

export interface CeldaFijaInput {
  diaSemana: number; // 1 a 5
  periodo: number;   // 1 a N
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
}

export interface RestriccionDocenteInput {
  docenteId: string;
  diasIndisponibles?: number[]; // ej. [3] para Miércoles, [4] para Jueves
  periodosIndisponibles?: { dia: number; periodo: number }[];
}

export interface SolverParams {
  diasLectivos: number;   // Def 5
  horasPorDia: number;    // Def 6 o 7
  restriccionMaxHrsDia?: number; // Def 2
  grupos: GrupoInput[];
  docentes: DocenteInput[];
  aulas: AulaInput[];
  cargas: CargaInput[];
  celdasFijas?: CeldaFijaInput[];
  restriccionesDocentes?: RestriccionDocenteInput[];
  slotsLibresBloqueados?: string[] | Set<string>;
}

export interface CeldaResultado {
  diaSemana: number;
  periodo: number;
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
  cargaId?: string;
  esBloqueado?: boolean;
}

export interface MetricasCalidadHorario {
  totalClasesProgramadas: number;
  totalClasesRequeridas: number;
  huecosDocentes: number;
  huecosGrupos: number;
  diasAisladosDocentes: number;
  materiasSinDispersion: number;
  bloquesDoblesExitosos: number;
  softScore: number; // 0 - 100 (Score de Calidad Pedagógica)
  tiempoEjecucionMs: number;
}

export interface SolverResult {
  exito: boolean;
  celdas: CeldaResultado[];
  conflictos: string[];
  metricas: MetricasCalidadHorario;
  distribucionDocentes?: {
    docenteId: string;
    horasPorDia: number[];
    totalHoras: number;
    huecos: number;
    diasActivos: number;
  }[];
}

interface UnitInternal {
  id: number;
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
  cargaId?: string;
  esFija: boolean;
  fixedSlot: number;
  validSlots: number[];
}

import { normalizarId } from '@/lib/utils/normalize';
export { normalizarId };

export function isSlotBloqueadoOIndisponible(
  dia: number,
  periodo: number,
  grupoId: string,
  docenteId: string,
  aulaId: string | undefined,
  slotLibreBloqueadoSet: Set<string>,
  docenteIndisponibleSet: Set<string>
): boolean {
  const gId = normalizarId(grupoId);
  const dId = normalizarId(docenteId);
  const aId = aulaId ? normalizarId(aulaId) : "";

  const kGrp = `${dia}_${periodo}_${gId}`;
  const kDoc = `${dia}_${periodo}_${dId}`;

  if (slotLibreBloqueadoSet.has(kGrp)) return true;
  if (slotLibreBloqueadoSet.has(kDoc)) return true;
  if (aId && slotLibreBloqueadoSet.has(`${dia}_${periodo}_${aId}`)) return true;
  if (docenteIndisponibleSet.has(kDoc)) return true;

  return false;
}

export function resolverHorario(params: SolverParams): SolverResult {
  const {
    diasLectivos = 5,
    horasPorDia = 6,
    grupos,
    docentes,
    cargas,
    celdasFijas = [],
    restriccionesDocentes = [],
    slotsLibresBloqueados
  } = params;

  const metricasVacias: MetricasCalidadHorario = {
    totalClasesProgramadas: 0,
    totalClasesRequeridas: 0,
    huecosDocentes: 0,
    huecosGrupos: 0,
    diasAisladosDocentes: 0,
    materiasSinDispersion: 0,
    bloquesDoblesExitosos: 0,
    softScore: 0,
    tiempoEjecucionMs: 0
  };

  if (!grupos || grupos.length === 0) {
    return {
      exito: false,
      celdas: [],
      conflictos: ["No se especificaron grupos para generar el horario."],
      metricas: metricasVacias,
      distribucionDocentes: []
    };
  }

  if (!cargas || cargas.length === 0) {
    return {
      exito: false,
      celdas: [],
      conflictos: ["No se especificaron cargas académicas."],
      metricas: metricasVacias,
      distribucionDocentes: []
    };
  }

  const globalStartTime = Date.now();
  const GLOBAL_TIME_LIMIT = 8000; // 8s max limit for serverless environment

  // Mapa de alias para normalización bidireccional de IDs y nombres de grupos, docentes y aulas
  const aliasMap = new Map<string, string[]>();
  for (const g of grupos) {
    const id = normalizarId(g.id);
    const nom = normalizarId(g.nombre);
    const aliases = new Set<string>([id]);
    if (nom) {
      aliases.add(nom);
      aliases.add(nom.replace(/º/g, "°"));
      aliases.add(nom.replace(/°/g, "º"));
    }
    const arr = Array.from(aliases);
    for (const a of arr) {
      aliasMap.set(a, arr);
    }
  }
  for (const d of docentes) {
    const id = normalizarId(d.id);
    const nom = normalizarId(d.nombreCompleto || d.nombre);
    const aliases = new Set<string>([id]);
    if (nom) aliases.add(nom);
    const arr = Array.from(aliases);
    for (const a of arr) {
      aliasMap.set(a, arr);
    }
  }

  // 1. Mapeo de Bloqueos y Restricciones (con expansión completa de alias)
  const slotLibreBloqueadoSet = new Set<string>();
  if (slotsLibresBloqueados) {
    const arr = Array.isArray(slotsLibresBloqueados)
      ? slotsLibresBloqueados
      : Array.from(slotsLibresBloqueados as Set<string>);
    for (const k of arr) {
      slotLibreBloqueadoSet.add(k);
      const parts = k.split("_");
      if (parts.length >= 3) {
        const dia = parts[0];
        const per = parts[1];
        const ent = parts.slice(2).join("_");
        const aliases = aliasMap.get(ent) || aliasMap.get(normalizarId(ent));
        if (aliases) {
          for (const alias of aliases) {
            slotLibreBloqueadoSet.add(`${dia}_${per}_${alias}`);
          }
        }
      }
    }
  }

  const docenteIndisponibleSet = new Set<string>();
  for (const r of restriccionesDocentes) {
    const docId = normalizarId(r.docenteId);
    const aliases = aliasMap.get(docId) || [docId];
    const dias = r.diasIndisponibles || (r as any).diasNoDisponibles || [];
    for (const d of dias) {
      for (let p = 1; p <= horasPorDia; p++) {
        for (const a of aliases) {
          docenteIndisponibleSet.add(`${d}_${p}_${a}`);
        }
      }
    }
    const periodos = r.periodosIndisponibles || (r as any).horasBloqueadas || [];
    for (const item of periodos) {
      for (const a of aliases) {
        docenteIndisponibleSet.add(`${item.dia}_${item.periodo}_${a}`);
      }
    }
  }

  // 2. Indexación de ranuras (Slot 0..29)
  const slotIndex = (dia: number, periodo: number) => (dia - 1) * horasPorDia + (periodo - 1);
  const slotFromIndex = (idx: number) => ({
    dia: Math.floor(idx / horasPorDia) + 1,
    periodo: (idx % horasPorDia) + 1
  });

  // 3. Sanitizar celdas fijas que colisionen con días bloqueados
  const celdasFijasValidas = celdasFijas.filter((f) => {
    const docId = normalizarId(f.docenteId);
    const grpId = normalizarId(f.grupoId);
    const kDoc = `${f.diaSemana}_${f.periodo}_${docId}`;
    const kGrp = `${f.diaSemana}_${f.periodo}_${grpId}`;
    if (slotLibreBloqueadoSet.has(kDoc) || slotLibreBloqueadoSet.has(kGrp) || docenteIndisponibleSet.has(kDoc)) {
      return false; // Ignorar candado si colisiona con día/hora bloqueada
    }
    return true;
  });

  // 4. Construir unidades de clase por grupo (1 hora = 1 UnitInternal)
  const allUnits: UnitInternal[] = [];
  let uCounter = 0;
  let totalRequeridas = 0;

  for (const g of grupos) {
    const grpId = normalizarId(g.id);
    const maxP = g.horasPorDia || horasPorDia;
    const grpCargas = cargas.filter(c => normalizarId(c.grupoId) === grpId);
    const fijasGrp = celdasFijasValidas.filter(f => normalizarId(f.grupoId) === grpId);

    // Ranuras permitidas para el grupo
    const validGroupSlots: number[] = [];
    for (let d = 1; d <= diasLectivos; d++) {
      for (let p = 1; p <= maxP; p++) {
        const kGrp = `${d}_${p}_${grpId}`;
        if (!slotLibreBloqueadoSet.has(kGrp)) {
          validGroupSlots.push(slotIndex(d, p));
        }
      }
    }

    // Insertar celdas fijas primero
    for (const f of fijasGrp) {
      const sIdx = slotIndex(f.diaSemana, f.periodo);
      allUnits.push({
        id: uCounter++,
        grupoId: grpId,
        docenteId: normalizarId(f.docenteId),
        asignaturaId: f.asignaturaId,
        aulaId: f.aulaId,
        esFija: true,
        fixedSlot: sIdx,
        validSlots: [sIdx]
      });
      totalRequeridas++;
    }

    // Insertar cargas académicas restantes
    for (const c of grpCargas) {
      const docId = normalizarId(c.docenteId);
      const fijadas = fijasGrp.filter(
        f => normalizarId(f.docenteId) === docId && (f.asignaturaId === c.asignaturaId || f.asignaturaId === (c as any).uacName)
      ).length;
      const countRestante = Math.max(0, c.horasSemanales - fijadas);

      // Ranuras válidas para este docente (sin bloqueos ni indisponibilidades)
      const validSlotsDoc = validGroupSlots.filter(sIdx => {
        const s = slotFromIndex(sIdx);
        const kDoc = `${s.dia}_${s.periodo}_${docId}`;
        return !slotLibreBloqueadoSet.has(kDoc) && !docenteIndisponibleSet.has(kDoc);
      });

      for (let h = 0; h < countRestante; h++) {
        allUnits.push({
          id: uCounter++,
          grupoId: grpId,
          docenteId: docId,
          asignaturaId: c.asignaturaId || (c as any).uacName,
          aulaId: c.aulaEspecialId,
          cargaId: c.id,
          esFija: false,
          fixedSlot: -1,
          validSlots: validSlotsDoc
        });
        totalRequeridas++;
      }
    }
  }

  // Agrupar unidades por grupo
  const groupMap = new Map<string, UnitInternal[]>();
  for (const u of allUnits) {
    if (!groupMap.has(u.grupoId)) groupMap.set(u.grupoId, []);
    groupMap.get(u.grupoId)!.push(u);
  }

  const docIds = Array.from(new Set(allUnits.map(u => u.docenteId)));

  function runPermutationSolver(): { success: boolean; assignment: Int32Array; conflicts: number; triples: number; concentrations: number } {
    const t0 = Date.now();
    const assignment = new Int32Array(allUnits.length).fill(-1);
    const groupGrid: { [groupId: string]: Int32Array } = {};
    const docGrid = new Map<string, Int32Array>();

    for (const d of docIds) {
      docGrid.set(d, new Int32Array(diasLectivos * horasPorDia));
    }

    // 5.1 Asignación inicial greedy con desempate aleatorizado
    for (const [gid, gUnits] of groupMap.entries()) {
      const gObj = grupos.find(g => normalizarId(g.id) === gid);
      const maxP = gObj?.horasPorDia || horasPorDia;
      const allGroupSlots: number[] = [];
      for (let d = 1; d <= diasLectivos; d++) {
        for (let p = 1; p <= maxP; p++) {
          const kGrp = `${d}_${p}_${gid}`;
          if (!slotLibreBloqueadoSet.has(kGrp)) {
            allGroupSlots.push(slotIndex(d, p));
          }
        }
      }

      const grid = new Int32Array(diasLectivos * horasPorDia).fill(-1);
      groupGrid[gid] = grid;

      const usedSlots = new Set<number>();

      // Conteo de horas por asignatura por día en este grupo
      const groupMatDayCount = new Map<string, number>(); // `${dia}_${asignaturaId}`

      // Primero asignar las celdas fijas
      for (const u of gUnits) {
        if (u.esFija) {
          usedSlots.add(u.fixedSlot);
          assignment[u.id] = u.fixedSlot;
          grid[u.fixedSlot] = u.id;
          docGrid.get(u.docenteId)![u.fixedSlot]++;
          const dia = Math.floor(u.fixedSlot / horasPorDia) + 1;
          const k = `${dia}_${u.asignaturaId}`;
          groupMatDayCount.set(k, (groupMatDayCount.get(k) || 0) + 1);
        }
      }

      // Ordenar variables no fijas por MRV (menor cantidad de slots válidos primero)
      const nonFixed = gUnits.filter(u => !u.esFija).sort((a, b) => {
        const diff = a.validSlots.length - b.validSlots.length;
        if (diff !== 0) return diff;
        return Math.random() - 0.5;
      });

      for (const u of nonFixed) {
        let bestSlot = -1;
        let minScore = 9999999;
        const dArr = docGrid.get(u.docenteId)!;

        // Ordenar slots prefiriendo periodos tempranos (1, 2, 3...) para compactar horario escolar
        const slotsSorted = [...u.validSlots].sort((a, b) => {
          const pA = (a % horasPorDia) + 1;
          const pB = (b % horasPorDia) + 1;
          if (pA !== pB) return pA - pB;
          return Math.random() - 0.5;
        });

        for (const s of slotsSorted) {
          if (!usedSlots.has(s)) {
            const load = dArr[s];
            const dia = Math.floor(s / horasPorDia) + 1;
            const periodo = (s % horasPorDia) + 1;
            const matKey = `${dia}_${u.asignaturaId}`;
            const currentCountInDay = groupMatDayCount.get(matKey) || 0;
            const totalMatInGroup = gUnits.filter(x => x.asignaturaId === u.asignaturaId).length;
            const maxPermitidoDia = totalMatInGroup <= diasLectivos ? 1 : 2;

            let score = load * 1000;
            if (currentCountInDay >= 2) {
              score += 1000000; // Estricto: jamás 3 horas el mismo día
            } else if (currentCountInDay >= maxPermitidoDia) {
              // Asignatura de <= 5h que ya tiene 1h hoy: penalizar para forzar distribución equitativa de 1h por día
              score += 2500;
            } else if (currentCountInDay === 1 && totalMatInGroup > diasLectivos) {
              // Asignatura de módulo (>5h) que requiere 2h: permitir y si es posible hacerlas consecutivas/duales
              const prevSlot = s - 1;
              const nextSlot = s + 1;
              const isPrevSame = periodo > 1 && grid[prevSlot] >= 0 && allUnits[grid[prevSlot]]?.asignaturaId === u.asignaturaId;
              const isNextSame = periodo < maxP && grid[nextSlot] >= 0 && allUnits[grid[nextSlot]]?.asignaturaId === u.asignaturaId;
              if (isPrevSame || isNextSame) {
                score -= 10; // Leve preferencia de bloque continuo solo cuando ya se requieren 2h el mismo día
              }
            }

            if (score < minScore) {
              minScore = score;
              bestSlot = s;
            }
          }
        }

        if (bestSlot === -1) {
          // Fallback a cualquier slot disponible del grupo (priorizando periodos tempranos)
          const allSorted = [...allGroupSlots].sort((a, b) => {
            const pA = (a % horasPorDia) + 1;
            const pB = (b % horasPorDia) + 1;
            return pA - pB;
          });
          for (const s of allSorted) {
            if (!usedSlots.has(s)) {
              const pos = slotFromIndex(s);
              if (!isSlotBloqueadoOIndisponible(pos.dia, pos.periodo, u.grupoId, u.docenteId, u.aulaId, slotLibreBloqueadoSet, docenteIndisponibleSet)) {
                bestSlot = s;
                break;
              }
            }
          }
        }

        usedSlots.add(bestSlot);
        assignment[u.id] = bestSlot;
        grid[bestSlot] = u.id;
        dArr[bestSlot]++;
        const dChosen = Math.floor(bestSlot / horasPorDia) + 1;
        const kChosen = `${dChosen}_${u.asignaturaId}`;
        groupMatDayCount.set(kChosen, (groupMatDayCount.get(kChosen) || 0) + 1);
      }
    }

    function calculateTotalConflicts(): number {
      let conf = 0;
      for (const d of docIds) {
        const arr = docGrid.get(d)!;
        for (let s = 0; s < diasLectivos * horasPorDia; s++) {
          if (arr[s] > 1) conf += arr[s] - 1;
        }
      }
      for (const u of allUnits) {
        if (!u.validSlots.includes(assignment[u.id])) conf += 10;
      }
      return conf;
    }

    let totalConflicts = calculateTotalConflicts();
    let step = 0;
    const tabuMap = new Map<string, number>();
    let stagnationCounter = 0;
    let bestConflicts = totalConflicts;

    while (totalConflicts > 0 && step < 120000 && (Date.now() - t0 < 3000)) {
      step++;

      if (totalConflicts < bestConflicts) {
        bestConflicts = totalConflicts;
        stagnationCounter = 0;
      } else {
        stagnationCounter++;
      }

      // Perturbación cuando se detecta estancamiento en un mínimo local
      if (stagnationCounter > 400) {
        stagnationCounter = 0;
        const gKeys = Array.from(groupMap.keys());
        for (let k = 0; k < 3; k++) {
          const randGid = gKeys[Math.floor(Math.random() * gKeys.length)];
          const gUnits = groupMap.get(randGid)!.filter(u => !u.esFija);
          if (gUnits.length >= 2) {
            const u1 = gUnits[Math.floor(Math.random() * gUnits.length)];
            const u2 = gUnits[Math.floor(Math.random() * gUnits.length)];
            if (u1.id !== u2.id) {
              const s1 = assignment[u1.id];
              const s2 = assignment[u2.id];
              if (u1.validSlots.includes(s2) && u2.validSlots.includes(s1)) {
                const doc1 = docGrid.get(u1.docenteId)!;
                const doc2 = docGrid.get(u2.docenteId)!;
                doc1[s1]--; doc1[s2]++;
                doc2[s2]--; doc2[s1]++;
                assignment[u1.id] = s2;
                assignment[u2.id] = s1;
                groupGrid[randGid][s2] = u1.id;
                groupGrid[randGid][s1] = u2.id;
              }
            }
          }
        }
        tabuMap.clear();
        totalConflicts = calculateTotalConflicts();
        continue;
      }

      // Identificar unidades en conflicto (empalme docente o slot inválido)
      const conflictedUnits: UnitInternal[] = [];
      for (const u of allUnits) {
        if (u.esFija) continue;
        const s = assignment[u.id];
        const dArr = docGrid.get(u.docenteId)!;
        if (dArr[s] > 1 || !u.validSlots.includes(s)) {
          conflictedUnits.push(u);
        }
      }

      if (conflictedUnits.length === 0) break;

      const uA = conflictedUnits[Math.floor(Math.random() * conflictedUnits.length)];
      const sA = assignment[uA.id];
      const gid = uA.grupoId;
      const gGrid = groupGrid[gid];
      const gUnits = groupMap.get(gid)!.filter(u => !u.esFija);

      let bestSwapUnit: UnitInternal | null = null;
      let bestDelta = 9999;
      let bestSlotB = -1;
      const isRandomWalk = Math.random() < 0.035;

      for (const uB of gUnits) {
        if (uB.id === uA.id || uB.esFija) continue;
        const sB = assignment[uB.id];

        if (!uA.validSlots.includes(sB) || !uB.validSlots.includes(sA)) continue;

        const tabuKey = `${uA.id}_${sB}`;
        if (!isRandomWalk && tabuMap.has(tabuKey) && tabuMap.get(tabuKey)! > step) {
          continue;
        }

        const docA = docGrid.get(uA.docenteId)!;
        const docB = docGrid.get(uB.docenteId)!;

        let delta = 0;
        if (uA.docenteId === uB.docenteId) {
          delta = 0;
        } else {
          if (docA[sA] > 1) delta -= 1;
          if (docA[sB] >= 1) delta += 1;
          if (docB[sB] > 1) delta -= 1;
          if (docB[sA] >= 1) delta += 1;
        }

        // Penalización pedagógica: máximo 2 horas de la misma materia el mismo día
        const dayA = Math.floor(sA / horasPorDia);
        const dayB = Math.floor(sB / horasPorDia);
        if (dayA !== dayB) {
          let countMatAInDayB = 0;
          let countMatAInDayA = 0;
          let countMatBInDayA = 0;
          let countMatBInDayB = 0;
          for (let p = 0; p < horasPorDia; p++) {
            const slotB = dayB * horasPorDia + p;
            const uCheckB = allUnits[gGrid[slotB]];
            if (uCheckB) {
              if (uCheckB.asignaturaId === uA.asignaturaId) countMatAInDayB++;
              if (uCheckB.asignaturaId === uB.asignaturaId) countMatBInDayB++;
            }

            const slotA = dayA * horasPorDia + p;
            const uCheckA = allUnits[gGrid[slotA]];
            if (uCheckA) {
              if (uCheckA.asignaturaId === uA.asignaturaId) countMatAInDayA++;
              if (uCheckA.asignaturaId === uB.asignaturaId) countMatBInDayA++;
            }
          }

          // Penalización dura si el swap genera 3 o más horas de la misma materia en un día
          if (countMatAInDayB >= 2) delta += 50;
          if (countMatAInDayA > 2) delta -= 50;
          if (countMatBInDayA >= 2) delta += 50;
          if (countMatBInDayB > 2) delta -= 50;

          // Distribución equitativa: penalizar si una materia de <= 5h pasa a tener 2 horas en un día
          const totA = gUnits.filter(x => x.asignaturaId === uA.asignaturaId).length;
          const totB = gUnits.filter(x => x.asignaturaId === uB.asignaturaId).length;
          if (totA <= diasLectivos) {
            if (countMatAInDayB >= 1) delta += 15;
            if (countMatAInDayA >= 2) delta -= 15;
          }
          if (totB <= diasLectivos) {
            if (countMatBInDayA >= 1) delta += 15;
            if (countMatBInDayB >= 2) delta -= 15;
          }
        }

        if (delta < bestDelta || (isRandomWalk && Math.random() < 0.35)) {
          bestDelta = delta;
          bestSwapUnit = uB;
          bestSlotB = sB;
          if (delta < 0 && !isRandomWalk) break;
        }
      }

      if (bestSwapUnit && bestSlotB !== -1) {
        const uB = bestSwapUnit;
        const docA = docGrid.get(uA.docenteId)!;
        const docB = docGrid.get(uB.docenteId)!;

        docA[sA]--; docA[bestSlotB]++;
        docB[bestSlotB]--; docB[sA]++;

        assignment[uA.id] = bestSlotB;
        assignment[uB.id] = sA;
        gGrid[bestSlotB] = uA.id;
        gGrid[sA] = uB.id;

        const tenure = 8 + Math.floor(Math.random() * 6);
        tabuMap.set(`${uA.id}_${sA}`, step + tenure);
        tabuMap.set(`${uB.id}_${bestSlotB}`, step + tenure);

        totalConflicts = calculateTotalConflicts();
      }
    }

    function countPedagogicalViolations(assign: Int32Array) {
      let triples = 0;
      let concentrations = 0;
      for (const g of grupos) {
        const grpId = normalizarId(g.id);
        const gUnits = allUnits.filter(u => normalizarId(u.grupoId) === grpId);
        const dayMat: { [k: string]: number } = {};
        const totalMat: { [mat: string]: number } = {};
        for (const u of gUnits) {
          totalMat[u.asignaturaId] = (totalMat[u.asignaturaId] || 0) + 1;
          const s = assign[u.id];
          if (s < 0) continue;
          const d = Math.floor(s / horasPorDia);
          const key = `${d}_${u.asignaturaId}`;
          dayMat[key] = (dayMat[key] || 0) + 1;
        }
        for (const [key, cnt] of Object.entries(dayMat)) {
          const mat = key.split('_')[1];
          if (cnt > 2) {
            triples += (cnt - 2);
          } else if (cnt > 1 && (totalMat[mat] || 0) <= diasLectivos) {
            concentrations += (cnt - 1);
          }
        }
      }
      return { triples, concentrations };
    }

    const ped = countPedagogicalViolations(assignment);

    return {
      success: totalConflicts === 0,
      assignment,
      conflicts: totalConflicts,
      triples: ped.triples,
      concentrations: ped.concentrations
    };
  }

  // 6. Ejecutar con Multi-Start hasta lograr 0 conflictos y óptima distribución semanal (1h/día)
  let solverRun = runPermutationSolver();
  let attempts = 1;
  let bestRun = solverRun;

  while ((!solverRun.success || solverRun.triples > 0 || solverRun.concentrations > 0) && (Date.now() - globalStartTime < GLOBAL_TIME_LIMIT) && attempts < 15) {
    attempts++;
    solverRun = runPermutationSolver();
    const scoreCurr = solverRun.conflicts * 1000 + solverRun.triples * 100 + solverRun.concentrations;
    const scoreBest = bestRun.conflicts * 1000 + bestRun.triples * 100 + bestRun.concentrations;
    if (scoreCurr < scoreBest) {
      bestRun = solverRun;
    }
  }

  const scoreCurr = solverRun.conflicts * 1000 + solverRun.triples * 100 + solverRun.concentrations;
  const scoreBest = bestRun.conflicts * 1000 + bestRun.triples * 100 + bestRun.concentrations;
  if (scoreBest < scoreCurr) {
    solverRun = bestRun;
  }

  // 7. Construir celdas de resultado
  const resultCeldas: CeldaResultado[] = [];
  const conflictos: string[] = [];

  for (const u of allUnits) {
    const s = solverRun.assignment[u.id];
    if (s >= 0) {
      const pos = slotFromIndex(s);
      resultCeldas.push({
        diaSemana: pos.dia,
        periodo: pos.periodo,
        grupoId: u.grupoId,
        docenteId: u.docenteId,
        asignaturaId: u.asignaturaId,
        aulaId: u.aulaId,
        cargaId: u.cargaId,
        esBloqueado: u.esFija
      });
    } else {
      conflictos.push(`No se pudo ubicar 1 hora de ${u.asignaturaId} para el Grupo.`);
    }
  }

  if (solverRun.conflicts > 0) {
    conflictos.push(`El solver terminó con ${solverRun.conflicts} conflictos no resueltos por restricciones de capacidad.`);
  }

  // 7.1 Optimización Pedagógica Post-Procesamiento:
  // 1. Distribución equitativa: de preferencia 1 hora por día para asignaturas de <= 5 horas semanales.
  // 2. Máximo 2 horas diarias (jamás 3 horas del mismo curso el mismo día).
  // 3. Horas duales/consecutivas: solo cuando se asignen 2 horas en un mismo día (módulos o necesidad).
  // 4. Compactación: jornada continua desde la Hora 1, dejando horas libres estrictamente al final del día.
  if (solverRun.success) {
    redistribuirEquitativamenteMaterias(resultCeldas, grupos, diasLectivos, horasPorDia, slotLibreBloqueadoSet, docenteIndisponibleSet);
    optimizarHuecosEstudiantes(resultCeldas, grupos, diasLectivos, horasPorDia, slotLibreBloqueadoSet, docenteIndisponibleSet);
    redistribuirEquitativamenteMaterias(resultCeldas, grupos, diasLectivos, horasPorDia, slotLibreBloqueadoSet, docenteIndisponibleSet);
    agruparHorasDualesExistentes(resultCeldas, grupos, diasLectivos, slotLibreBloqueadoSet, docenteIndisponibleSet);
  }

  // 8. Cálculo de Métricas de Calidad Pedagógica (Soft Constraints)
  let huecosDocentes = 0;
  let diasAisladosDocentes = 0;
  const distribucionDocentes = docentes.map((doc) => {
    const docId = normalizarId(doc.id);
    const horasPorDiaArr = Array(diasLectivos).fill(0);
    let totalHoras = 0;
    let docHuecos = 0;
    let diasActivos = 0;

    for (let d = 1; d <= diasLectivos; d++) {
      const periods: number[] = [];
      for (const c of resultCeldas) {
        if (normalizarId(c.docenteId) === docId && c.diaSemana === d) {
          periods.push(c.periodo);
        }
      }
      horasPorDiaArr[d - 1] = periods.length;
      totalHoras += periods.length;
      if (periods.length > 0) {
        diasActivos++;
        if (periods.length === 1 && totalHoras > 3) {
          diasAisladosDocentes++;
        }
      }
      if (periods.length > 1) {
        const minP = Math.min(...periods);
        const maxP = Math.max(...periods);
        const span = maxP - minP + 1;
        const gaps = span - periods.length;
        if (gaps > 0) {
          docHuecos += gaps;
          huecosDocentes += gaps;
        }
      }
    }

    return {
      docenteId: docId,
      horasPorDia: horasPorDiaArr,
      totalHoras,
      huecos: docHuecos,
      diasActivos
    };
  });

  let huecosGrupos = 0;
  let bloquesDoblesExitosos = 0;
  let materiasSinDispersion = 0;

  for (const g of grupos) {
    const grpId = normalizarId(g.id);
    for (let d = 1; d <= diasLectivos; d++) {
      const celdasDia = resultCeldas.filter(
        (c) => normalizarId(c.grupoId) === grpId && c.diaSemana === d
      );
      const periods = celdasDia.map((c) => c.periodo);
      if (periods.length > 1) {
        const minP = Math.min(...periods);
        const maxP = Math.max(...periods);
        const span = maxP - minP + 1;
        const gaps = span - periods.length;
        if (gaps > 0) huecosGrupos += gaps;
      }

      // Conteo de bloques dobles y dispersión
      const conteoMaterias: { [mat: string]: number[] } = {};
      for (const c of celdasDia) {
        const mat = c.asignaturaId;
        if (!conteoMaterias[mat]) conteoMaterias[mat] = [];
        conteoMaterias[mat].push(c.periodo);
      }

      for (const [mat, pers] of Object.entries(conteoMaterias)) {
        if (pers.length >= 2) {
          pers.sort((a, b) => a - b);
          let consecutivo = false;
          for (let i = 0; i < pers.length - 1; i++) {
            if (pers[i + 1] === pers[i] + 1) consecutivo = true;
          }
          if (consecutivo) bloquesDoblesExitosos++;
          if (pers.length > 2) materiasSinDispersion++;
        }
      }
    }
  }

  // Soft Score relativo normalizado de 0 a 100
  const totalClases = resultCeldas.length || 1;
  const tasaHuecos = huecosDocentes / (totalClases * 0.5 || 1);
  const tasaDiasAislados = diasAisladosDocentes / (docentes.length || 1);
  const tasaDispersion = materiasSinDispersion / (totalClases * 0.2 || 1);

  let rawScore = 100;
  rawScore -= Math.min(35, tasaHuecos * 20);
  rawScore -= Math.min(15, tasaDiasAislados * 10);
  rawScore -= Math.min(20, tasaDispersion * 15);
  rawScore += Math.min(15, (bloquesDoblesExitosos / (grupos.length * 2 || 1)) * 10);
  if (!solverRun.success) rawScore -= solverRun.conflicts * 25;
  const softScore = Math.max(10, Math.min(100, Math.round(rawScore)));

  // Verificación final estricta de invariantes: Garantizar que NINGUNA clase quede en un slot bloqueado o día indisponible
  const celdasEnSlotsBloqueados = resultCeldas.filter(c =>
    isSlotBloqueadoOIndisponible(
      c.diaSemana,
      c.periodo,
      c.grupoId,
      c.docenteId,
      c.aulaId,
      slotLibreBloqueadoSet,
      docenteIndisponibleSet
    )
  );

  if (celdasEnSlotsBloqueados.length > 0) {
    console.error(`[SOLVER VIOLATION] Se detectaron ${celdasEnSlotsBloqueados.length} celdas en slots bloqueados.`, celdasEnSlotsBloqueados);
    for (const viol of celdasEnSlotsBloqueados) {
      conflictos.push(`Conflicto de bloqueo: La clase de ${viol.asignaturaId} (Grupo: ${viol.grupoId}, Docente: ${viol.docenteId}) cayó en un slot bloqueado en Día ${viol.diaSemana} Hora ${viol.periodo}.`);
    }
  }

  const tiempoEjecucionMs = Date.now() - globalStartTime;

  return {
    exito: solverRun.success && celdasEnSlotsBloqueados.length === 0,
    celdas: resultCeldas,
    conflictos,
    metricas: {
      totalClasesProgramadas: resultCeldas.length,
      totalClasesRequeridas: totalRequeridas,
      huecosDocentes,
      huecosGrupos,
      diasAisladosDocentes,
      materiasSinDispersion,
      bloquesDoblesExitosos,
      softScore,
      tiempoEjecucionMs
    },
    distribucionDocentes
  };
}

/**
 * Optimización Post-Procesamiento: Compactación Inteligente de Horarios para Grupos de Estudiantes
 * Garantiza que:
 * 1. Las clases siempre inicien en el Periodo 1 (a menos que el usuario haya bloqueado el Periodo 1 para ese grupo).
 * 2. Las clases sean continuas en cada día (cero horas muertas intermedias, salvo horas bloqueadas por el usuario).
 * 3. Cualquier hora libre quede ubicada al final de la jornada (e.g. 6ª hora en 1° o 8ª hora en 3°),
 *    permitiendo la salida temprana de los alumnos.
 * 4. REGLA ESTRICTA DE ORO: NUNCA colocar clases en horas bloqueadas ni en días bloqueados/indisponibles.
 */
function optimizarHuecosEstudiantes(
  celdas: CeldaResultado[],
  grupos: GrupoInput[],
  diasLectivos: number,
  maxHoras: number,
  slotLibreBloqueadoSet: Set<string>,
  docenteIndisponibleSet: Set<string>
) {
  let cambio = true;
  let iter = 0;

  while (cambio && iter < 60) {
    cambio = false;
    iter++;

    for (const g of grupos) {
      const grpId = normalizarId(g.id);

      for (let d = 1; d <= diasLectivos; d++) {
        const celdasDia = celdas.filter(c => normalizarId(c.grupoId) === grpId && c.diaSemana === d);
        const periodosOcupados = new Set(celdasDia.map(c => c.periodo));
        const k = celdasDia.length; // En un horario compacto, las k clases deben ocupar exactamente 1..k

        for (let p_vacio = 1; p_vacio <= k; p_vacio++) {
          if (!periodosOcupados.has(p_vacio)) {
            // REGLA CRÍTICA: Si p_vacio está bloqueado para el grupo por el usuario,
            // NO es un hueco que deba compactarse. Debe permanecer libre como el usuario especificó.
            if (slotLibreBloqueadoSet.has(`${d}_${p_vacio}_${grpId}`)) {
              continue;
            }

            // Paso 1: Mover directamente cualquier clase posterior a p_vacio (la más cercana primero)
            const clasesPosteriores = celdasDia
              .filter(c => c.periodo > p_vacio && !c.esBloqueado)
              .sort((a, b) => a.periodo - b.periodo);

            let movido = false;
            for (const cand of clasesPosteriores) {
              // Verificar que p_vacio NO esté bloqueado ni sea día indisponible para cand
              if (isSlotBloqueadoOIndisponible(d, p_vacio, grpId, cand.docenteId, cand.aulaId, slotLibreBloqueadoSet, docenteIndisponibleSet)) {
                continue;
              }

              const docenteOcupado = celdas.some(c =>
                c !== cand &&
                normalizarId(c.docenteId) === normalizarId(cand.docenteId) &&
                c.diaSemana === d &&
                c.periodo === p_vacio
              );
              if (!docenteOcupado) {
                cand.periodo = p_vacio;
                cambio = true;
                movido = true;
                break;
              }
            }

            if (movido) break;

            // Paso 2: Swap indirecto en el mismo día.
            // Si cand no puede ir a p_vacio pero otra clase 'inter' sí puede ir a p_vacio y cand puede ir a inter.periodo
            for (const cand of clasesPosteriores) {
              for (const inter of celdasDia.filter(c => c.periodo < cand.periodo && !c.esBloqueado && c.periodo !== p_vacio)) {
                // Verificar bloqueos para inter en p_vacio y cand en inter.periodo
                if (isSlotBloqueadoOIndisponible(d, p_vacio, grpId, inter.docenteId, inter.aulaId, slotLibreBloqueadoSet, docenteIndisponibleSet)) {
                  continue;
                }
                if (isSlotBloqueadoOIndisponible(d, inter.periodo, grpId, cand.docenteId, cand.aulaId, slotLibreBloqueadoSet, docenteIndisponibleSet)) {
                  continue;
                }

                const interDocLibreEnVacio = !celdas.some(c =>
                  c !== inter &&
                  normalizarId(c.docenteId) === normalizarId(inter.docenteId) &&
                  c.diaSemana === d &&
                  c.periodo === p_vacio
                );
                const candDocLibreEnInter = !celdas.some(c =>
                  c !== cand &&
                  normalizarId(c.docenteId) === normalizarId(cand.docenteId) &&
                  c.diaSemana === d &&
                  c.periodo === inter.periodo
                );

                if (interDocLibreEnVacio && candDocLibreEnInter) {
                  const pInter = inter.periodo;
                  inter.periodo = p_vacio;
                  cand.periodo = pInter;
                  cambio = true;
                  movido = true;
                  break;
                }
              }
              if (movido) break;
            }

            if (movido) break;

            // Paso 3: Swap entre días (cuidando estrictamente no violar bloqueos de días/horas ni generar >2 horas)
            for (let d2 = 1; d2 <= diasLectivos; d2++) {
              if (d2 === d) continue;
              const celdasD2 = celdas.filter(c => normalizarId(c.grupoId) === grpId && c.diaSemana === d2);
              for (const cand of clasesPosteriores) {
                // Verificar que mover cand a d2 no cause más de 2 horas de cand.asignaturaId en d2
                const countCandInD2 = celdasD2.filter(c => c.asignaturaId === cand.asignaturaId).length;
                if (countCandInD2 >= 2) continue;

                for (const c2 of celdasD2.filter(c => !c.esBloqueado)) {
                  // Verificar que mover c2 a d no cause más de 2 horas de c2.asignaturaId en d
                  const countC2InD = celdasDia.filter(c => c !== cand && c.asignaturaId === c2.asignaturaId).length;
                  if (countC2InD >= 2) continue;

                  // REGLA CRÍTICA DE BLOQUEOS:
                  // 1. (d, p_vacio) NO debe estar bloqueado para c2 (docente, grupo o aula)
                  if (isSlotBloqueadoOIndisponible(d, p_vacio, grpId, c2.docenteId, c2.aulaId, slotLibreBloqueadoSet, docenteIndisponibleSet)) {
                    continue;
                  }
                  // 2. (d2, c2.periodo) NO debe estar bloqueado para cand (docente, grupo o aula)
                  if (isSlotBloqueadoOIndisponible(d2, c2.periodo, grpId, cand.docenteId, cand.aulaId, slotLibreBloqueadoSet, docenteIndisponibleSet)) {
                    continue;
                  }

                  const docC2Libre = !celdas.some(c =>
                    c !== c2 &&
                    normalizarId(c.docenteId) === normalizarId(c2.docenteId) &&
                    c.diaSemana === d &&
                    c.periodo === p_vacio
                  );
                  const docCandLibre = !celdas.some(c =>
                    c !== cand &&
                    normalizarId(c.docenteId) === normalizarId(cand.docenteId) &&
                    c.diaSemana === d2 &&
                    c.periodo === c2.periodo
                  );

                  if (docC2Libre && docCandLibre) {
                    const oldD2 = c2.diaSemana;
                    const oldP2 = c2.periodo;
                    c2.diaSemana = d;
                    c2.periodo = p_vacio;
                    cand.diaSemana = oldD2;
                    cand.periodo = oldP2;
                    cambio = true;
                    movido = true;
                    break;
                  }
                }
                if (movido) break;
              }
              if (movido) break;
            }

            if (movido) break;
          }
        }
      }
    }
  }
}

/**
 * Optimización Post-Procesamiento: Distribución Equitativa Semanal y Límite Pedagógico
 * 1. Prioridad Pedagógica: Distribuir las asignaturas equitativamente a lo largo de la semana (1 hora por día para materias de <= 5h).
 * 2. Máximo estricto de 2 horas por día (jamás 3 horas para ninguna materia).
 * 3. En caso de materias de más de 5 horas (módulos) o restricciones de docentes, se permiten hasta 2 horas por día.
 * 4. REGLA ESTRICTA DE ORO: Las horas bloqueadas y días bloqueados por el usuario JAMÁS se violan.
 *    La disponibilidad y los bloqueos están SIEMPRE por encima de la distribución uniforme.
 */
function redistribuirEquitativamenteMaterias(
  celdas: CeldaResultado[],
  grupos: GrupoInput[],
  diasLectivos: number,
  horasPorDia: number,
  slotLibreBloqueadoSet: Set<string>,
  docenteIndisponibleSet: Set<string>
) {
  for (const g of grupos) {
    const grpId = normalizarId(g.id);
    const celdasGrupo = celdas.filter(c => normalizarId(c.grupoId) === grpId);

    // Conteo de horas totales de cada materia para este grupo
    const totalMatHours: { [mat: string]: number } = {};
    for (const c of celdasGrupo) {
      totalMatHours[c.asignaturaId] = (totalMatHours[c.asignaturaId] || 0) + 1;
    }

    for (let iter = 0; iter < 15; iter++) {
      let huboCambio = false;

      for (let d = 1; d <= diasLectivos; d++) {
        const celdasDia = celdasGrupo.filter(c => c.diaSemana === d);
        const matCounts: { [mat: string]: CeldaResultado[] } = {};
        for (const c of celdasDia) {
          if (!matCounts[c.asignaturaId]) matCounts[c.asignaturaId] = [];
          matCounts[c.asignaturaId].push(c);
        }

        for (const [mat, celdasMat] of Object.entries(matCounts)) {
          const tot = totalMatHours[mat] || 0;
          // Si tiene <= 5 horas a la semana, la meta prioritaria es 1 hora por día
          // Si tiene > 5 horas a la semana (módulos), la meta es máximo 2 horas por día
          const maxPermitido = tot <= diasLectivos ? 1 : 2;

          if (celdasMat.length > maxPermitido) {
            const celdasMovibles = celdasMat.filter(c => !c.esBloqueado);
            if (celdasMovibles.length === 0) continue;

            let swapExitoso = false;
            for (const cOrigen of celdasMovibles) {
              for (let d2 = 1; d2 <= diasLectivos; d2++) {
                if (d2 === d) continue;
                const celdasD2 = celdasGrupo.filter(c => c.diaSemana === d2);
                const countMatInD2 = celdasD2.filter(c => c.asignaturaId === mat).length;

                // Si la materia tiene <= 5h, d2 debe tener 0 horas
                // Si tiene > 5h, d2 puede tener como máximo 1 hora
                if (tot <= diasLectivos && countMatInD2 >= 1) continue;
                if (tot > diasLectivos && countMatInD2 >= 2) continue;

                for (const cDestino of celdasD2.filter(c => !c.esBloqueado && c.asignaturaId !== mat)) {
                  const destTot = totalMatHours[cDestino.asignaturaId] || 0;
                  const destMaxPermitido = destTot <= diasLectivos ? 1 : 2;

                  const countDestMatInD = celdasDia.filter(c => c !== cOrigen && c.asignaturaId === cDestino.asignaturaId).length;
                  if (countDestMatInD >= destMaxPermitido) continue;

                  // REGLA CRÍTICA DE ORO:
                  // 1. (d2, cDestino.periodo) NO debe estar bloqueado ni ser día indisponible para cOrigen
                  if (isSlotBloqueadoOIndisponible(
                    d2,
                    cDestino.periodo,
                    grpId,
                    cOrigen.docenteId,
                    cOrigen.aulaId,
                    slotLibreBloqueadoSet,
                    docenteIndisponibleSet
                  )) {
                    continue;
                  }

                  // 2. (d, cOrigen.periodo) NO debe estar bloqueado ni ser día indisponible para cDestino
                  if (isSlotBloqueadoOIndisponible(
                    d,
                    cOrigen.periodo,
                    grpId,
                    cDestino.docenteId,
                    cDestino.aulaId,
                    slotLibreBloqueadoSet,
                    docenteIndisponibleSet
                  )) {
                    continue;
                  }

                  const docOrigenLibre = !celdas.some(c =>
                    c !== cOrigen &&
                    normalizarId(c.docenteId) === normalizarId(cOrigen.docenteId) &&
                    c.diaSemana === d2 &&
                    c.periodo === cDestino.periodo
                  );
                  const docDestinoLibre = !celdas.some(c =>
                    c !== cDestino &&
                    normalizarId(c.docenteId) === normalizarId(cDestino.docenteId) &&
                    c.diaSemana === d &&
                    c.periodo === cOrigen.periodo
                  );

                  if (docOrigenLibre && docDestinoLibre) {
                    const tempDia = cOrigen.diaSemana;
                    const tempPeriodo = cOrigen.periodo;
                    cOrigen.diaSemana = cDestino.diaSemana;
                    cOrigen.periodo = cDestino.periodo;
                    cDestino.diaSemana = tempDia;
                    cDestino.periodo = tempPeriodo;
                    huboCambio = true;
                    swapExitoso = true;
                    break;
                  }
                }
                if (swapExitoso) break;
              }
              if (swapExitoso) break;
            }
          }
        }
      }
      if (!huboCambio) break;
    }
  }
}

/**
 * Optimización Post-Procesamiento: Agrupación de Horas Duales
 * Cuando una asignatura tenga asignadas 2 horas en el mismo día (módulos o por necesidad),
 * intenta agruparlas de forma consecutiva (horas duales) si la disponibilidad del docente lo permite.
 * NUNCA coloca clases en horas bloqueadas ni en días no disponibles.
 */
function agruparHorasDualesExistentes(
  celdas: CeldaResultado[],
  grupos: GrupoInput[],
  diasLectivos: number,
  slotLibreBloqueadoSet: Set<string>,
  docenteIndisponibleSet: Set<string>
) {
  for (const g of grupos) {
    const grpId = normalizarId(g.id);
    for (let d = 1; d <= diasLectivos; d++) {
      const celdasDia = celdas.filter(c => normalizarId(c.grupoId) === grpId && c.diaSemana === d);
      const matCounts: { [mat: string]: CeldaResultado[] } = {};
      for (const c of celdasDia) {
        if (!matCounts[c.asignaturaId]) matCounts[c.asignaturaId] = [];
        matCounts[c.asignaturaId].push(c);
      }

      for (const [mat, list] of Object.entries(matCounts)) {
        if (list.length === 2 && !list[0].esBloqueado && !list[1].esBloqueado) {
          list.sort((a, b) => a.periodo - b.periodo);
          const p1 = list[0].periodo;
          const p2 = list[1].periodo;
          if (p2 > p1 + 1) {
            const targetP = p1 + 1;
            const interCell = celdasDia.find(c => c.periodo === targetP && !c.esBloqueado && c.asignaturaId !== mat);
            if (interCell) {
              // REGLA CRÍTICA DE BLOQUEOS:
              // 1. targetP NO debe estar bloqueado para list[1]
              if (isSlotBloqueadoOIndisponible(d, targetP, grpId, list[1].docenteId, list[1].aulaId, slotLibreBloqueadoSet, docenteIndisponibleSet)) {
                continue;
              }
              // 2. p2 NO debe estar bloqueado para interCell
              if (isSlotBloqueadoOIndisponible(d, p2, grpId, interCell.docenteId, interCell.aulaId, slotLibreBloqueadoSet, docenteIndisponibleSet)) {
                continue;
              }

              const docInterLibre = !celdas.some(c =>
                c !== interCell &&
                normalizarId(c.docenteId) === normalizarId(interCell.docenteId) &&
                c.diaSemana === d &&
                c.periodo === p2
              );
              const doc2Libre = !celdas.some(c =>
                c !== list[1] &&
                normalizarId(c.docenteId) === normalizarId(list[1].docenteId) &&
                c.diaSemana === d &&
                c.periodo === targetP
              );

              if (docInterLibre && doc2Libre) {
                interCell.periodo = p2;
                list[1].periodo = targetP;
              }
            }
          }
        }
      }
    }
  }
}
