// src/lib/materials/materials-catalog.ts
/**
 * Catálogo tipado maestro de materiales, insumos, herramientas y laboratorios virtuales.
 * SIGPDA-EMS · Ciclo Escolar 2026-2027
 * Fuente de verdad de los 48 slugs prioritarios P1 del Modelo Educativo 2025 / MCCEMS.
 */

export type MaterialCategory =
  | 'medicion'
  | 'laboratorio_quimica'
  | 'laboratorio_bio'
  | 'fisica'
  | 'herramientas'
  | 'computo'
  | 'seguridad_epp'
  | 'arte'
  | 'deportivo'
  | 'agro'
  | 'virtual';

export interface MaterialCatalogItem {
  slug: string;
  name: string;
  category: MaterialCategory;
  priority: 'P1' | 'P2';
  altText: string;
  aliases?: string[];
  eppRequerido?: string[];
  equivalenteVirtual?: {
    nombre: string;
    url: string;
    offline: boolean;
  };
}

export const MATERIALES_CATALOG: readonly MaterialCatalogItem[] = [
  // ── Instrumentación y Medición Eléctrica/Física ──────────────────────────
  {
    slug: 'multimetro',
    name: 'Multímetro Digital Autorango',
    category: 'medicion',
    priority: 'P1',
    altText: 'Multímetro digital con puntas de prueba y selector de magnitudes eléctricas',
    aliases: ['multímetro', 'polímetro', 'tester-digital'],
    eppRequerido: ['Gafas de seguridad', 'Calzado dieléctrico'],
    equivalenteVirtual: {
      nombre: 'Simulador Falstad CircuitJS',
      url: 'https://www.falstad.com/circuit/',
      offline: true,
    },
  },
  {
    slug: 'osciloscopio',
    name: 'Osciloscopio Digital de 2 Canales',
    category: 'medicion',
    priority: 'P1',
    altText: 'Osciloscopio digital de dos canales para análisis de formas de onda',
    aliases: ['osciloscopio-digital', 'pantalla-ondas'],
    eppRequerido: ['Gafas de seguridad'],
    equivalenteVirtual: {
      nombre: 'Simulador EveryCircuit / Falstad',
      url: 'https://www.falstad.com/circuit/',
      offline: true,
    },
  },
  {
    slug: 'fuente-poder',
    name: 'Fuente de Alimentación Regulable DC',
    category: 'medicion',
    priority: 'P1',
    altText: 'Fuente de poder regulada de 0 a 30V DC con limitador de corriente',
    aliases: ['fuente-dc', 'fuente-regulable'],
    eppRequerido: ['Gafas de seguridad'],
    equivalenteVirtual: {
      nombre: 'Tinkercad Circuits Fuente DC',
      url: 'https://www.tinkercad.com/circuits',
      offline: false,
    },
  },
  {
    slug: 'generador-funciones',
    name: 'Generador de Funciones y Señales',
    category: 'medicion',
    priority: 'P1',
    altText: 'Generador de señales senoidales, cuadradas y triangulares',
    aliases: ['generador-senales', 'generador-ondas'],
    eppRequerido: ['Gafas de seguridad'],
    equivalenteVirtual: {
      nombre: 'Falstad Function Generator',
      url: 'https://www.falstad.com/circuit/',
      offline: true,
    },
  },

  // ── Laboratorio de Ciencias, Química y Biología ──────────────────────────
  {
    slug: 'microscopio-optico',
    name: 'Microscopio Óptico Compuesto',
    category: 'laboratorio_bio',
    priority: 'P1',
    altText: 'Microscopio óptico binocular de laboratorio con revólver de 4 objetivos',
    aliases: ['microscopio', 'microscopio-binocular'],
    eppRequerido: ['Bata de laboratorio 100% algodón', 'Gafas de seguridad'],
    equivalenteVirtual: {
      nombre: 'Virtual Microscope NCBioNetwork',
      url: 'https://www.ncbionetwork.org/educational-resources/elearning/interactive-tools/virtual-microscope',
      offline: false,
    },
  },
  {
    slug: 'probeta',
    name: 'Probeta Graduada de Vidrio (100 ml)',
    category: 'laboratorio_quimica',
    priority: 'P1',
    altText: 'Probeta de vidrio borosilicato graduada de 100 ml con base hexagonal',
    aliases: ['probeta-graduada', 'cilindro-graduado'],
    eppRequerido: ['Bata de laboratorio', 'Gafas de seguridad', 'Guantes de nitrilo'],
    equivalenteVirtual: {
      nombre: 'PhET Simulación de Densidad y Volumen',
      url: 'https://phet.colorado.edu/es/simulations/density',
      offline: true,
    },
  },
  {
    slug: 'matraz-erlenmeyer',
    name: 'Matraz Erlenmeyer de 250 ml',
    category: 'laboratorio_quimica',
    priority: 'P1',
    altText: 'Matraz Erlenmeyer de cuello estrecho para titulación y mezclas',
    aliases: ['erlenmeyer', 'matraz'],
    eppRequerido: ['Bata de laboratorio', 'Gafas de seguridad'],
    equivalenteVirtual: {
      nombre: 'PhET Concentración y Soluciones Químicas',
      url: 'https://phet.colorado.edu/es/simulations/concentration',
      offline: true,
    },
  },
  {
    slug: 'bureta',
    name: 'Bureta Graduada con Llave de Teflón (50 ml)',
    category: 'laboratorio_quimica',
    priority: 'P1',
    altText: 'Bureta de precisión de 50 ml para valoración ácido-base',
    aliases: ['bureta-quimica', 'bureta-50ml'],
    eppRequerido: ['Bata de laboratorio', 'Gafas de seguridad', 'Guantes de nitrilo'],
    equivalenteVirtual: {
      nombre: 'Simulador de Titulación Ácido-Base',
      url: 'https://phet.colorado.edu/es/simulations/ph-scale',
      offline: true,
    },
  },
  {
    slug: 'balanza-digital',
    name: 'Balanza Digital de Precisión (0.01 g)',
    category: 'medicion',
    priority: 'P1',
    altText: 'Balanza digital electrónica para pesaje analítico en laboratorio',
    aliases: ['balanza-precision', 'bascula-digital'],
    equivalenteVirtual: {
      nombre: 'PhET Balanza y Masas',
      url: 'https://phet.colorado.edu/es/simulations/balancing-act',
      offline: true,
    },
  },
  {
    slug: 'phmetro',
    name: 'Medidor de pH Digital (pHímetro de Bolsillo)',
    category: 'medicion',
    priority: 'P1',
    altText: 'Potenciómetro medidor de pH con electrodo sumergible',
    aliases: ['medidor-ph', 'potenciometro-ph'],
    eppRequerido: ['Gafas de seguridad', 'Guantes de nitrilo'],
    equivalenteVirtual: {
      nombre: 'PhET Escala de pH Interactiva',
      url: 'https://phet.colorado.edu/es/simulations/ph-scale',
      offline: true,
    },
  },
  {
    slug: 'termometro',
    name: 'Termómetro de Laboratorio (-10°C a 110°C)',
    category: 'medicion',
    priority: 'P1',
    altText: 'Termómetro de inmersión total con escala graduada en grados Celsius',
    aliases: ['termometro-laboratorio', 'termometro-vidrio'],
    eppRequerido: ['Gafas de seguridad'],
    equivalenteVirtual: {
      nombre: 'PhET Estados de la Materia y Temperatura',
      url: 'https://phet.colorado.edu/es/simulations/states-of-matter',
      offline: true,
    },
  },
  {
    slug: 'cronometro',
    name: 'Cronómetro Digital con Memoria',
    category: 'medicion',
    priority: 'P1',
    altText: 'Cronómetro digital manual para registro de tiempos de cinemática',
    aliases: ['cronometro-digital', 'timer'],
    equivalenteVirtual: {
      nombre: 'Tracker Video Analysis & Chronometer',
      url: 'https://physlets.org/tracker/',
      offline: true,
    },
  },
  {
    slug: 'mechero-lab',
    name: 'Mechero Bunsen / Lámpara de Alcohol',
    category: 'laboratorio_quimica',
    priority: 'P1',
    altText: 'Mechero de laboratorio para calentamiento y esterilización térmica',
    aliases: ['mechero-bunsen', 'lampara-alcohol'],
    eppRequerido: ['Bata de laboratorio 100% algodón', 'Gafas de seguridad', 'Cabello recogido'],
    equivalenteVirtual: {
      nombre: 'PhET Cambios Térmicos y Calorimetría',
      url: 'https://phet.colorado.edu/es/simulations/energy-forms-and-changes',
      offline: true,
    },
  },

  // ── Física, Óptica y Magnetismo ──────────────────────────────────────────
  {
    slug: 'imanes',
    name: 'Juego de Imanes Didácticos (Barra y Herradura)',
    category: 'fisica',
    priority: 'P1',
    altText: 'Imanes de neodimio y alnico con polos Norte y Sur señalizados',
    aliases: ['juego-imanes', 'iman-barra'],
    equivalenteVirtual: {
      nombre: 'PhET Imán y Brújula de Faraday',
      url: 'https://phet.colorado.edu/es/simulations/faraday',
      offline: true,
    },
  },
  {
    slug: 'lentes-opticos',
    name: 'Juego de Lentes Ópticos Convergentes y Divergentes',
    category: 'fisica',
    priority: 'P1',
    altText: 'Set de lentes esféricos y prismas para demostración de refracción de luz',
    aliases: ['lentes-geometricos', 'prismas-opticos'],
    equivalenteVirtual: {
      nombre: 'PhET Óptica Geométrica',
      url: 'https://phet.colorado.edu/es/simulations/geometric-optics',
      offline: true,
    },
  },

  // ── Matemáticas y Pensamiento Matemático ─────────────────────────────────
  {
    slug: 'geoplano',
    name: 'Geoplano Didáctico con Bandas Elásticas',
    category: 'arte',
    priority: 'P1',
    altText: 'Geoplano cuadrado y circular para modelación geométrica plana',
    aliases: ['geoplano-cuadrado', 'tablero-geometrico'],
    equivalenteVirtual: {
      nombre: 'Polypad Geoboard (Mathigon)',
      url: 'https://mathigon.org/polypad',
      offline: true,
    },
  },
  {
    slug: 'compas',
    name: 'Compás de Precisión Metálico',
    category: 'herramientas',
    priority: 'P1',
    altText: 'Compás con adaptador para trazo de circunferencias y arcos',
    aliases: ['compas-dibujo', 'compas-precision'],
    equivalenteVirtual: {
      nombre: 'GeoGebra Geometría Web',
      url: 'https://www.geogebra.org/geometry',
      offline: true,
    },
  },
  {
    slug: 'dados',
    name: 'Juego de Dados Poliédricos y Estándar',
    category: 'medicion',
    priority: 'P1',
    altText: 'Dados de 6, 10 y 20 caras para experimentos de probabilidad y estadística',
    aliases: ['dados-probabilidad', 'dados-poliedricos'],
    equivalenteVirtual: {
      nombre: 'PhET Simulación de Probabilidad',
      url: 'https://phet.colorado.edu/es/simulations/plinko-probability',
      offline: true,
    },
  },
  {
    slug: 'regla-calculo',
    name: 'Regla de Cálculo y Escalas Numéricas',
    category: 'medicion',
    priority: 'P1',
    altText: 'Regla graduada en centímetros y pulgadas con escalas de conversión',
    aliases: ['regla-graduada', 'escalimetro'],
    equivalenteVirtual: {
      nombre: 'Desmos Calculadora Gráfica',
      url: 'https://www.desmos.com/calculator',
      offline: true,
    },
  },

  // ── Cómputo, TIC y Redes ─────────────────────────────────────────────────
  {
    slug: 'pc-escritorio',
    name: 'Computadora de Escritorio / Laptop',
    category: 'computo',
    priority: 'P1',
    altText: 'Equipo de cómputo con monitor, teclado y acceso a entorno de programación',
    aliases: ['computadora', 'laptop', 'pc'],
    equivalenteVirtual: {
      nombre: 'Google Colab / VS Code for Web',
      url: 'https://vscode.dev/',
      offline: true,
    },
  },
  {
    slug: 'impresora',
    name: 'Impresora Multifuncional de Inyección / Láser',
    category: 'computo',
    priority: 'P1',
    altText: 'Impresora para material didáctico, oficios y rúbricas impresas',
    aliases: ['impresora-laser', 'impresora-tinta'],
  },
  {
    slug: 'escaner',
    name: 'Escáner Digitalizador de Documentos',
    category: 'computo',
    priority: 'P1',
    altText: 'Escáner óptico para digitalización de evidencias y proyectos escolares',
    aliases: ['escaner-optico', 'digitalizador'],
  },
  {
    slug: 'multifuncional',
    name: 'Equipo Multifuncional de Oficina (Impresora/Copia/Escáner)',
    category: 'computo',
    priority: 'P1',
    altText: 'Equipo multifuncional para administración escolar y expedientes',
    aliases: ['fotocopiadora', 'copiadora-oficina'],
  },
  {
    slug: 'cable-red',
    name: 'Cable de Red Ethernet UTP Cat 6 con Conectores RJ45',
    category: 'computo',
    priority: 'P1',
    altText: 'Cable de par trenzado UTP con conectores RJ-45 para redes LAN',
    aliases: ['cable-ethernet', 'cable-utp'],
    equivalenteVirtual: {
      nombre: 'Cisco Packet Tracer',
      url: 'https://www.netacad.com/courses/packet-tracer',
      offline: true,
    },
  },
  {
    slug: 'crimpadora-red',
    name: 'Pinza Ponchadora / Crimpadora RJ45 y Pelacables',
    category: 'herramientas',
    priority: 'P1',
    altText: 'Herramienta de crimpado para armado de cables de telecomunicaciones',
    aliases: ['ponchadora-rj45', 'crimpadora'],
    eppRequerido: ['Gafas de seguridad'],
  },
  {
    slug: 'tester-cable',
    name: 'Probador de Cables de Red (Tester RJ45 / RJ11)',
    category: 'herramientas',
    priority: 'P1',
    altText: 'Probador de continuidad y mapeo de pines para redes Ethernet',
    aliases: ['probador-red', 'tester-lan'],
  },
  {
    slug: 'desarmadores-precision',
    name: 'Juego de Destornilladores de Precisión para Electrónica',
    category: 'herramientas',
    priority: 'P1',
    altText: 'Set de desarmadores planos, Phillips y Torx para mantenimiento de equipos',
    aliases: ['destornilladores-precision', 'kit-desarmadores'],
    eppRequerido: ['Gafas de seguridad'],
  },
  {
    slug: 'arduino-kit',
    name: 'Kit de Robótica y Microcontrolador Arduino Uno',
    category: 'computo',
    priority: 'P1',
    altText: 'Placa de microcontrolador con protoboard, sensores y cables jumper',
    aliases: ['arduino-uno', 'kit-robotica'],
    equivalenteVirtual: {
      nombre: 'Tinkercad Circuits Arduino Simulator',
      url: 'https://www.tinkercad.com/circuits',
      offline: false,
    },
  },
  {
    slug: 'impresora-3d',
    name: 'Impresora 3D de Filamento (FDM)',
    category: 'computo',
    priority: 'P1',
    altText: 'Impresora 3D para prototipado rápido de piezas y modelos de ciencias',
    aliases: ['impresion-3d', 'fabricador-digital'],
    eppRequerido: ['Gafas de seguridad', 'Ventilación adecuada'],
    equivalenteVirtual: {
      nombre: 'Tinkercad 3D Design / UltiMaker Cura',
      url: 'https://www.tinkercad.com/',
      offline: true,
    },
  },

  // ── Herramientas de Taller, Electricidad y Domótica ───────────────────────
  {
    slug: 'destornilladores',
    name: 'Juego de Destornilladores con Mango Aislado',
    category: 'herramientas',
    priority: 'P1',
    altText: 'Destornilladores planos y de cruz con aislamiento dieléctrico de 1000V',
    aliases: ['desarmadores', 'destornilladores-aislados'],
    eppRequerido: ['Gafas de seguridad', 'Guantes dieléctricos'],
  },
  {
    slug: 'alicates',
    name: 'Pinzas de Electricista / Alicates Universales',
    category: 'herramientas',
    priority: 'P1',
    altText: 'Pinzas universales de corte y empalme para conductores eléctricos',
    aliases: ['pinzas-electricista', 'alicates-universales'],
    eppRequerido: ['Gafas de seguridad', 'Guantes mecánicos'],
  },
  {
    slug: 'contactos-electricos',
    name: 'Placas de Contactos Eléctricos, Apagadores y Clavijas',
    category: 'herramientas',
    priority: 'P1',
    altText: 'Material de instalación eléctrica residencial para tableros de práctica',
    aliases: ['tomacorrientes', 'placas-apagador'],
    eppRequerido: ['Gafas de seguridad', 'Desenergización obligatoria'],
    equivalenteVirtual: {
      nombre: 'Simulador de Instalaciones Eléctricas Tinkercad',
      url: 'https://www.tinkercad.com/circuits',
      offline: false,
    },
  },
  {
    slug: 'perfocel',
    name: 'Tablero Perforado (Perfocel) para Montaje Eléctrico',
    category: 'herramientas',
    priority: 'P1',
    altText: 'Tablero de perfocel con bastidor para montaje de circuitos y domótica',
    aliases: ['tablero-practicas', 'panel-perfocel'],
    eppRequerido: ['Gafas de seguridad'],
  },

  // ── Agropecuario, Huerto y Medio Ambiente ────────────────────────────────
  {
    slug: 'huerto-semillero',
    name: 'Semillero y Charolas de Germinación Agroecológica',
    category: 'agro',
    priority: 'P1',
    altText: 'Charolas alveoladas de germinación para semillas de hortalizas',
    aliases: ['charola-germinacion', 'semillero-hortalizas'],
    eppRequerido: ['Guantes de jardinería'],
  },
  {
    slug: 'herramienta-jardin',
    name: 'Kit de Herramientas de Jardinería y Cultivo (Palas, Rastrillo)',
    category: 'agro',
    priority: 'P1',
    altText: 'Juego de herramientas manuales de labranza y trasplante para huertos',
    aliases: ['pala-jardineria', 'rastrillo-manual'],
    eppRequerido: ['Guantes de jardinería', 'Calzado cerrado'],
  },

  // ── Alimentos, Repostería y Nutrición ────────────────────────────────────
  {
    slug: 'horno-reposteria',
    name: 'Horno de Convección / Estufa de Cocina',
    category: 'laboratorio_quimica',
    priority: 'P1',
    altText: 'Horno con control de temperatura para panificación y conservación',
    aliases: ['horno-cocina', 'estufa-alimentos'],
    eppRequerido: ['Mandil de cocina', 'Guantes térmicos', 'Cofia'],
  },
  {
    slug: 'batidora',
    name: 'Batidora de Pedestal / Manual de Alimentos',
    category: 'laboratorio_quimica',
    priority: 'P1',
    altText: 'Batidora eléctrica para preparación de masas y emulsiones',
    aliases: ['batidora-electrica', 'mezcladora-alimentos'],
    eppRequerido: ['Cofia', 'Mandil'],
  },
  {
    slug: 'tabla-cortar',
    name: 'Tabla de Picar de Polietileno Grado Alimenticio',
    category: 'laboratorio_quimica',
    priority: 'P1',
    altText: 'Tabla higiénica de polietileno para corte seguro de materias primas',
    aliases: ['tabla-picar', 'tabla-polietileno'],
    eppRequerido: ['Mandil', 'Guantes higiénicos'],
  },

  // ── Dibujo Técnico y Diseño Gráfico ──────────────────────────────────────
  {
    slug: 'mesa-dibujo',
    name: 'Tablero de Dibujo Técnico y Regla T',
    category: 'arte',
    priority: 'P1',
    altText: 'Restirador portátil con regla paralela para trazo arquitectónico y vistas',
    aliases: ['tablero-dibujo', 'restirador-dibujo'],
    equivalenteVirtual: {
      nombre: 'LibreCAD / QCAD 2D',
      url: 'https://librecad.org/',
      offline: true,
    },
  },
  {
    slug: 'escuadras',
    name: 'Juego de Escuadras Profesionales (30°/60° y 45°)',
    category: 'arte',
    priority: 'P1',
    altText: 'Escuadras de acrílico sin bisel para dibujo técnico geométrico',
    aliases: ['juego-escuadras', 'escuadra-cartabon'],
    equivalenteVirtual: {
      nombre: 'GeoGebra Suite Geométrica',
      url: 'https://www.geogebra.org/geometry',
      offline: true,
    },
  },
  {
    slug: 'tablet-grafica',
    name: 'Tableta Digitalizadora con Lápiz Sensible a la Presión',
    category: 'computo',
    priority: 'P1',
    altText: 'Tableta gráfica digitalizadora USB para ilustración y diseño asistido',
    aliases: ['tableta-digitalizadora', 'pen-tablet'],
    equivalenteVirtual: {
      nombre: 'Photopea / Krita / Inkscape',
      url: 'https://www.photopea.com/',
      offline: false,
    },
  },

  // ── Lengua, Comunicación, Sonido y Audio ─────────────────────────────────
  {
    slug: 'micfono-usb',
    name: 'Micrófono de Condensador USB con Filtro Antipop',
    category: 'computo',
    priority: 'P1',
    altText: 'Micrófono USB para grabación de podcasts, entrevistas y debates orales',
    aliases: ['microfono-condensador', 'microfono-podcast'],
    equivalenteVirtual: {
      nombre: 'Audacity / BandLab Audio Studio',
      url: 'https://www.bandlab.com/',
      offline: true,
    },
  },
  {
    slug: 'audifonos',
    name: 'Audífonos de Diadema Aislantes de Ruido',
    category: 'computo',
    priority: 'P1',
    altText: 'Auriculares estéreo para laboratorio de idiomas y edición de audio',
    aliases: ['auriculares', 'diadema-audio'],
  },
  {
    slug: 'tarjetas-vocabulario',
    name: 'Tarjetas Didácticas y Fichas de Léxico (Flashcards)',
    category: 'arte',
    priority: 'P1',
    altText: 'Tarjetas impresas de vocabulario en inglés y raíces etimológicas',
    aliases: ['flashcards', 'fichas-lexicas'],
    equivalenteVirtual: {
      nombre: 'Quizlet / Anki Web Flashcards',
      url: 'https://quizlet.com/',
      offline: false,
    },
  },

  // ── Ciencias Sociales, Territorio y Campo ────────────────────────────────
  {
    slug: 'mapa-zona',
    name: 'Plano Cartográfico Municipal y Regional Impreso',
    category: 'medicion',
    priority: 'P1',
    altText: 'Mapa cartográfico del sector escolar con división comunitaria y relieve',
    aliases: ['mapa-territorial', 'croquis-comunitario'],
    equivalenteVirtual: {
      nombre: 'INEGI Mapa Digital de México / Google Earth',
      url: 'https://www.inegi.org.mx/app/mapa/espacioydatos/',
      offline: false,
    },
  },
  {
    slug: 'cuaderno-campo',
    name: 'Cuaderno y Bitácora de Registro de Campo',
    category: 'medicion',
    priority: 'P1',
    altText: 'Libreta de notas de campo para entrevistas comunitarias y observación',
    aliases: ['bitacora-campo', 'diario-campo'],
  },

  // ── Arte, Deporte y Expresión Socioemocional ─────────────────────────────
  {
    slug: 'material-arte',
    name: 'Kit de Materiales Artísticos (Pinturas, Pinceles, Lienzos)',
    category: 'arte',
    priority: 'P1',
    altText: 'Set de acuarelas, acrílicos, pinceles planos y cartulinas de ilustración',
    aliases: ['kit-pintura', 'pinceles-arte'],
    equivalenteVirtual: {
      nombre: 'Sketchpad / AutoDraw',
      url: 'https://sketch.io/sketchpad/',
      offline: false,
    },
  },
  {
    slug: 'balon',
    name: 'Balones Deportivos Reglamentarios (Básquetbol, Voleibol, Fútbol)',
    category: 'deportivo',
    priority: 'P1',
    altText: 'Balón oficial para activación física, torneos y hábitos saludables',
    aliases: ['balon-futbol', 'balon-basquetbol', 'pelota-deportiva'],
  },
  {
    slug: 'conos',
    name: 'Juego de Conos y Marcadores de Circuito Deportivo',
    category: 'deportivo',
    priority: 'P1',
    altText: 'Conos plásticos de delimitación de circuitos y pruebas de agilidad motriz',
    aliases: ['conos-entrenamiento', 'conos-deportivos'],
  },
];

const CATALOG_BY_SLUG = new Map<string, MaterialCatalogItem>(
  MATERIALES_CATALOG.map((item) => [item.slug, item])
);

// Mapeo inverso de alias a slug principal (soporta variantes con y sin tildes)
const ALIAS_TO_SLUG = new Map<string, string>();
for (const item of MATERIALES_CATALOG) {
  if (item.aliases) {
    for (const alias of item.aliases) {
      const lower = alias.toLowerCase();
      ALIAS_TO_SLUG.set(lower, item.slug);
      const unaccented = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      ALIAS_TO_SLUG.set(unaccented, item.slug);
    }
  }
}

/**
 * Busca un material por su slug exacto o por cualquiera de sus alias registrados.
 */
export function getMaterial(slugOrAlias: string): MaterialCatalogItem | undefined {
  if (!slugOrAlias) return undefined;
  const normalized = slugOrAlias.trim().toLowerCase();
  const direct = CATALOG_BY_SLUG.get(normalized);
  if (direct) return direct;
  const unaccented = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const canonicalSlug = ALIAS_TO_SLUG.get(normalized) || ALIAS_TO_SLUG.get(unaccented);
  return canonicalSlug ? CATALOG_BY_SLUG.get(canonicalSlug) : undefined;
}

/**
 * Deriva las rutas de assets de imagen para un slug dado (D3).
 */
export function getMaterialImagePaths(slug: string): { png: string; placeholder: string } {
  const cleanSlug = slug.trim().toLowerCase();
  return {
    png: `/images/materiales/${cleanSlug}.png`,
    placeholder: '/images/materiales/_placeholder.png',
  };
}
