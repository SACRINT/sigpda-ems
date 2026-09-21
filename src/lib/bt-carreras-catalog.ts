/**
 * Catálogo Oficial Auténtico de Carreras Técnicas y Módulos Profesionales
 * Bachilleratos Tecnológicos (DGETI, DGETAyCM, CBTIS, CBTA, CECyTE)
 * Fuente Oficial: Documentos de Referencia SEP / COSFAC
 * Total de Carreras Catalogadas: 66
 */


export interface BTActividadClave {
  order: number;
  name: string;
  hours: number;
  saberes?: string[];
}

export interface BTSubmodulo {
  uac_name?: string;
  actividades?: BTActividadClave[];
  nombre: string;
  abreviatura: string;
  horasSemanales: number;
  horasTotales: number; // Base 16 semanas de mediación docente
}

export interface BTModulo {
  resultadoAprendizaje?: string;
  nombre: string;
  semestre: number; // 2, 3, 4, 5, 6
  horasSemanales: number; // 17 h/sem (Sem 2-4) o 12 h/sem (Sem 5-6)
  submodulos: BTSubmodulo[];
}

export interface BTCarrera {
  id: string;
  nombre: string;
  tipoPrograma: 'nuevo' | 'anterior';
  acuerdo: string;
  edicion: string;
  horasTotales: number; // 1200 hrs oficiales
  modulos: BTModulo[];
}

let _carrerasCache: BTCarrera[] | null = null;

/**
 * Cargador asíncrono para componentes cliente (dynamic code-splitting).
 * Permite a componentes diferir la carga de 927 KB de datos JSON a demanda.
 */
export async function loadCarrerasTecnicas(): Promise<BTCarrera[]> {
  if (_carrerasCache) return _carrerasCache;
  const mod = await import('@/data/bt-carreras.json');
  _carrerasCache = (mod.default || mod) as unknown as BTCarrera[];
  return _carrerasCache;
}

/**
 * Getter sincrónico lazy con caché en memoria.
 * Evita la importación estática de 927 KB de JSON en el arranque del módulo.
 */
export function getCarrerasTecnicas(): BTCarrera[] {
  if (!_carrerasCache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require('../data/bt-carreras.json');
    _carrerasCache = (data.default || data) as unknown as BTCarrera[];
  }
  return _carrerasCache;
}

// Catálogo Tipado con inicialización diferida para máxima compatibilidad síncrona
export const CARRERAS_TECNICAS_BT: BTCarrera[] = new Proxy([] as BTCarrera[], {
  get(_target, prop, receiver) {
    const list = getCarrerasTecnicas();
    const value = Reflect.get(list, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(list);
    }
    return value;
  },
  has(_target, prop) {
    return Reflect.has(getCarrerasTecnicas(), prop);
  },
  ownKeys() {
    return Reflect.ownKeys(getCarrerasTecnicas());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(getCarrerasTecnicas(), prop);
  },
});

// ── Métodos Helper de Consulta ────────────────────────────────────────────────

export function getCarreraPorId(id: string): BTCarrera | undefined {
  const norm = (id || '').toLowerCase().trim();
  return CARRERAS_TECNICAS_BT.find(c => c.id === norm || c.nombre.toLowerCase() === norm);
}

export function getModulosPorSemestreBT(carreraId: string, semestre: number): BTModulo | undefined {
  const carrera = getCarreraPorId(carreraId);
  if (!carrera) return undefined;
  return carrera.modulos.find(m => m.semestre === semestre);
}

export function getCarrerasNuevas(): BTCarrera[] {
  return CARRERAS_TECNICAS_BT.filter(c => c.tipoPrograma === 'nuevo');
}

export function getCarrerasAnteriores(): BTCarrera[] {
  return CARRERAS_TECNICAS_BT.filter(c => c.tipoPrograma === 'anterior');
}

// ── Aliases para Compatibilidad Retroactiva Total con Código Existente ──────────
export type CarreraTecnica = BTCarrera;
export type ModuloCarrera = BTModulo;
export type SubmoduloCarrera = BTSubmodulo;
export const CARRERAS_TECNOLOGICAS = CARRERAS_TECNICAS_BT;
export function getModulosPorSemestre(
  carreraId: string,
  semestre: number,
  versionPrograma?: string
): BTModulo | undefined {
  if (versionPrograma) {
    const norm = (carreraId || '').toLowerCase().trim();
    const carrera = CARRERAS_TECNICAS_BT.find(
      c => (c.id === norm || c.nombre.toLowerCase() === norm) &&
           c.tipoPrograma === versionPrograma
    );
    if (carrera) {
      return carrera.modulos.find(m => m.semestre === semestre);
    }
  }
  return getModulosPorSemestreBT(carreraId, semestre);
}

export const CATALOGO_PROPEDUTICAS_5TO: { nombre: string; area: string; horas: number }[] = [
  // Económico-Administrativa
  { nombre: "Derecho y Sociedad I", area: "Económico-Administrativa", horas: 3 },
  { nombre: "Introducción a la Economía", area: "Económico-Administrativa", horas: 3 },
  { nombre: "Introducción a la Administración", area: "Económico-Administrativa", horas: 3 },
  // Físico-Matemática
  { nombre: "Temas de Física", area: "Físico-Matemática", horas: 3 },
  { nombre: "Dibujo Técnico", area: "Físico-Matemática", horas: 3 },
  { nombre: "Matemáticas Aplicadas", area: "Físico-Matemática", horas: 3 },
  // Químico-Biológica
  { nombre: "Bioquímica", area: "Químico-Biológica", horas: 3 },
  { nombre: "Biología Contemporánea", area: "Químico-Biológica", horas: 3 },
  { nombre: "Ciencias de la Salud I", area: "Químico-Biológica", horas: 3 },
  // Humanidades y Ciencias Sociales
  { nombre: "Sociología", area: "Humanidades y Ciencias Sociales", horas: 3 },
  { nombre: "Antropología", area: "Humanidades y Ciencias Sociales", horas: 3 },
  { nombre: "Psicología", area: "Humanidades y Ciencias Sociales", horas: 3 },
];
