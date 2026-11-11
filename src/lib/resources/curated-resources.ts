/**
 * curated-resources.ts — Biblioteca curada de recursos educativos y simuladores.
 *
 * Regla de producto (P0): un libro no puede entregar `google.com/search` ni
 * `youtube.com/results` como "recurso". Si la IA no aporta un enlace directo
 * verificable, se sustituye por una entrada curada de esta biblioteca.
 *
 * Los enlaces son raíces institucionales estables (no deep-links inventados).
 * `scripts/verify-curated-resources.ts` comprueba su disponibilidad HTTP.
 */

export type CuratedResourceType = 'video' | 'web' | 'lectura' | 'simulador' | 'manual';

export interface CuratedResource {
  id: string;
  titulo: string;
  url: string;
  tipo: CuratedResourceType;
  tags: string[];
  descripcion: string;
}

export const CURATED_RESOURCES: readonly CuratedResource[] = [
  // Matemáticas / variacional
  { id: 'geogebra', titulo: 'GeoGebra — Geometría, álgebra y cálculo interactivo', url: 'https://www.geogebra.org/', tipo: 'simulador', tags: ['matematica', 'algebra', 'geometria', 'calculo', 'funcion', 'grafica', 'variacional', 'trigonometria', 'estadistica'], descripcion: 'Simulador y calculadora gráfica para modelar y visualizar matemáticas.' },
  { id: 'desmos', titulo: 'Desmos — Calculadora gráfica y científica', url: 'https://www.desmos.com/', tipo: 'simulador', tags: ['matematica', 'algebra', 'funcion', 'grafica', 'variacional', 'calculo'], descripcion: 'Calculadora gráfica para explorar funciones, tablas y transformaciones.' },
  { id: 'phet-math', titulo: 'PhET Matemáticas — Simulaciones interactivas', url: 'https://phet.colorado.edu/es/simulations/filter?subjects=math', tipo: 'simulador', tags: ['matematica', 'fraccion', 'proporcion', 'algebra', 'geometria', 'estadistica'], descripcion: 'Simulaciones gratuitas de la Universidad de Colorado para matemáticas.' },
  { id: 'khan', titulo: 'Khan Academy — Matemáticas y ciencias', url: 'https://www.khanacademy.org/', tipo: 'video', tags: ['matematica', 'ciencia', 'algebra', 'geometria', 'calculo', 'fisica', 'quimica', 'biologia'], descripcion: 'Videos y práctica guiada con retroalimentación inmediata.' },
  { id: 'inegi', titulo: 'INEGI — Datos y estadísticas de México', url: 'https://www.inegi.org.mx/', tipo: 'web', tags: ['estadistica', 'datos', 'poblacion', 'sociedad', 'geografia', 'economia'], descripcion: 'Datos oficiales para modelar problemas reales del contexto mexicano.' },

  // Ciencias naturales
  { id: 'phet', titulo: 'PhET — Simulaciones de ciencias', url: 'https://phet.colorado.edu/es/', tipo: 'simulador', tags: ['ciencia', 'fisica', 'quimica', 'biologia', 'experimento', 'laboratorio', 'energia', 'movimiento'], descripcion: 'Simulaciones de laboratorio para física, química, biología y ciencias de la Tierra.' },
  { id: 'biodigital', titulo: 'BioDigital Human — Anatomía 3D', url: 'https://www.biodigital.com/', tipo: 'simulador', tags: ['biologia', 'anatomia', 'salud', 'cuerpo', 'medicina'], descripcion: 'Modelo anatómico humano interactivo en 3D.' },
  { id: 'molview', titulo: 'MolView — Modelado molecular', url: 'https://molview.org/', tipo: 'simulador', tags: ['quimica', 'molecula', 'enlace', 'estructura', 'compuesto'], descripcion: 'Editor y visualizador de estructuras moleculares.' },
  { id: 'stellarium', titulo: 'Stellarium — Planetario virtual', url: 'https://stellarium.org/es/', tipo: 'simulador', tags: ['astronomia', 'ciencia', 'cielo', 'planeta', 'estrella'], descripcion: 'Planetario de código abierto para observar el cielo.' },
  { id: 'phet-physics', titulo: 'PhET Física — Simulaciones interactivas', url: 'https://phet.colorado.edu/es/simulations/filter?subjects=physics', tipo: 'simulador', tags: ['fisica', 'medicion', 'energia', 'movimiento', 'experimento', 'laboratorio'], descripcion: 'Simulaciones de física para experimentar con variables y mediciones.' },

  // Lengua, humanidades y ciencias sociales
  { id: 'fundeu', titulo: 'Fundéu RAE — Lengua y estilo', url: 'https://www.fundeu.es/', tipo: 'lectura', tags: ['lengua', 'espanol', 'literatura', 'vocabulario', 'gramatica', 'redaccion', 'estilo'], descripcion: 'Recomendaciones de uso del español y estilo, con respaldo de la RAE.' },
  { id: 'cervantes', titulo: 'Instituto Cervantes — Biblioteca y recursos', url: 'https://www.cervantes.es/', tipo: 'lectura', tags: ['lengua', 'literatura', 'espanol', 'lectura', 'cultura'], descripcion: 'Recursos de lengua, literatura y cultura hispánica.' },
  { id: 'unam', titulo: 'UNAM — Recursos académicos abiertos', url: 'https://www.unam.mx/', tipo: 'web', tags: ['humanidades', 'ciencia', 'sociales', 'investigacion', 'universidad'], descripcion: 'Portal de recursos académicos y divulgación de la UNAM.' },
  { id: 'arts-culture', titulo: 'Google Arts & Culture', url: 'https://artsandculture.google.com/', tipo: 'web', tags: ['artes', 'cultura', 'historia', 'museo', 'patrimonio', 'musica'], descripcion: 'Colecciones de arte, patrimonio e historia de museos del mundo.' },

  // Formación laboral: TIC, cómputo y redes
  { id: 'cisco-netacad', titulo: 'Cisco Networking Academy', url: 'https://www.netacad.com/', tipo: 'manual', tags: ['redes', 'red', 'cableado', 'router', 'switch', 'cisco', 'packet tracer', 'computo', 'mantenimiento', 'seguridad informatica', 'internet'], descripcion: 'Cursos y laboratorios oficiales de redes y TI (incluye Packet Tracer).' },
  { id: 'comptia-aplus', titulo: 'CompTIA A+ — Soporte técnico de cómputo', url: 'https://www.comptia.org/certifications/a', tipo: 'manual', tags: ['computo', 'hardware', 'software', 'mantenimiento', 'soporte', 'diagnostico', 'sistema operativo', 'motherboard', 'bios', 'uefi', 'redes'], descripcion: 'Estándar internacional de soporte técnico, hardware y software.' },
  { id: 'comptia-network', titulo: 'CompTIA Network+ — Redes', url: 'https://www.comptia.org/certifications/network', tipo: 'manual', tags: ['redes', 'red', 'cableado', 'rj45', 'ip', 'subnet', 'vlan', 'router', 'switch', 'seguridad'], descripcion: 'Estándar internacional de fundamentos de redes.' },
  { id: 'conocer', titulo: 'CONOCER — Estándares de competencia laboral', url: 'https://www.conocer.gob.mx/', tipo: 'manual', tags: ['conocer', 'competencia', 'laboral', 'certificacion', 'ec0228', 'ec0586', 'soporte', 'redes', 'cableado'], descripcion: 'Estándares de competencia laboral oficiales de México (SEP).' },
  { id: 'microsoft-learn', titulo: 'Microsoft Learn — Cursos y documentación', url: 'https://learn.microsoft.com/es-es/', tipo: 'manual', tags: ['software', 'sistema operativo', 'windows', 'office', 'computo', 'redes', 'nube', 'programacion'], descripcion: 'Documentación y rutas de aprendizaje técnicas de Microsoft.' },
  { id: 'w3schools', titulo: 'W3Schools — Programación y web', url: 'https://www.w3schools.com/', tipo: 'manual', tags: ['programacion', 'software', 'web', 'html', 'css', 'javascript', 'base de datos', 'computo'], descripcion: 'Tutoriales interactivos de programación y desarrollo web.' },
  { id: 'tinkercad', titulo: 'Tinkercad — Diseño 3D, circuitos y código', url: 'https://www.tinkercad.com/', tipo: 'simulador', tags: ['diseno', '3d', 'circuito', 'electronica', 'programacion', 'prototipo', 'steam', 'mecatronica'], descripcion: 'Simulador de diseño 3D, electrónica y programación por bloques.' },
  { id: 'instructables', titulo: 'Instructables — Proyectos y prototipos', url: 'https://www.instructables.com/', tipo: 'manual', tags: ['proyecto', 'prototipo', 'construccion', 'taller', 'diseno', 'maker', 'steam'], descripcion: 'Proyectos paso a paso para construir prototipos y soluciones.' },

  // Formación laboral: construcción e instalaciones
  { id: 'cemex', titulo: 'Cemex — Manuales de concreto y materiales', url: 'https://www.cemexmexico.com/', tipo: 'manual', tags: ['construccion', 'cemento', 'concreto', 'mezcla', 'mortero', 'material', 'obra', 'cimentacion'], descripcion: 'Fichas y manuales técnicos de materiales de construcción.' },
  { id: 'stps', titulo: 'STPS — Seguridad y salud en el trabajo', url: 'https://www.gob.mx/stps', tipo: 'manual', tags: ['seguridad', 'epp', 'nom', 'trabajo', 'riesgo', 'taller', 'construccion'], descripcion: 'Normas oficiales de seguridad y salud laboral (NOM).' },
  { id: 'conagua', titulo: 'CONAGUA — Agua e instalaciones hidráulicas', url: 'https://www.gob.mx/conagua', tipo: 'manual', tags: ['hidraulica', 'agua', 'tuberia', 'sanitaria', 'plomeria', 'instalacion'], descripcion: 'Información técnica y normativa sobre agua e instalaciones hidráulicas.' },

  // Generales
  { id: 'sep', titulo: 'SEP — Secretaría de Educación Pública', url: 'https://www.gob.mx/sep', tipo: 'web', tags: ['educacion', 'sep', 'normativa', 'programa', 'bachillerato'], descripcion: 'Portal oficial de la SEP.' },
  { id: 'mejoredu', titulo: 'MEJOREDU — Mejora continua de la educación', url: 'https://www.gob.mx/mejoredu', tipo: 'web', tags: ['educacion', 'calidad', 'mejora continua', 'evaluacion', 'sep', 'educacion media superior'], descripcion: 'Recursos de evaluación y mejora continua del sistema educativo nacional.' },
] as const;

const GENERIC_SEARCH_RE =
  /(?:google\.[a-z.]+\/search|youtube\.[a-z.]+\/results|bing\.[a-z.]+\/search|duckduckgo\.com\/\?q=|search\?q=)/i;

const PLACEHOLDER_RESOURCE_RE =
  /(?:scholar\.google|example\.com|tu-enlace|url-del-recurso|watch\?v=(?:123|abc|ejemplo)(?![a-z0-9])|(?:^|\/\/)(?:localhost|127\.0\.0\.1)|^#)/i;

export function isGenericSearchUrl(url: string | null | undefined): boolean {
  return GENERIC_SEARCH_RE.test((url || '').trim());
}

/**
 * Detecta URLs de ejemplo, comodín o no navegables que la IA suele alucinar.
 * Es la única fuente de verdad para writer-contract y renderers PDF/DOCX.
 */
export function isPlaceholderResourceUrl(url: string | null | undefined): boolean {
  const value = (url || '').trim();
  if (!value) return true;
  return PLACEHOLDER_RESOURCE_RE.test(value);
}

/** Una URL es inutilizable si es búsqueda genérica o placeholder. */
export function isUnusableResourceUrl(url: string | null | undefined): boolean {
  return isPlaceholderResourceUrl(url) || isGenericSearchUrl(url);
}

export function isCuratedUrl(url: string | null | undefined): boolean {
  const value = (url || '').trim();
  if (!/^https?:\/\//i.test(value) || isUnusableResourceUrl(value)) return false;
  return CURATED_RESOURCES.some((resource) => value.startsWith(resource.url));
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Selecciona el recurso curado más pertinente por coincidencia de etiquetas.
 * Siempre devuelve un recurso (fallback general) para no dejar sesiones sin
 * ampliación cuando la IA no aportó un enlace válido.
 */
export function pickCuratedResourceForText(
  text: string,
  preferredType?: CuratedResourceType | 'video' | 'web' | 'lectura'
): CuratedResource {
  const haystack = normalize(text || '');
  let best: { resource: CuratedResource; score: number } | null = null;

  for (const resource of CURATED_RESOURCES) {
    let score = 0;
    for (const tag of resource.tags) {
      if (haystack.includes(normalize(tag))) score += tag.length >= 6 ? 3 : 2;
    }
    if (preferredType) {
      if (resource.tipo === preferredType) score += 1;
      if (preferredType === 'video' && resource.tipo === 'simulador') score += 1;
    }
    if (!best || score > best.score) best = { resource, score };
  }

  if (best && best.score > 0) return best.resource;
  return preferredType === 'video'
    ? CURATED_RESOURCES.find((r) => r.id === 'khan') ?? CURATED_RESOURCES[0]
    : CURATED_RESOURCES.find((r) => r.id === 'phet') ?? CURATED_RESOURCES[0];
}

const ADAPTER_TAGS: Record<string, string[]> = {
  pensamiento_matematico: ['matematica', 'algebra', 'geometria', 'funcion', 'variacional'],
  ciencias_naturales: ['ciencia', 'fisica', 'quimica', 'biologia', 'laboratorio'],
  fisica_ingenieria: ['fisica', 'medicion', 'experimento', 'energia'],
  quimica_biologia: ['quimica', 'biologia', 'molecula', 'anatomia'],
  lengua_comunicacion: ['lengua', 'literatura', 'espanol', 'redaccion'],
  ciencias_sociales: ['sociales', 'historia', 'sociedad', 'inegi'],
  humanidades_filosofia: ['humanidades', 'filosofia', 'cultura', 'arte'],
  cultura_digital: ['programacion', 'software', 'web', 'computo'],
  dibujo_tecnico: ['diseno', 'geometria', 'construccion', 'plano'],
  educacion_fisica: ['salud', 'cuerpo', 'movimiento', 'deporte'],
  artes: ['artes', 'cultura', 'musica', 'patrimonio'],
  formacion_socioemocional: ['sociedad', 'salud', 'convivencia'],
  formacion_laboral_servicios_gestion_turismo: ['laboral', 'competencia', 'gestion', 'servicios'],
  formacion_laboral_industrial_agro_salud: ['laboral', 'taller', 'seguridad', 'construccion', 'redes', 'computo'],
};

export function getCuratedResourcesForAdapter(adapterId: string, limit = 8): CuratedResource[] {
  const tags = ADAPTER_TAGS[adapterId] ?? [];
  const scored = CURATED_RESOURCES.map((resource) => {
    const score = resource.tags.reduce(
      (acc, tag) => acc + (tags.some((t) => normalize(tag).includes(normalize(t)) || normalize(t).includes(normalize(tag))) ? 1 : 0),
      0
    );
    return { resource, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.resource);

  if (scored.length > 0) return scored;
  return CURATED_RESOURCES.filter((r) => ['khan', 'phet', 'sep', 'mejoredu'].includes(r.id)).slice(0, limit);
}

export function formatCuratedResourcesForPrompt(adapterId: string, limit = 8): string {
  const resources = getCuratedResourcesForAdapter(adapterId, limit);
  const lines = resources.map(
    (resource) => `- ${resource.titulo} — ${resource.url} (${resource.tipo}; ${resource.descripcion})`
  );
  return `BIBLIOTECA CURADA DE RECURSOS (USA PREFERENTEMENTE ESTOS ENLACES):\n${lines.join('\n')}`;
}
