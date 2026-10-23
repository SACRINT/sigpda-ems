import { buscarPlantelPorCct, buscarPlantelPorNombre } from '@/lib/catalogo-escuelas';

export const PLANTEL_NO_REGISTRADO = 'Plantel no registrado';
export const CCT_NO_REGISTRADO = 'CCT no registrado';
export const MUNICIPIO_NO_REGISTRADO = 'Municipio no registrado';
export const SUPERVISION_SIN_ZONA = 'SUPERVISIÓN DE BACHILLERATOS (zona no registrada)';

export interface SchoolIdentitySource {
  schoolName?: unknown;
  cct?: unknown;
  municipality?: unknown;
  schoolZone?: unknown;
}

export interface SchoolIdentity {
  schoolName: string;
  cct: string;
  municipality: string;
  schoolZone: string | null;
  supervision: string;
}

export interface SchoolIdentityPayload {
  schoolName: string | null;
  cct: string | null;
  municipality: string | null;
  schoolZone: string | null;
}

export function supervisionLabel(schoolZone?: string | null): string {
  const v = (schoolZone ?? '').trim();
  if (!v) return SUPERVISION_SIN_ZONA;
  const num = v.match(/(\d{2,4})/);
  return num
    ? `SUPERVISIÓN DE BACHILLERATOS ${num[1].padStart(3, '0')}`
    : `SUPERVISIÓN DE BACHILLERATOS ${v}`;
}

function primerTexto(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string') {
      const v = c.trim();
      if (v) return v;
    }
  }
  return null;
}

export function resolverIdentidadEscolar(input: {
  schoolName?: unknown;
  cct?: unknown;
  municipality?: unknown;
  schoolZone?: unknown;
}): SchoolIdentityPayload {
  const schoolName = primerTexto(input.schoolName);
  const cct = primerTexto(input.cct);
  const ficha = buscarPlantelPorNombre(schoolName) || buscarPlantelPorCct(cct);

  return {
    schoolName,
    cct: ficha?.cct || cct,
    municipality: ficha?.municipio || primerTexto(input.municipality),
    // La zona capturada por el docente (Wizard Paso 1) PREVALECE sobre el catálogo:
    // el catálogo solo rellena si no hay captura. Así 086 no se pisca con 004.
    schoolZone: (primerTexto(input.schoolZone) || ficha?.zonaEscolar) ?? null,
  };
}

export function resolveSchoolIdentity(sources: {
  sectionI?: SchoolIdentitySource | null;
  cover?: SchoolIdentitySource | null;
  teacher?: SchoolIdentitySource | null;
}): SchoolIdentity {
  const schoolName = primerTexto(
    sources.sectionI?.schoolName,
    sources.cover?.schoolName,
    sources.teacher?.schoolName
  );
  const cct = primerTexto(sources.sectionI?.cct, sources.cover?.cct, sources.teacher?.cct);
  const municipality = primerTexto(
    sources.sectionI?.municipality,
    sources.cover?.municipality,
    sources.teacher?.municipality
  );
  const schoolZone = primerTexto(
    sources.sectionI?.schoolZone,
    sources.cover?.schoolZone,
    sources.teacher?.schoolZone
  );

  const ficha = buscarPlantelPorNombre(schoolName) || buscarPlantelPorCct(cct);
  // Zona capturada (sectionI/cover/perfil) primero; el catálogo solo como respaldo.
  const schoolZoneResuelta = schoolZone || ficha?.zonaEscolar;

  return {
    schoolName: schoolName || ficha?.nombre || PLANTEL_NO_REGISTRADO,
    cct: ficha?.cct || cct || CCT_NO_REGISTRADO,
    municipality: ficha?.municipio || municipality || MUNICIPIO_NO_REGISTRADO,
    schoolZone: schoolZoneResuelta ?? null,
    supervision: supervisionLabel(schoolZoneResuelta),
  };
}
