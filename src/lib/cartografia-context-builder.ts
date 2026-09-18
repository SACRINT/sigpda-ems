/**
 * src/lib/cartografia-context-builder.ts
 * Utilidad compartida para reconstruir el contexto base de Cartografía de Zona Escolar
 * (Momentos 1 y 2, identificación y promedios) a partir de una fila de base de datos.
 * Resuelve duplicación entre la API de generación y el exportador PDF oficial (H-011, H-013).
 */

import type {
  CartografiaPlantelItem,
  CartografiaMomento1Conocer,
  CartografiaMomento2Organizar,
} from '@/types/cartografia';
import type { CartografiaIdentificacion } from '@/lib/prompts/cartografia-prompts';

export interface CartografiaBaseContext {
  identificacion: CartografiaIdentificacion;
  planteles: CartografiaPlantelItem[];
  matriculaTotalZona: number;
  promAbandono: number;
  promEficiencia: number;
  promAprovechamiento: number;
  promReprobacion: number;
  plantelesAtencionPrioritaria: string[];
  momento1: CartografiaMomento1Conocer;
  momento2: CartografiaMomento2Organizar;
}

/**
 * Reconstruye el contexto base de la Cartografía (Identificación, Momento 1 y Momento 2)
 * a partir de un registro de `pips_projects`.
 */
export function buildCartografiaBaseContext(
  row: Record<string, unknown>,
  teacher?: { name?: string | null; email?: string | null }
): CartografiaBaseContext {
  const atpsList = Array.isArray(row.atps)
    ? (row.atps as string[])
    : typeof row.atps === 'string'
    ? row.atps.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const identificacion: CartografiaIdentificacion = {
    zonaNumero: String(row.zona_nombre || '004').replace(/[^0-9]/g, '') || '004',
    zonaClave: String(row.zona_clave || '21FMS0004Z'),
    supervisorName: String(row.supervisor_name || teacher?.name || 'Supervisor(a) Escolar'),
    municipioSede: String(row.municipio_sede || 'Venustiano Carranza'),
    municipiosAtiende: String(row.municipios_atiende || 'Venustiano Carranza, Francisco Z. Mena, Pantepec, Jalpan'),
    subsistema: String(row.subsistema || 'Bachilleratos Estatales'),
    cicloEscolar: String(row.ciclo_escolar || '2026-2027'),
    atps: atpsList,
  };

  const rawPlanteles = Array.isArray(row.planteles_json) ? (row.planteles_json as Record<string, unknown>[]) : [];
  const planteles: CartografiaPlantelItem[] = rawPlanteles.map((p, idx) => ({
    no: idx + 1,
    cct: String(p.cct || `CCT-${idx + 1}`),
    nombre: String(p.nombre || `Bachillerato ${idx + 1}`),
    localidad: String(p.localidad || 'Comunidad escolar'),
    municipio: String(p.municipio || row.municipio_sede || identificacion.municipioSede),
    turno: String(p.turno || 'MATUTINO'),
    matricula: Number(p.matricula) || Number(p.total) || 0,
    egresados: Number(p.egresados) || 0,
    bajasDefinitivas: Number(p.bajasDefinitivas) || 0,
    eficienciaTerminal: Number(p.eficienciaTerminal) || 85,
    abandono: Number(p.abandono) || 5,
    reprobacion: Number(p.reprobacion) || 8,
    promedioGeneral: Number(p.promedioGeneral) || Number(p.promedioCalificaciones) || 8.0,
    paecProyecto: String(p.paecProyecto || 'Proyecto Comunitario Integrador en proceso'),
    paecProblematica: String(p.paecProblematica || 'Reto socioformativo del entorno local'),
  }));

  const matriculaTotalZona = planteles.reduce((sum, p) => sum + p.matricula, 0);
  const plantelesConMatricula = planteles.filter((p) => p.matricula > 0);
  const divisor = plantelesConMatricula.length > 0 ? plantelesConMatricula.length : (planteles.length || 1);

  const promAbandono = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.abandono, 0) / divisor).toFixed(2));
  const promEficiencia = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.eficienciaTerminal, 0) / divisor).toFixed(2));
  const promAprovechamiento = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.promedioGeneral, 0) / divisor).toFixed(2));
  const promReprobacion = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.reprobacion, 0) / divisor).toFixed(2));

  const plantelesAtencionPrioritaria = planteles
    .filter((p) => p.abandono > promAbandono + 3 || p.eficienciaTerminal < promEficiencia - 5)
    .map((p) => `${p.nombre} (Abandono: ${p.abandono}%, ET: ${p.eficienciaTerminal}%)`);

  const rawProblems = Array.isArray(row.problematicas_json) ? (row.problematicas_json as Record<string, unknown>[]) : [];
  const problematicasComunes = rawProblems.map((pr) => String(pr.titulo || pr.descripcion || '')).filter(Boolean);

  const momento1: CartografiaMomento1Conocer = {
    planteles,
    matriculaTotalZona,
    municipiosCobertura: [identificacion.municipioSede, identificacion.municipiosAtiende].filter(Boolean),
    sedesPlanteles: planteles.map((p) => `${p.nombre} [${p.cct}]`),
    caracterizacionInicial: String(row.diagnostico_contexto || `Zona escolar ${identificacion.zonaNumero} con ${planteles.length} planteles y una matrícula total atendida de ${matriculaTotalZona} estudiantes.`),
  };

  const momento2: CartografiaMomento2Organizar = {
    capaCuantitativa: {
      promedioAbandonoZona: promAbandono,
      promedioEficienciaZona: promEficiencia,
      promedioAprovechamientoZona: promAprovechamiento,
      promedioReprobacionZona: promReprobacion,
      matriculaTotal: matriculaTotalZona,
      plantelesAtencionPrioritaria,
      resumenEstadistico911F11: `Análisis consolidado 911/F11: Abandono ${promAbandono}%, Eficiencia Terminal ${promEficiencia}%, Aprovechamiento ${promAprovechamiento}, Reprobación ${promReprobacion}%.`,
    },
    capaCualitativa: {
      problematicasComunes: problematicasComunes.length > 0 ? problematicasComunes : [
        'Vulnerabilidad económica y trabajo estudiantil vespertino o por temporadas.',
        'Dificultades de transporte y dispersión geográfica en comunidades de origen.',
        'Brechas de conectividad digital en planteles y hogares rurales.',
      ],
      factoresContextuales: ['Actividades agropecuarias y comerciales locales predominantes.'],
      vinculacionPaecZona: planteles.map((p) => `${p.nombre}: ${p.paecProyecto}${p.paecProblematica ? ` (${p.paecProblematica})` : ''}`),
      desafiosSocioeconomicos: 'Dispersión territorial y traslados prolongados que elevan el riesgo de deserción en primeros semestres.',
    },
  };

  return {
    identificacion,
    planteles,
    matriculaTotalZona,
    promAbandono,
    promEficiencia,
    promAprovechamiento,
    promReprobacion,
    plantelesAtencionPrioritaria,
    momento1,
    momento2,
  };
}
