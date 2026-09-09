/**
 * Utilidades para la estructura de grupos por año/grado y asignaturas oficiales del MCCEMS 2025-2026
 */
import {
  CARRERAS_TECNOLOGICAS,
  getModulosPorSemestre,
  CarreraTecnica,
  ModuloCarrera
} from "./bt-carreras-catalog";

export interface EscuelaEstructuraGrupos {
  gruposPrimerAno: number;   // 1er Año (1º o 2º Semestre)
  gruposSegundoAno: number;  // 2º Año (3º o 4º Semestre)
  gruposTercerAno: number;   // 3er Año (5º o 6º Semestre)
}

export interface GrupoDefinicion {
  id: string;
  nombre: string;         // Ej: "1° A", "3° A", "5° A"
  semestre: number;       // 1, 2, 3, 4, 5, 6
  gradoAno: number;       // 1, 2, 3
  letra: string;          // "A", "B", "C"...
}

const LETRAS_GRUPO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

/**
 * 15 Capacitaciones Laborales Oficiales BGE Puebla (MCCEMS 2025-2026)
 */
export const FORMACIONES_LABORALES = [
  "Administracion",
  "Agricultura Sostenible de Traspatio",
  "Area de la Salud",
  "Comunicacion Grafica",
  "Contabilidad",
  "Domotica",
  "Instalaciones Residenciales",
  "Mecanica Dental",
  "Preparacion de Alimentos Artesanales",
  "Procesos Culinarios y Reposteria",
  "Redes y Mantenimiento",
  "Servicios Ecosistemicos",
  "Sistemas Electricos",
  "Tecnologia Informatica",
  "Turismo"
];

/**
 * Mapeo oficial de Nombres de Submódulos por Capacitación Laboral
 */
export const UACS_LABORALES_MAPA: Record<string, {
  sem3: { name: string; abrev: string }[];
  sem4: { name: string; abrev: string }[];
  sem5: { name: string; abrev: string }[];
  sem6: { name: string; abrev: string }[];
}> = {
  "Administración": {
    sem3: [
      { name: "Entrega recursos materiales a otras áreas de una organización", abrev: "ENTR-REC" },
      { name: "Organiza recursos materiales a solicitud de un superior", abrev: "ORG-REC" }
    ],
    sem4: [
      { name: "Captura información solicitada por un superior", abrev: "CAPT-INFO" },
      { name: "Registra entrada y salida del personal de una organización", abrev: "REG-PERS" }
    ],
    sem5: [
      { name: "Elabora trámites administrativos básicos de una organización", abrev: "TRAM-ADM" },
      { name: "Organiza expedientes y documentación interna de las diferentes áreas de una organización", abrev: "ORG-EXP" }
    ],
    sem6: [
      { name: "Proporciona información detallada y condiciones de venta de bienes y servicios", abrev: "INFO-VTA" },
      { name: "Realiza ventas de bienes y servicios al público en general", abrev: "VTA-PUB" }
    ]
  },
  "Agricultura Sostenible de Traspatio": {
    sem3: [
      { name: "Construye huerto para la producción agrícola sostenible de traspatio", abrev: "CONST-HUERTO" },
      { name: "Planea huerto para la producción agrícola sostenible de traspatio", abrev: "PLAN-HUERTO" }
    ],
    sem4: [
      { name: "Aplica manejo agroecológico en el sistema en el huerto de traspatio", abrev: "MAN-AGROE" },
      { name: "Reconoce sistemas de producción y manejo agroecológico en el huerto de traspatio", abrev: "REC-AGROE" }
    ],
    sem5: [
      { name: "Aplica técnicas agroecológicas de conservación de suelo y agua, y de control de plagas y enfermedades", abrev: "TECN-AGROE" },
      { name: "Distingue técnicas agroecológicas de conservación de suelo y agua y de control de plagas y enfermedades", abrev: "DIST-AGROE" }
    ],
    sem6: [
      { name: "Identifica manejo de la biodiversidad y su contribución a la soberanía alimentaria y el desarrollo sostenible", abrev: "BIODIV-SOB" },
      { name: "Promueve prácticas agroecológicas, redes alimentarias y económicas alternativas para contribuir a la soberanía alimentaria y el desarrollo sostenible", abrev: "PRAC-AGROE" }
    ]
  },
  "Área de la Salud": {
    sem3: [
      { name: "Despacha medicamentos y material de curación de acuerdo con prescripciones médicas y productos farmacéuticos", abrev: "DESP-MED" },
      { name: "Lleva registro de recetas, inventarios de medicamentos y productos farmacéuticos", abrev: "REG-RECET" }
    ],
    sem4: [
      { name: "Ordena las existencias de medicamentos en estantes y anaqueles", abrev: "ORD-MED" },
      { name: "Participa en la preparación de medicamentos y otros compuestos bajo supervisión profesional químico farmacéutico", abrev: "PREP-MED" }
    ],
    sem5: [
      { name: "Asiste especialistas del área en las necesidades del paciente", abrev: "ASIST-PAC" },
      { name: "Asiste especialistas del área en las necesidades del paciente diagnosticado", abrev: "ASIST-DIAG" }
    ],
    sem6: [
      { name: "Lava, empaqueta y esteriliza el material e instrumental utilizado en las distintas áreas del sector salud", abrev: "ESTERIL-MAT" },
      { name: "Realiza diferentes actividades administrativas solicitadas", abrev: "ACT-ADM" }
    ]
  },
  "Comunicación Gráfica": {
    sem3: [
      { name: "Elabora bocetos gráficos comprensibles y creativos a partir de las necesidades de comunicación gráfica requerida", abrev: "BOC-GRAF" },
      { name: "Ilustra dibujos en materiales artesanales o artísticos", abrev: "ILUS-DIB" }
    ],
    sem4: [
      { name: "Reproduce bocetos gráficos básicos utilizando herramientas tradicionales o digitales", abrev: "REP-BOC" },
      { name: "Utilizar elementos de comunicación visual y fuentes tipográficas para resolver problemas y necesidades de comunicación", abrev: "ELEM-VIS" }
    ],
    sem5: [
      { name: "Integra efectos visuales a imágenes y textos por medio de software o aplicaciones digitales de uso libre", abrev: "EFEC-VIS" },
      { name: "Utiliza técnicas de impresión para los diversos productos gráficos, artesanales, artísticos y publicitarios", abrev: "TECN-IMP" }
    ],
    sem6: [
      { name: "Emplea materiales amigables con el medio ambiente para productos gráficos, artísticos y publicitarios", abrev: "MAT-AMIG" },
      { name: "Realiza maquetación de productos gráficos para publicidad y rotulación", abrev: "MAQ-GRAF" }
    ]
  },
  "Contabilidad": {
    sem3: [
      { name: "Opera programas de cómputo para efectuar el registro, cálculo, control y análisis de la información contable", abrev: "PROG-CONT" },
      { name: "Registra movimientos contables de una entidad económica, con base en documentos fuente", abrev: "REG-MOV" }
    ],
    sem4: [
      { name: "Realiza cálculos básicos para los informes financieros y contables, para su revisión", abrev: "CALC-FIN" },
      { name: "Registra información para el pago de obligaciones, comerciales, laborales y fiscales", abrev: "REG-OBLIG" }
    ],
    sem5: [
      { name: "Realiza reportes básicos previos a los estados financieros", abrev: "REP-FIN" },
      { name: "Registra compras y ventas del sector comercial", abrev: "REG-COMP" }
    ],
    sem6: [
      { name: "Organiza información para la elaboración de estados financieros básicos", abrev: "ORG-EST-FIN" },
      { name: "Registra información que ayude al cálculo de impuestos del contribuyente", abrev: "CALC-IMP" }
    ]
  },
  "Domótica": {
    sem3: [
      { name: "Separa componentes electrónicos y mecánicos de uso doméstico y comercial", abrev: "COMP-ELEC" },
      { name: "Separa componentes eléctricos y domóticos de uso doméstico y comercial", abrev: "COMP-DOM" }
    ],
    sem4: [
      { name: "Ensambla componentes electrónicos y domóticos para uso doméstico y comercial", abrev: "ENS-DOM" },
      { name: "Simula circuitos electrónicos y domóticos para instalaciones domésticas y comerciales", abrev: "SIM-DOM" }
    ],
    sem5: [
      { name: "Asiste instalaciones de equipo de automatización y control para uso residencial y comercial", abrev: "ASIST-AUTO" },
      { name: "Opera equipo domótico en instalaciones residenciales y comerciales, bajo supervisión", abrev: "OP-DOM" }
    ],
    sem6: [
      { name: "Aplica mantenimiento a equipo domótico residencial y comercial con supervisión de expertos", abrev: "MANT-DOM" },
      { name: "Auxilia fabricación de equipo domótico para uso residencial y comercial", abrev: "FAB-DOM" }
    ]
  },
  "Instalaciones Residenciales": {
    sem3: [
      { name: "Interpreta croquis de diferentes instalaciones básicas de una vivienda", abrev: "INTERP-CROQ" },
      { name: "Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto", abrev: "PREP-MEZC" }
    ],
    sem4: [
      { name: "Realiza cortes, ranuras en pisos, techos y muros en construcción e instalaciones residenciales", abrev: "CORTE-INST" },
      { name: "Traslada materiales constructivos hacia sitios de trabajo bajo normas de seguridad", abrev: "TRASL-MAT" }
    ],
    sem5: [
      { name: "Coloca elementos constructivos básicos de una vivienda", abrev: "ELEM-CONST" },
      { name: "Limpia muebles, tuberías y conexiones para llevar a cabo diferentes instalaciones de una vivienda", abrev: "LIMP-TUB" }
    ],
    sem6: [
      { name: "Coloca muebles, tuberías y conexiones de acuerdo con instrucciones", abrev: "COL-TUB" },
      { name: "Recupera materiales de construcción para su reuso", abrev: "REC-MAT" }
    ]
  },
  "Mecánica Dental": {
    sem3: [
      { name: "Prepara modelos, moldes, porta impresiones, bloques o rodillos para realizar impresiones dentales parciales o totales", abrev: "PREP-MOLD" },
      { name: "Registra órdenes de trabajo siguiendo especificaciones y prescripciones para dispositivos y aparatos dentales", abrev: "REG-ORD" }
    ],
    sem4: [
      { name: "Prepara prótesis dentales fijas y removibles para el proceso de encerado", abrev: "PREP-PROT" },
      { name: "Realiza actividades de colado de modelos protésicos calcinables con el fin de fabricar prótesis dentales", abrev: "COL-PROT" }
    ],
    sem5: [
      { name: "Modela alambres de diversos calibres para casos de aparatología ortodóntica", abrev: "MOD-ALAMB" },
      { name: "Realiza perfilado para prótesis dentales fijas y removibles", abrev: "PERF-PROT" }
    ],
    sem6: [
      { name: "Apoya actividades de diseño de prótesis y aparatología dental de acuerdo con la prescripción médicoodontológica", abrev: "DIS-PROT" },
      { name: "Repara aparatos ortopédicos y protésicos mediante herramientas manuales bajo la supervisión del experto", abrev: "REP-ORTO" }
    ]
  },
  "Preparación de Alimentos Artesanales": {
    sem3: [
      { name: "Conserva frutas, verduras y legumbres a través de métodos tradicionales", abrev: "CONS-FRUT" },
      { name: "Transforma cereales y harinas para la elaboración de tortillas y productos afines", abrev: "TRANS-CER" }
    ],
    sem4: [
      { name: "Elabora productos utilizando azúcar para preparar dulces típicos", abrev: "DULC-TIP" },
      { name: "Realiza distintos tipos de pan a base de harinas y otros ingredientes", abrev: "PAN-ART" }
    ],
    sem5: [
      { name: "Obtiene bebidas no alcohólicas mediante procedimientos simples", abrev: "OBT-BEB" },
      { name: "Prepara productos de carnes, derivados disponibles y sustitutos de proteína", abrev: "PREP-CARN" }
    ],
    sem6: [
      { name: "Elabora productos lácteos por métodos tradicionales", abrev: "PROD-LACT" },
      { name: "Realiza productos utilizando aceites, grasas y condimentos a través de métodos tradicionales", abrev: "PROD-ACEIT" }
    ]
  },
  "Procesos Culinarios y Repostería": {
    sem3: [
      { name: "Elabora productos de panificación siguiendo procesos establecidos", abrev: "PROD-PAN" },
      { name: "Emplea productos, utensilios y conceptos culinarios durante el proceso de transformación de alimentos", abrev: "TRANS-ALIM" }
    ],
    sem4: [
      { name: "Elabora platillos aplicando normas de calidad e higiene", abrev: "PLAT-HIG" },
      { name: "Elabora productos de repostería aplicando procesos establecidos", abrev: "REPOST-PROC" }
    ],
    sem5: [
      { name: "Determina costos de producción en la elaboración de platillos", abrev: "COST-PLAT" },
      { name: "Prepara banquetes y servicios gastronómicos para eventos especiales", abrev: "BANQ-SERV" }
    ],
    sem6: [
      { name: "Elabora productos culinarios nacionales en establecimientos de alimentos", abrev: "CULIN-NAC" },
      { name: "Diseña y comercializa menús y servicios gastronómicos sustentables", abrev: "MENU-SUST" }
    ]
  },
  "Redes y Mantenimiento": {
    sem3: [
      { name: "Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante", abrev: "ACT-EQUIP" },
      { name: "Usa técnicas y estrategias de mantenimiento del equipo de cómputo", abrev: "MANT-COMP" }
    ],
    sem4: [
      { name: "Establece seguridad informática en equipos de cómputo", abrev: "SEG-COMP" },
      { name: "Planea infraestructura de red internet e intranet en un entorno con supervisión del experto", abrev: "PLAN-RED" }
    ],
    sem5: [
      { name: "Administra redes de acuerdo con las condiciones y requerimientos de una organización", abrev: "ADM-REDES" },
      { name: "Brinda soporte en software de aplicación y hardware según los requerimientos del usuario", abrev: "SOP-SOFT" }
    ],
    sem6: [
      { name: "Asesora sobre directrices de seguridad en redes y equipos de cómputo a usuarios", abrev: "ASES-SEG" },
      { name: "Ofrece soporte en software de aplicación y hardware según los requerimientos del usuario", abrev: "SOP-USUR" }
    ]
  },
  "Servicios Ecosistémicos": {
    sem3: [
      { name: "Aplica técnicas de muestreo indicadas por el especialista", abrev: "TECN-MUEST" },
      { name: "Recopila muestras para las pruebas de niveles de contaminantes con guía del especialista", abrev: "RECOP-MUEST" }
    ],
    sem4: [
      { name: "Aplica técnicas de muestreo de agua dulce indicadas por el especialista", abrev: "MUEST-AGUA" },
      { name: "Aplica técnicas para el aprovechamiento del agua", abrev: "APROV-AGUA" }
    ],
    sem5: [
      { name: "Aplica técnicas para la siembra de diversas semillas forestales bajo supervisión", abrev: "SIEMB-FOR" },
      { name: "Realiza pruebas de suelos y fertilizantes para el mantenimiento del ecosistema forestal", abrev: "PRUEB-SUEL" }
    ],
    sem6: [
      { name: "Elabora informe final de resultados de las pruebas bajo supervisión del especialista", abrev: "INF-PRUEB" },
      { name: "Elabora presentación de resultados para su difusión bajo supervisión del especialista", abrev: "PRES-DIFUS" }
    ]
  },
  "Sistemas Eléctricos": {
    sem3: [
      { name: "Elabora empalmes acordes con las características de los hilos", abrev: "ELAB-EMP" },
      { name: "Limpia áreas de trabajo, equipo, materiales y herramientas utilizadas durante la actividad", abrev: "LIMP-HERR" }
    ],
    sem4: [
      { name: "Calcula voltaje de un sistema eléctrico empleando equipos de medición, la ley de Ohm y las leyes de Kirchhoff", abrev: "CALC-VOLT" },
      { name: "Manipula sistemas eléctricos en componentes o aparatos siguiendo las fichas técnicas", abrev: "MANIP-SIST" }
    ],
    sem5: [
      { name: "Ensambla componentes sobre tableros en perfocel para circuitos eléctricos básicos", abrev: "ENS-PERF" },
      { name: "Reconoce planos de sistemas eléctricos en servicios domésticos y comerciales", abrev: "PLAN-ELEC" }
    ],
    sem6: [
      { name: "Conoce el funcionamiento y clasificación de aparatos domésticos que incluyan motores universales y utiliza equipos de medición para realizar el diagnóstico", abrev: "DIAG-APAR" },
      { name: "Realiza servicio preventivo a aparatos domésticos y en los sistemas eléctricos con supervisión del experto", abrev: "SERV-PREV" }
    ]
  },
  "Tecnología Informática": {
    sem3: [
      { name: "Elabora documentos electrónicos en diferentes procesadores de texto, relacionados con la ofimática", abrev: "DOC-OFIM" },
      { name: "Utiliza aplicaciones ofimáticas en distintos sistemas operativos", abrev: "APL-OFIM" }
    ],
    sem4: [
      { name: "Elabora libros electrónicos en hojas de cálculo, relacionados con la ofimática", abrev: "HOJA-OFIM" },
      { name: "Opera dispositivos de hardware y software para resguardo de información", abrev: "RESG-INFO" }
    ],
    sem5: [
      { name: "Elabora presentaciones electrónicas en diferentes aplicaciones relacionadas con la ofimática", abrev: "PRES-OFIM" },
      { name: "Opera dispositivos electrónicos multifuncionales en procesos administrativos", abrev: "OP-MULTIF" }
    ],
    sem6: [
      { name: "Maneja softwares de aplicación para comunicación síncrona y asíncrona", abrev: "SOFT-COM" },
      { name: "Utiliza navegadores web en distintas plataformas digitales con propósitos administrativos", abrev: "NAV-WEB" }
    ]
  },
  "Turismo": {
    sem3: [
      { name: "Explica procesos de expedición de documentos oficiales en las instituciones gubernamentales correspondientes para transitar o viajar", abrev: "DOC-TUR" },
      { name: "Muestra variedad de servicios que componen el catálogo de la planta turística", abrev: "SERV-TUR" }
    ],
    sem4: [
      { name: "Recomienda planes turísticos de interés, diversión y esparcimiento de mayor ocupación nacional e internacional", abrev: "PLAN-TUR" },
      { name: "Utiliza aparatos digitales o análogos para reservar y contratar servicios turísticos", abrev: "RESV-TUR" }
    ],
    sem5: [
      { name: "Asiste usuarios en la selección, adquisición y utilización eficiente de servicios turísticos requeridos", abrev: "ASIST-TUR" },
      { name: "Promociona sitios alternativos de lugares a visitar según necesidades del turista", abrev: "PROM-TUR" }
    ],
    sem6: [
      { name: "Planea paquetes turísticos personalizados según necesidades del turista", abrev: "PAQ-TUR" },
      { name: "Propone actividades específicas al usuario, según el catálogo turístico vigente", abrev: "ACT-TUR" }
    ]
  }
};

// Alias sin acentos para compatibilidad retroactiva total
UACS_LABORALES_MAPA["Administracion"] = UACS_LABORALES_MAPA["Administración"];
UACS_LABORALES_MAPA["Area de la Salud"] = UACS_LABORALES_MAPA["Área de la Salud"];
UACS_LABORALES_MAPA["Comunicacion Grafica"] = UACS_LABORALES_MAPA["Comunicación Gráfica"];
UACS_LABORALES_MAPA["Domotica"] = UACS_LABORALES_MAPA["Domótica"];
UACS_LABORALES_MAPA["Mecanica Dental"] = UACS_LABORALES_MAPA["Mecánica Dental"];
UACS_LABORALES_MAPA["Preparacion de Alimentos Artesanales"] = UACS_LABORALES_MAPA["Preparación de Alimentos Artesanales"];
UACS_LABORALES_MAPA["Procesos Culinarios y Reposteria"] = UACS_LABORALES_MAPA["Procesos Culinarios y Repostería"];
UACS_LABORALES_MAPA["Servicios Ecosistemicos"] = UACS_LABORALES_MAPA["Servicios Ecosistémicos"];
UACS_LABORALES_MAPA["Sistemas Electricos"] = UACS_LABORALES_MAPA["Sistemas Eléctricos"];
UACS_LABORALES_MAPA["Tecnologia Informatica"] = UACS_LABORALES_MAPA["Tecnología Informática"];

/**
 * Optativas FFE Categorizadas por Cuadros (MCCEMS 2025-2026 Puebla)
 */
export const FFE_RECURSOS_SOCIOCOGNITIVOS = [
  "Comunicación y Sociedad I",
  "Raíces Etimológicas del Español I",
  "Inglés V (Avanzado)",
  "Taller de Pensamiento Variacional I",
  "Dibujo Técnico I",
  "Pensamiento Matemático Aplicado a las Finanzas I",
  "Taller de Probabilidad y Estadística I"
];

export const FFE_AREAS_CONOCIMIENTO = [
  "Salud Integral I",
  "Análisis de Fenómenos y Procesos Biológicos",
  "Análisis de Fenómenos Físicos I",
  "Organización del Flujo de Materia y Energía en los Organismos I",
  "Fundamentos de Administración I",
  "Procesos Contables I",
  "Derecho y Sociedad I",
  "Economía I. La Función de los Agentes Económicos en la Sociedad",
  "Temas Selectos de Ciencias Sociales I",
  "Psicología I",
  "Arte y Cultura I",
  "Lógica y Pensamiento Crítico",
  "Pensamiento Filosófico I"
];

/**
 * Mapeo Oficial de Continuidad de Asignaturas FFE (5.º Semestre -> 6.º Semestre)
 * Según documento normativo oficial "FFE 2025-2026.pdf"
 */
export const FFE_CONTINUIDAD_5_A_6: Record<string, string> = {
  // Recursos Sociocognitivos - Lengua y Comunicación
  "Comunicación y Sociedad I": "Comunicación y Sociedad II",
  "Raíces Etimológicas del Español I": "Raíces Etimológicas del Español II",
  "Inglés V (Avanzado)": "Inglés VI (Avanzado)",
  "Inglés V": "Inglés VI",

  // Recursos Sociocognitivos - Pensamiento Matemático
  "Taller de Pensamiento Variacional I": "Taller de Pensamiento Variacional II",
  "Dibujo Técnico I": "Dibujo Técnico II",
  "Pensamiento Matemático Aplicado a las Finanzas I": "Pensamiento Matemático Aplicado a las Finanzas II",
  "Taller de Probabilidad y Estadística I": "Taller de Probabilidad y Estadística II",

  // Áreas de Conocimiento - Ciencias Naturales, Experimentales y Tecnología
  "Salud Integral I": "Salud Integral II",
  "Análisis de Fenómenos y Procesos Biológicos": "Temas Selectos de Biología",
  "Análisis de Fenómenos Físicos I": "Análisis de Fenómenos Físicos II",
  "Organización del Flujo de Materia y Energía en los Organismos I": "Organización del Flujo de Materia en los Organismos II",

  // Áreas de Conocimiento - Ciencias Sociales
  "Fundamentos de Administración I": "Fundamentos de Administración II",
  "Procesos Contables I": "Procesos Contables II",
  "Derecho y Sociedad I": "Derecho y Sociedad II",
  "Economía I. La Función de los Agentes Económicos en la Sociedad": "Economía II. Política Económica y Política Pública Mexicana",
  "Temas Selectos de Ciencias Sociales I": "Temas Selectos de Ciencias Sociales II",
  "Psicología I": "Psicología II",

  // Áreas de Conocimiento - Humanidades
  "Arte y Cultura I": "Arte y Cultura II",
  "Lógica y Pensamiento Crítico": "Experiencia Estética",
  "Pensamiento Filosófico I": "Pensamiento Filosófico II"
};

/**
 * Obtiene el nombre de la asignatura continuadora en 6.º semestre a partir de la de 5.º
 */
export function obtenerFfeSemestre6(nombreSem5: string): string {
  if (!nombreSem5) return "Optativa FFE II";
  return FFE_CONTINUIDAD_5_A_6[nombreSem5] || nombreSem5.replace(/ I$/, " II");
}

/**
 * Catálogo Oficial Completo de Optativas FFE MCCEMS 2025-2026
 */
export const FFE_OPTATIVAS_CATALOGO = [
  ...FFE_RECURSOS_SOCIOCOGNITIVOS,
  ...FFE_AREAS_CONOCIMIENTO
];

/**
 * Genera la lista de grupos oficiales de una escuela basándose en su estructura (ej: 2-1-1)
 */
export function generarGruposPorEstructura(
  escuela: { gruposPrimerAno?: number; gruposSegundoAno?: number; gruposTercerAno?: number },
  periodoSemestral: "SEMESTRE_A" | "SEMESTRE_B" = "SEMESTRE_A"
): GrupoDefinicion[] {
  const g1 = Math.max(1, escuela.gruposPrimerAno ?? 1);
  const g2 = Math.max(1, escuela.gruposSegundoAno ?? 1);
  const g3 = Math.max(1, escuela.gruposTercerAno ?? 1);

  const grupos: GrupoDefinicion[] = [];
  const semestres = periodoSemestral === "SEMESTRE_A" ? [1, 3, 5] : [2, 4, 6];

  for (let i = 0; i < g1; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    grupos.push({ id: `g-${semestres[0]}-${letra}`, nombre: `${semestres[0]}° ${letra}`, semestre: semestres[0], gradoAno: 1, letra });
  }

  for (let i = 0; i < g2; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    grupos.push({ id: `g-${semestres[1]}-${letra}`, nombre: `${semestres[1]}° ${letra}`, semestre: semestres[1], gradoAno: 2, letra });
  }

  for (let i = 0; i < g3; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    grupos.push({ id: `g-${semestres[2]}-${letra}`, nombre: `${semestres[2]}° ${letra}`, semestre: semestres[2], gradoAno: 3, letra });
  }

  return grupos;
}

/**
 * Catálogo Oficial Nombres Exactos de Formación Socioemocional (Currículum Ampliado / FFEO)
 * Nombres oficiales según MCCEMS BGE Puebla:
 * 1. Educación para la Salud
 * 2. Educación Integral en Sexualidad y Género
 * 3. Práctica y Colaboración Ciudadana
 */
export const FORMACIONES_SOCIOEMOCIONALES = [
  "Educación para la Salud",
  "Educación Integral en Sexualidad y Género",
  "Práctica y Colaboración Ciudadana"
];

/**
 * Calcula la Formación Socioemocional exacta para cada semestre de un grupo (3º, 4º, 5º, 6º)
 * Reglas Estrictas:
 * - 3.er Semestre: Selección del Director (Opción 1). NUNCA se repite en 4.º, 5.º ni 6.º.
 * - 5.º Semestre: Selección del Director entre las 2 restantes (Opción 2). NUNCA se repite en 3.er, 4.º ni 6.º.
 * - 4.º y 6.º Semestre: Asignación automática de la 3.ª opción restante (Opción 3). 4.º y 6.º llevan EXACTAMENTE la misma asignatura.
 */
export function resolverSocioemocionalGrupo(
  socioemocionalSem3?: string,
  socioemocionalSem5?: string
): { sem3: string; sem4: string; sem5: string; sem6: string } {
  let s3: string;
  let s5: string;

  if (socioemocionalSem3 && socioemocionalSem5) {
    s3 = socioemocionalSem3;
    s5 = socioemocionalSem5 === socioemocionalSem3
      ? (FORMACIONES_SOCIOEMOCIONALES.find(s => s !== socioemocionalSem3) || FORMACIONES_SOCIOEMOCIONALES[1])
      : socioemocionalSem5;
  } else if (socioemocionalSem3 && !socioemocionalSem5) {
    s3 = socioemocionalSem3;
    s5 = FORMACIONES_SOCIOEMOCIONALES.find(s => s !== socioemocionalSem3) || FORMACIONES_SOCIOEMOCIONALES[1];
  } else if (!socioemocionalSem3 && socioemocionalSem5) {
    s5 = socioemocionalSem5;
    s3 = FORMACIONES_SOCIOEMOCIONALES.find(s => s !== socioemocionalSem5) || FORMACIONES_SOCIOEMOCIONALES[0];
  } else {
    s3 = FORMACIONES_SOCIOEMOCIONALES[0];
    s5 = FORMACIONES_SOCIOEMOCIONALES[1];
  }

  const restanteParaSem4y6 = FORMACIONES_SOCIOEMOCIONALES.find(s => s !== s3 && s !== s5) || FORMACIONES_SOCIOEMOCIONALES[2];

  return {
    sem3: s3,
    sem4: restanteParaSem4y6,
    sem5: s5,
    sem6: restanteParaSem4y6
  };
}

/**
 * Resuelve las Asignaturas/UACs oficiales exactas para un Grupo según su Semestre y Capacitaciones
 */
export function obtenerAsignaturasParaGrupo(
  semestre: number,
  capacitacionNombre: string = "Administracion",
  ffeOptativasArr: string[] = [],
  ffeoSocioemocional?: string
): { nombre: string; tipo: "FUNDAMENTAL" | "LABORAL" | "EXTENDIDO" | "SOCIOEMOCIONAL"; horas: number }[] {

  if (semestre === 1) {
    // 1.er Semestre 2026-2027: 8 asignaturas activas (25 horas totales)
    // Se ocultan LAB-INV (3 hrs) y ART-CULT-I (2 hrs) según nuevas indicaciones SEP
    return [
      { nombre: "Ciencias Naturales, Experimentales y Tecnología I", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático I", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades I", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Lenguaje y Comunicación I", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés I", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Cultura Digital I", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Ciencias Sociales I", tipo: "FUNDAMENTAL", horas: 2 },
      { nombre: "Actividades Físicas y Deportivas I", tipo: "SOCIOEMOCIONAL", horas: 2 },
    ];
  }

  if (semestre === 2) {
    return [
      { nombre: "Conservación de la Materia y sus Interacciones con la Energía", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático II", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades II", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Lenguaje y Comunicación II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Cultura Digital II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Ciencias Sociales II", tipo: "FUNDAMENTAL", horas: 2 },
      { nombre: "Actividades Físicas y Deportivas II", tipo: "SOCIOEMOCIONAL", horas: 2 },
    ];
  }

  if (semestre === 3) {
    const labInfo = UACS_LABORALES_MAPA[capacitacionNombre]?.sem3 || UACS_LABORALES_MAPA["Administracion"].sem3;
    const socioNombre = ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0];

    return [
      { nombre: "Ciencias Naturales, Experimentales y Tecnología III", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático III", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades III", tipo: "FUNDAMENTAL", horas: 5 },
      { nombre: "Taller de Ciencias II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Lengua y Comunicación III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: socioNombre, tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: labInfo[0].name, tipo: "LABORAL", horas: 3 },
      { nombre: labInfo[1].name, tipo: "LABORAL", horas: 3 },
    ];
  }

  if (semestre === 4) {
    const labInfo = UACS_LABORALES_MAPA[capacitacionNombre]?.sem4 || UACS_LABORALES_MAPA["Administracion"].sem4;
    const socioNombre = ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[2];

    return [
      { nombre: "Ciencias Naturales, Experimentales y Tecnología IV", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático IV", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades IV", tipo: "FUNDAMENTAL", horas: 5 },
      { nombre: "Taller de Ciencias III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Lengua y Comunicación IV", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés IV", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: socioNombre, tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: labInfo[0].name, tipo: "LABORAL", horas: 3 },
      { nombre: labInfo[1].name, tipo: "LABORAL", horas: 3 },
    ];
  }

  if (semestre === 5) {
    const labInfo = UACS_LABORALES_MAPA[capacitacionNombre]?.sem5 || UACS_LABORALES_MAPA["Administracion"].sem5;
    
    // 4 Optativas FFE de libre selección (cualquiera de las 20 del catálogo)
    const ffe1 = ffeOptativasArr[0] || FFE_OPTATIVAS_CATALOGO[0];
    const ffe2 = ffeOptativasArr[1] || FFE_OPTATIVAS_CATALOGO[1];
    const ffe3 = ffeOptativasArr[2] || FFE_OPTATIVAS_CATALOGO[2];
    const ffe4 = ffeOptativasArr[3] || FFE_OPTATIVAS_CATALOGO[3];
    const socioNombre = ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1];

    return [
      // UACs Fundamentales oficiales del 5.º semestre MCCEMS 2025-2026 BGE Puebla
      { nombre: "La Energía en los Procesos de la Vida Diaria", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Conciencia Histórica II. México Durante el Expansionismo Capitalista", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Taller de Habilidades del Pensamiento", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: socioNombre, tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: labInfo[0].name, tipo: "LABORAL", horas: 3 },
      { nombre: labInfo[1].name, tipo: "LABORAL", horas: 3 },
      { nombre: ffe1, tipo: "EXTENDIDO", horas: 3 },
      { nombre: ffe2, tipo: "EXTENDIDO", horas: 3 },
      { nombre: ffe3, tipo: "EXTENDIDO", horas: 3 },
      { nombre: ffe4, tipo: "EXTENDIDO", horas: 3 },
    ];
  }

  // Semestre 6: Continuidad automática con FFE de 5.º semestre
  const labInfo6 = UACS_LABORALES_MAPA[capacitacionNombre]?.sem6 || UACS_LABORALES_MAPA["Administracion"].sem6;
  const ffe1 = obtenerFfeSemestre6(ffeOptativasArr[0] || FFE_OPTATIVAS_CATALOGO[0]);
  const ffe2 = obtenerFfeSemestre6(ffeOptativasArr[1] || FFE_OPTATIVAS_CATALOGO[1]);
  const ffe3 = obtenerFfeSemestre6(ffeOptativasArr[2] || FFE_OPTATIVAS_CATALOGO[2]);
  const ffe4 = obtenerFfeSemestre6(ffeOptativasArr[3] || FFE_OPTATIVAS_CATALOGO[3]);
  const socioNombre = ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[2];

  return [
    { nombre: "La Energía en los Procesos de la Vida Diaria II", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Conciencia Histórica III. México en el Siglo XXI", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Taller de Habilidades del Pensamiento II", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: socioNombre, tipo: "SOCIOEMOCIONAL", horas: 2 },
    { nombre: labInfo6[0].name, tipo: "LABORAL", horas: 3 },
    { nombre: labInfo6[1].name, tipo: "LABORAL", horas: 3 },
    { nombre: ffe1, tipo: "EXTENDIDO", horas: 3 },
    { nombre: ffe2, tipo: "EXTENDIDO", horas: 3 },
    { nombre: ffe3, tipo: "EXTENDIDO", horas: 3 },
    { nombre: ffe4, tipo: "EXTENDIDO", horas: 3 },
  ];
}

/**
 * Asignaturas oficiales de 1.er Semestre Bachillerato Tecnológico DBEPA Puebla (28 hrs)
 * Incluyen Bioética Social y Humanismo Mexicano oficiales de Puebla
 */
export function obtenerAsignaturas1erSemestreTecnologico(): {
  nombre: string;
  tipo: "FUNDAMENTAL" | "SOCIOEMOCIONAL";
  horas: number;
}[] {
  return [
    { nombre: "Lengua y Comunicación I", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Pensamiento Matemático I", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Ciencias Naturales, Experimentales y Tecnología I", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Ciencias Sociales I", tipo: "FUNDAMENTAL", horas: 2 },
    { nombre: "Pensamiento Filosófico y Humanidades I", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Cultura Digital I", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Inglés I", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Formación Socioemocional", tipo: "SOCIOEMOCIONAL", horas: 1 },
    { nombre: "Bioética Social", tipo: "FUNDAMENTAL", horas: 2 },
    { nombre: "Humanismo Mexicano", tipo: "FUNDAMENTAL", horas: 2 },
  ];
}

/**
 * Obtiene la malla curricular COMPLETA para un grupo de Bachillerato Tecnológico
 * Combina las asignaturas Fundamentales del semestre + Módulos de Carrera Técnica + Propedéutica
 * 
 * - Semestre 1: 10 UACs Fundamentales (28h)
 * - Semestre 3: 6 Fundamentales (22h) + Módulo II Carrera (17h) = 39h
 * - Semestre 5: 5 Fundamentales (20h) + Propedéutica (3h) + Módulo IV Carrera (12h) = 35h
 * - Semestres pares (2, 4, 6) con continuidad de malla.
 */
export function obtenerAsignaturasParaGrupoTecnologico(
  semestre: number,
  carreraId: string = "contabilidad",
  versionPrograma: "nuevo" | "anterior" = "nuevo",
  materiaPropedutica?: string
): { nombre: string; tipo: "FUNDAMENTAL" | "MODULAR" | "PROPEDUTICA" | "SOCIOEMOCIONAL"; horas: number }[] {

  if (semestre === 1) {
    return obtenerAsignaturas1erSemestreTecnologico();
  }

  if (semestre === 2) {
    const modI = getModulosPorSemestre(carreraId, 2, versionPrograma);
    const modulares = modI
      ? modI.submodulos.map(sub => ({
          nombre: sub.nombre,
          tipo: "MODULAR" as const,
          horas: sub.horasSemanales,
        }))
      : [];

    return [
      { nombre: "Conservación de la Materia y sus Interacciones con la Energía", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático II", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades II", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Lenguaje y Comunicación II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Cultura Digital II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Ciencias Sociales II", tipo: "FUNDAMENTAL", horas: 2 },
      { nombre: "Actividades Físicas y Deportivas II", tipo: "SOCIOEMOCIONAL", horas: 2 },
      ...modulares
    ];
  }

  if (semestre === 3) {
    // 6 Fundamentales (22h) + Módulo II Carrera (17h) = 39h
    const fundamentales: { nombre: string; tipo: "FUNDAMENTAL" | "SOCIOEMOCIONAL"; horas: number }[] = [
      { nombre: "Lengua y Comunicación III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Pensamiento Matemático III", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Ciencias Naturales, Experimentales y Tecnología III", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Filosófico y Humanidades III", tipo: "FUNDAMENTAL", horas: 5 },
      { nombre: "Inglés III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Formación Socioemocional III", tipo: "SOCIOEMOCIONAL", horas: 3 },
    ];

    const modulo = getModulosPorSemestre(carreraId, 3, versionPrograma);
    const modulares = modulo
      ? modulo.submodulos.map(sub => ({
          nombre: sub.nombre,
          tipo: "MODULAR" as const,
          horas: sub.horasSemanales,
        }))
      : [
          { nombre: "Submódulo 1 de Carrera Técnica", tipo: "MODULAR" as const, horas: 11 },
          { nombre: "Submódulo 2 de Carrera Técnica", tipo: "MODULAR" as const, horas: 6 },
        ];

    return [...fundamentales, ...modulares];
  }

  if (semestre === 4) {
    // 6 Fundamentales (22h) + Módulo III Carrera (17h) = 39h
    const fundamentales: { nombre: string; tipo: "FUNDAMENTAL" | "SOCIOEMOCIONAL"; horas: number }[] = [
      { nombre: "Lengua y Comunicación IV", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Pensamiento Matemático IV", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Ciencias Naturales, Experimentales y Tecnología IV", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Filosófico y Humanidades IV", tipo: "FUNDAMENTAL", horas: 5 },
      { nombre: "Inglés IV", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Formación Socioemocional IV", tipo: "SOCIOEMOCIONAL", horas: 3 },
    ];

    const modulo = getModulosPorSemestre(carreraId, 4, versionPrograma);
    const modulares = modulo
      ? modulo.submodulos.map(sub => ({
          nombre: sub.nombre,
          tipo: "MODULAR" as const,
          horas: sub.horasSemanales,
        }))
      : [
          { nombre: "Submódulo 1 de Carrera Técnica", tipo: "MODULAR" as const, horas: 10 },
          { nombre: "Submódulo 2 de Carrera Técnica", tipo: "MODULAR" as const, horas: 7 },
        ];

    return [...fundamentales, ...modulares];
  }

  if (semestre === 5) {
    // 5 Fundamentales (20h) + Propedéutica (3h) + Módulo IV Carrera (12h) = 35h
    const fundamentales: { nombre: string; tipo: "FUNDAMENTAL" | "SOCIOEMOCIONAL"; horas: number }[] = [
      { nombre: "Inglés V", tipo: "FUNDAMENTAL", horas: 5 },
      { nombre: "Temas Selectos de Matemáticas II", tipo: "FUNDAMENTAL", horas: 5 },
      { nombre: "Conciencia Histórica II. México Durante el Expansionismo Capitalista", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "La Energía en los Procesos de la Vida Diaria", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Formación Socioemocional V", tipo: "SOCIOEMOCIONAL", horas: 3 },
    ];

    const propedeutica = {
      nombre: materiaPropedutica || "Derecho y Sociedad I",
      tipo: "PROPEDUTICA" as const,
      horas: 3,
    };

    const modulo = getModulosPorSemestre(carreraId, 5, versionPrograma);
    const modulares = modulo
      ? modulo.submodulos.map(sub => ({
          nombre: sub.nombre,
          tipo: "MODULAR" as const,
          horas: sub.horasSemanales,
        }))
      : [
          { nombre: "Submódulo 1 de Carrera Técnica", tipo: "MODULAR" as const, horas: 7 },
          { nombre: "Submódulo 2 de Carrera Técnica", tipo: "MODULAR" as const, horas: 5 },
        ];

    return [...fundamentales, propedeutica, ...modulares];
  }

  // Semestre 6: 5 Fundamentales (20h) + Propedéutica Continua (3h) + Módulo V (12h) = 35h
  const fundamentales6: { nombre: string; tipo: "FUNDAMENTAL" | "SOCIOEMOCIONAL"; horas: number }[] = [
    { nombre: "Inglés VI", tipo: "FUNDAMENTAL", horas: 5 },
    { nombre: "Temas Selectos de Matemáticas III", tipo: "FUNDAMENTAL", horas: 5 },
    { nombre: "Conciencia Histórica III. México en el Siglo XXI", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "La Energía en los Procesos de la Vida Diaria II", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Formación Socioemocional VI", tipo: "SOCIOEMOCIONAL", horas: 3 },
  ];

  const propedeutica6 = {
    nombre: materiaPropedutica ? `${materiaPropedutica} II` : "Derecho y Sociedad II",
    tipo: "PROPEDUTICA" as const,
    horas: 3,
  };

  const modulo6 = getModulosPorSemestre(carreraId, 6, versionPrograma);
  const modulares6 = modulo6
    ? modulo6.submodulos.map(sub => ({
        nombre: sub.nombre,
        tipo: "MODULAR" as const,
        horas: sub.horasSemanales,
      }))
    : [
        { nombre: "Submódulo 1 de Carrera Técnica", tipo: "MODULAR" as const, horas: 6 },
        { nombre: "Submódulo 2 de Carrera Técnica", tipo: "MODULAR" as const, horas: 6 },
      ];

  return [...fundamentales6, propedeutica6, ...modulares6];
}

