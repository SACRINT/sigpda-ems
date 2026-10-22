export interface EscuelaCatalogo {
  cct: string;
  nombre: string;
  municipio: string;
  localidad: string;
  zonaEscolar: string;
  subsistema: string;
}

// Catálogo maestro oficial de Bachilleratos del Estado de Puebla
export const CATALOGO_PUEBLA_FIJO: EscuelaCatalogo[] = [
  {
    cct: '21EBH0200X',
    nombre: 'Héroes de la Patria',
    municipio: 'Venustiano Carranza',
    localidad: 'Lázaro Cárdenas',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0214Z',
    nombre: 'Mecapalapa',
    municipio: 'Pantepec',
    localidad: 'Mecapalapa',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0789L',
    nombre: 'David Alfaro Siqueiros',
    municipio: 'Francisco Z. Mena',
    localidad: 'Jaltocán',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0608L',
    nombre: 'Emiliano Zapata',
    municipio: 'Venustiano Carranza',
    localidad: 'Coronel Tito Hernández (María Andrea)',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0040G',
    nombre: 'Bachillerato General Lic. Benito Juárez García',
    municipio: 'Puebla',
    localidad: 'Heroica Puebla de Zaragoza',
    zonaEscolar: 'Zona Escolar 001',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0189B',
    nombre: 'Bachillerato General Digital No. 189',
    municipio: 'Chignahuapan',
    localidad: 'Chignahuapan',
    zonaEscolar: 'Zona Escolar 002',
    subsistema: 'BD'
  },
  {
    cct: '21EBH0015X',
    nombre: 'Bachillerato General Oficial Manuel Ávila Camacho',
    municipio: 'Teziutlán',
    localidad: 'Teziutlán',
    zonaEscolar: 'Zona Escolar 003',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0001X',
    nombre: 'Bachillerato Matutino del BINE',
    municipio: 'Puebla',
    localidad: 'Heroica Puebla de Zaragoza',
    zonaEscolar: 'Zona Escolar 001',
    subsistema: 'BGE'
  },
  {
    cct: '21ECT0017T',
    nombre: 'Centro de Bachillerato Tecnológico No. 17',
    municipio: 'Huauchinango',
    localidad: 'Huauchinango',
    zonaEscolar: 'Zona Escolar 005',
    subsistema: 'BT'
  },
  {
    cct: '21EBH0245M',
    nombre: 'Bachillerato General Venustiano Carranza',
    municipio: 'Venustiano Carranza',
    localidad: 'Agua Fría',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0048X',
    nombre: 'Bachillerato General Gregorio de Gante',
    municipio: 'Puebla',
    localidad: 'Heroica Puebla de Zaragoza',
    zonaEscolar: 'Zona Escolar 001',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0123Z',
    nombre: 'Bachillerato General Ignacio Zaragoza',
    municipio: 'San Pedro Cholula',
    localidad: 'Cholula de Rivadavia',
    zonaEscolar: 'Zona Escolar 002',
    subsistema: 'BGE'
  }
];

export function normalizarNombrePlantel(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buscarPlantelPorCct(cct: string | null | undefined): EscuelaCatalogo | null {
  const limpio = (cct ?? '').trim().toUpperCase();
  if (!limpio) return null;
  return CATALOGO_PUEBLA_FIJO.find((e) => e.cct.toUpperCase() === limpio) ?? null;
}

export function buscarPlantelPorNombre(nombre: string | null | undefined): EscuelaCatalogo | null {
  const consulta = normalizarNombrePlantel(nombre);
  if (consulta.length < 5) return null;

  const nombres = CATALOGO_PUEBLA_FIJO.map((e) => ({ e, n: normalizarNombrePlantel(e.nombre) }));

  const exacto = nombres.find((c) => c.n === consulta);
  if (exacto) return exacto.e;

  const candidatos = nombres.filter(
    (c) =>
      (consulta.includes(c.n) && c.n.length >= 5) || (c.n.includes(consulta) && consulta.length >= 5)
  );
  if (candidatos.length === 0) return null;

  const puntaje = (n: string) => (consulta.includes(n) ? 0 : 1);
  candidatos.sort((a, b) => puntaje(a.n) - puntaje(b.n) || a.n.length - b.n.length);
  return candidatos[0].e;
}