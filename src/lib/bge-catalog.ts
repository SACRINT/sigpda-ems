/**
 * Catálogo Oficial Maestro de UACs de Bachillerato General Estatal (BGE)
 * Fuente: SEP Puebla · MCCEMS 2025-2026 (Generaciones 2023-2026 / 2025-2028)
 * Total de UACs Oficiales: 203
 */

export type BGEComponent = 'fundamental' | 'socioemocional' | 'ffeo' | 'ffe_optativa' | 'laboral';

export interface BGEUAC {
  semester: number;
  uacName: string;
  component: BGEComponent;
  totalHours: number;
  disciplineArea: string;
  weeklyHours: number;
}

export const BGE_UACS_MASTER: BGEUAC[] = [
  {
    "semester": 1,
    "uacName": "Ciencias Naturales, Experimentales y Tecnología I",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Ciencias Naturales, Experimentales y Tecnología",
    "weeklyHours": 4
  },
  {
    "semester": 1,
    "uacName": "Ciencias Sociales I",
    "component": "fundamental",
    "totalHours": 36,
    "disciplineArea": "Ciencias Sociales",
    "weeklyHours": 2
  },
  {
    "semester": 1,
    "uacName": "Cultura Digital I",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Cultura Digital",
    "weeklyHours": 3
  },
  {
    "semester": 1,
    "uacName": "Pensamiento Matemático I",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Pensamiento Matemático",
    "weeklyHours": 4
  },
  {
    "semester": 1,
    "uacName": "Lengua y Comunicación I",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Lengua y Comunicación",
    "weeklyHours": 3
  },
  {
    "semester": 1,
    "uacName": "Inglés I",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Lengua Extranjera (Inglés)",
    "weeklyHours": 3
  },
  {
    "semester": 1,
    "uacName": "Humanidades I",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Humanidades",
    "weeklyHours": 4
  },
  {
    "semester": 2,
    "uacName": "Ciencias Naturales, Experimentales y Tecnología II",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Ciencias Naturales, Experimentales y Tecnología",
    "weeklyHours": 4
  },
  {
    "semester": 2,
    "uacName": "Ciencias Sociales II",
    "component": "fundamental",
    "totalHours": 36,
    "disciplineArea": "Ciencias Sociales",
    "weeklyHours": 2
  },
  {
    "semester": 2,
    "uacName": "Cultura Digital II",
    "component": "fundamental",
    "totalHours": 36,
    "disciplineArea": "Cultura Digital",
    "weeklyHours": 2
  },
  {
    "semester": 2,
    "uacName": "Pensamiento Matemático II",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Pensamiento Matemático",
    "weeklyHours": 4
  },
  {
    "semester": 2,
    "uacName": "Lengua y Comunicación II",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Lengua y Comunicación",
    "weeklyHours": 3
  },
  {
    "semester": 2,
    "uacName": "Inglés II",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Lengua Extranjera (Inglés)",
    "weeklyHours": 3
  },
  {
    "semester": 2,
    "uacName": "Humanidades II",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Humanidades",
    "weeklyHours": 4
  },
  {
    "semester": 3,
    "uacName": "Ciencias Naturales, Experimentales y Tecnología III",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Ciencias Naturales, Experimentales y Tecnología",
    "weeklyHours": 4
  },
  {
    "semester": 3,
    "uacName": "Pensamiento Matemático III",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Pensamiento Matemático",
    "weeklyHours": 4
  },
  {
    "semester": 3,
    "uacName": "Lengua y Comunicación III",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Lengua y Comunicación",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Inglés III",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Lengua Extranjera (Inglés)",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Humanidades III",
    "component": "fundamental",
    "totalHours": 90,
    "disciplineArea": "Humanidades",
    "weeklyHours": 5
  },
  {
    "semester": 4,
    "uacName": "Ciencias Naturales, Experimentales y Tecnología IV",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Ciencias Naturales, Experimentales y Tecnología",
    "weeklyHours": 4
  },
  {
    "semester": 4,
    "uacName": "Conciencia Histórica I",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Formación Fundamental",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Inglés IV",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Lengua Extranjera (Inglés)",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Ciencias Sociales III",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Ciencias Sociales",
    "weeklyHours": 4
  },
  {
    "semester": 5,
    "uacName": "Ciencias Naturales, Experimentales y Tecnología V",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Ciencias Naturales, Experimentales y Tecnología",
    "weeklyHours": 4
  },
  {
    "semester": 5,
    "uacName": "Conciencia Histórica II",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Formación Fundamental",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Ciencias Naturales, Experimentales y Tecnología VI",
    "component": "fundamental",
    "totalHours": 72,
    "disciplineArea": "Ciencias Naturales, Experimentales y Tecnología",
    "weeklyHours": 4
  },
  {
    "semester": 6,
    "uacName": "Conciencia Histórica III",
    "component": "fundamental",
    "totalHours": 54,
    "disciplineArea": "Formación Fundamental",
    "weeklyHours": 3
  },
  {
    "semester": 1,
    "uacName": "Actividades Artísticas y Culturales I",
    "component": "socioemocional",
    "totalHours": 36,
    "disciplineArea": "Currículo Socioemocional",
    "weeklyHours": 2
  },
  {
    "semester": 1,
    "uacName": "Actividades Físicas y Deportivas I",
    "component": "socioemocional",
    "totalHours": 36,
    "disciplineArea": "Ciencias Naturales, Experimentales y Tecnología",
    "weeklyHours": 2
  },
  {
    "semester": 2,
    "uacName": "Actividades Artísticas y Culturales II",
    "component": "socioemocional",
    "totalHours": 36,
    "disciplineArea": "Currículo Socioemocional",
    "weeklyHours": 2
  },
  {
    "semester": 2,
    "uacName": "Actividades Físicas y Deportivas II",
    "component": "socioemocional",
    "totalHours": 36,
    "disciplineArea": "Ciencias Naturales, Experimentales y Tecnología",
    "weeklyHours": 2
  },
  {
    "semester": 3,
    "uacName": "Formación Socioemocional III",
    "component": "socioemocional",
    "totalHours": 36,
    "disciplineArea": "Currículo Socioemocional",
    "weeklyHours": 2
  },
  {
    "semester": 4,
    "uacName": "Formación Socioemocional IV",
    "component": "socioemocional",
    "totalHours": 36,
    "disciplineArea": "Currículo Socioemocional",
    "weeklyHours": 2
  },
  {
    "semester": 5,
    "uacName": "Formación Socioemocional V",
    "component": "socioemocional",
    "totalHours": 36,
    "disciplineArea": "Currículo Socioemocional",
    "weeklyHours": 2
  },
  {
    "semester": 1,
    "uacName": "Laboratorio de Investigación",
    "component": "ffeo",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 2,
    "uacName": "Taller de Ciencias I",
    "component": "ffeo",
    "totalHours": 72,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 4
  },
  {
    "semester": 3,
    "uacName": "Taller de Ciencias II",
    "component": "ffeo",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Taller de Cultura Digital I",
    "component": "ffeo",
    "totalHours": 18,
    "disciplineArea": "Cultura Digital",
    "weeklyHours": 1
  },
  {
    "semester": 4,
    "uacName": "Temas Selectos de Matemáticas I",
    "component": "ffeo",
    "totalHours": 72,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 4
  },
  {
    "semester": 4,
    "uacName": "Pensamiento Literario",
    "component": "ffeo",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Espacio y Sociedad",
    "component": "ffeo",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Taller de Pensamiento Variacional I",
    "component": "ffeo",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Temas Selectos de Matemáticas II",
    "component": "ffeo",
    "totalHours": 72,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 4
  },
  {
    "semester": 5,
    "uacName": "Comunicación y Sociedad I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Lengua y Comunicación",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Raíces Etimológicas del Español I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Inglés V",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Lengua Extranjera (Inglés)",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Taller Pensamiento Variacional I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Dibujo Técnico I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Pensamiento Matemático Aplicado a las Finanzas I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Pensamiento Matemático",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Taller de Probabilidad y Estadística I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Salud Integral I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Análisis de Fenómenos y Procesos Biológicos",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Análisis de Fenómenos Físicos I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Organización del Flujo de Materia y Energía en los Organismos I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Fundamentos de Administración I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Procesos Contables I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Derecho y Sociedad I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Economía I. La Función de los Agentes Económicos en la Sociedad",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Ciencias Sociales",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Temas Selectos de Ciencias Sociales I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Ciencias Sociales",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Psicología I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Lógica y Pensamiento Crítico",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Pensamiento Filosófico I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Arte y Cultura I",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Comunicación y Sociedad II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Lengua y Comunicación",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Raíces Etimológicas del Español II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Inglés VI",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Lengua Extranjera (Inglés)",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Taller Pensamiento Variacional II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Dibujo Técnico II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Pensamiento Matemático Aplicado a las Finanzas II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Pensamiento Matemático",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Taller de Probabilidad y Estadística II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Salud Integral II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Temas Selectos de Biología",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Ciencias Naturales, Experimentales y Tecnología",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Análisis de Fenómenos Físicos II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Organización del Flujo de Materia y Energía en los Organismos II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Fundamentos de Administración II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Procesos Contables II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Derecho y Sociedad II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Economía II. Política Económica y Política Pública Mexicana",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Ciencias Sociales",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Temas Selectos de Ciencias Sociales II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Ciencias Sociales",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Psicología II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Experiencia Estética",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Pensamiento Filosófico II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Arte y Cultura II",
    "component": "ffe_optativa",
    "totalHours": 54,
    "disciplineArea": "Formación Propedéutica / FFE",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Entrega recursos materiales a otras áreas de una organización",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Organiza recursos materiales a solicitud de un superior",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Captura información solicitada por un superior",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Registra entrada y salida del personal de una organización",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Elabora trámites administrativos básicos de una organización",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Organiza expedientes y documentación interna de las diferentes áreas de una organización",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Proporciona información detallada y condiciones de venta de bienes y servicios",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Realiza ventas de bienes y servicios al público en general",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Construye huerto para la producción agrícola sostenible de traspatio",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Planea huerto para la producción agrícola sostenible de traspatio",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Aplica manejo agroecológico en el sistema en el huerto de traspatio",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Reconoce sistemas de producción y manejo agroecológico en el huerto de traspatio",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Aplica técnicas agroecológicas de conservación de suelo y agua, y de control de plagas y enfermedades",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Distingue técnicas agroecológicas de conservación de suelo y agua y de control de plagas y enfermedades",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Identifica manejo de la biodiversidad y su contribución a la soberanía alimentaria y el desarrollo sostenible",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Promueve prácticas agroecológicas, redes alimentarias y económicas alternativas para contribuir a la soberanía alimentaria y el desarrollo sostenible",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Despacha medicamentos y material de curación de acuerdo con prescripciones médicas y productos farmacéuticos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Lleva registro de recetas, inventarios de medicamentos y productos farmacéuticos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Ordena las existencias de medicamentos en estantes y anaqueles",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Participa en la preparación de medicamentos y otros compuestos bajo supervisión profesional químico farmacéutico",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Asiste especialistas del área en las necesidades del paciente",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Asiste especialistas del área en las necesidades del paciente diagnosticado",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Lava, empaqueta y esteriliza el material e instrumental utilizado en las distintas áreas del sector salud",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Realiza diferentes actividades administrativas solicitadas",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Elabora bocetos gráficos comprensibles y creativos a partir de las necesidades de comunicación gráfica requerida",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Ilustra dibujos en materiales artesanales o artísticos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Reproduce bocetos gráficos básicos utilizando herramientas tradicionales o digitales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Utilizar elementos de comunicación visual y fuentes tipográficas para resolver problemas y necesidades de comunicación",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Integra efectos visuales a imágenes y textos por medio de software o aplicaciones digitales de uso libre",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Utiliza técnicas de impresión para los diversos productos gráficos, artesanales, artísticos y publicitarios",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Emplea materiales amigables con el medio ambiente para productos gráficos, artísticos y publicitarios",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Realiza maquetación de productos gráficos para publicidad y rotulación",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Opera programas de cómputo para efectuar el registro, cálculo, control y análisis de la información contable",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Registra movimientos contables de una entidad económica, con base en documentos fuente",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Realiza cálculos básicos para los informes financieros y contables, para su revisión",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Registra información para el pago de obligaciones, comerciales, laborales y fiscales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Realiza reportes básicos previos a los estados financieros",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Registra compras y ventas del sector comercial",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Organiza información para la elaboración de estados financieros básicos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Registra información que ayude al cálculo de impuestos del contribuyente",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Separa componentes electrónicos y mecánicos de uso doméstico y comercial",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Separa componentes eléctricos y domóticos de uso doméstico y comercial",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Ensambla componentes electrónicos y domóticos para uso doméstico y comercial",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Simula circuitos electrónicos y domóticos para instalaciones domésticas y comerciales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Asiste instalaciones de equipo de automatización y control para uso residencial y comercial",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Opera equipo domótico en instalaciones residenciales y comerciales, bajo supervisión",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Aplica mantenimiento a equipo domótico residencial y comercial con supervisión de expertos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Auxilia fabricación de equipo domótico para uso residencial y comercial",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Interpreta croquis de diferentes instalaciones básicas de una vivienda",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Realiza cortes, ranuras en pisos, techos y muros en construcción e instalaciones residenciales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Traslada materiales constructivos hacia sitios de trabajo bajo normas de seguridad",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Coloca elementos constructivos básicos de una vivienda",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Limpia muebles, tuberías y conexiones para llevar a cabo diferentes instalaciones de una vivienda",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Coloca muebles, tuberías y conexiones de acuerdo con instrucciones",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Recupera materiales de construcción para su reuso",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Prepara modelos, moldes, porta impresiones, bloques o rodillos para realizar impresiones dentales parciales o totales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Registra órdenes de trabajo siguiendo especificaciones y prescripciones para dispositivos y aparatos dentales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Prepara prótesis dentales fijas y removibles para el proceso de encerado",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Realiza actividades de colado de modelos protésicos calcinables con el fin de fabricar prótesis dentales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Modela alambres de diversos calibres para casos de aparatología ortodóntica",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Realiza perfilado para prótesis dentales fijas y removibles",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Apoya actividades de diseño de prótesis y aparatología dental de acuerdo con la prescripción médicoodontológica",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Repara aparatos ortopédicos y protésicos mediante herramientas manuales bajo la supervisión del experto",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Conserva frutas, verduras y legumbres a través de métodos tradicionales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Transforma cereales y harinas para la elaboración de tortillas y productos afines",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Elabora productos utilizando azúcar para preparar dulces típicos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Realiza distintos tipos de pan a base de harinas y otros ingredientes",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Obtiene bebidas no alcohólicas mediante procedimientos simples",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Prepara productos de carnes, derivados disponibles y sustitutos de proteína",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Elabora productos lácteos por métodos tradicionales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Realiza productos utilizando aceites, grasas y condimentos a través de métodos tradicionales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Elabora productos de panificación siguiendo procesos establecidos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Emplea productos, utensilios y conceptos culinarios durante el proceso de transformación de alimentos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Elabora platillos aplicando normas de calidad e higiene",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Elabora productos de repostería aplicando procesos establecidos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Determina costos de producción en la elaboración de platillos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Prepara banquetes y servicios gastronómicos para eventos especiales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Elabora productos culinarios nacionales en establecimientos de alimentos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Diseña y comercializa menús y servicios gastronómicos sustentables",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Usa técnicas y estrategias de mantenimiento del equipo de cómputo",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Establece seguridad informática en equipos de cómputo",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Planea infraestructura de red internet e intranet en un entorno con supervisión del experto",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Administra redes de acuerdo con las condiciones y requerimientos de una organización",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Brinda soporte en software de aplicación y hardware según los requerimientos del usuario",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Asesora sobre directrices de seguridad en redes y equipos de cómputo a usuarios",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Ofrece soporte en software de aplicación y hardware según los requerimientos del usuario",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Aplica técnicas de muestreo indicadas por el especialista",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Recopila muestras para las pruebas de niveles de contaminantes con guía del especialista",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Aplica técnicas de muestreo de agua dulce indicadas por el especialista",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Aplica técnicas para el aprovechamiento del agua",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Aplica técnicas para la siembra de diversas semillas forestales bajo supervisión",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Realiza pruebas de suelos y fertilizantes para el mantenimiento del ecosistema forestal",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Elabora informe final de resultados de las pruebas bajo supervisión del especialista",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Elabora presentación de resultados para su difusión bajo supervisión del especialista",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Elabora empalmes acordes con las características de los hilos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Limpia áreas de trabajo, equipo, materiales y herramientas utilizadas durante la actividad",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Calcula voltaje de un sistema eléctrico empleando equipos de medición, la ley de Ohm y las leyes de Kirchhoff",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Manipula sistemas eléctricos en componentes o aparatos siguiendo las fichas técnicas",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Ensambla componentes sobre tableros en perfocel para circuitos eléctricos básicos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Reconoce planos de sistemas eléctricos en servicios domésticos y comerciales",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Conoce el funcionamiento y clasificación de aparatos domésticos que incluyan motores universales y utiliza equipos de medición para realizar el diagnóstico",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Realiza servicio preventivo a aparatos domésticos y en los sistemas eléctricos con supervisión del experto",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Elabora documentos electrónicos en diferentes procesadores de texto, relacionados con la ofimática",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Utiliza aplicaciones ofimáticas en distintos sistemas operativos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Elabora libros electrónicos en hojas de cálculo, relacionados con la ofimática",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Opera dispositivos de hardware y software para resguardo de información",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Elabora presentaciones electrónicas en diferentes aplicaciones relacionadas con la ofimática",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Opera dispositivos electrónicos multifuncionales en procesos administrativos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Maneja softwares de aplicación para comunicación síncrona y asíncrona",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Utiliza navegadores web en distintas plataformas digitales con propósitos administrativos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Explica procesos de expedición de documentos oficiales en las instituciones gubernamentales correspondientes para transitar o viajar",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 3,
    "uacName": "Muestra variedad de servicios que componen el catálogo de la planta turística",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Recomienda planes turísticos de interés, diversión y esparcimiento de mayor ocupación nacional e internacional",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 4,
    "uacName": "Utiliza aparatos digitales o análogos para reservar y contratar servicios turísticos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Asiste usuarios en la selección, adquisición y utilización eficiente de servicios turísticos requeridos",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 5,
    "uacName": "Promociona sitios alternativos de lugares a visitar según necesidades del turista",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Planea paquetes turísticos personalizados según necesidades del turista",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  },
  {
    "semester": 6,
    "uacName": "Propone actividades específicas al usuario, según el catálogo turístico vigente",
    "component": "laboral",
    "totalHours": 54,
    "disciplineArea": "Formación Laboral",
    "weeklyHours": 3
  }
];

/**
 * Busca una UAC en el catálogo de Bachillerato General por coincidencia difusa
 */
export function findBgeUac(searchTerm: string, semester?: number): BGEUAC | undefined {
  const norm = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  
  return BGE_UACS_MASTER.find(u => {
    if (semester && u.semester !== semester) return false;
    const uNorm = u.uacName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return uNorm.includes(norm) || norm.includes(uNorm);
  });
}

/**
 * Retorna las UACs del componente fundamental para un semestre dado
 */
export function getBgeFundamentalUacs(semester?: number): BGEUAC[] {
  return BGE_UACS_MASTER.filter(u => 
    u.component === 'fundamental' && (!semester || u.semester === semester)
  );
}

/**
 * Retorna todas las UACs pertenecientes a un semestre
 */
export function getBgeUacsBySemester(semester: number): BGEUAC[] {
  return BGE_UACS_MASTER.filter(u => u.semester === semester);
}

/**
 * Obtiene el contexto formativo y disciplinar para el libro de trabajo
 */
export function getBgeNormativeContext(uacName: string): {
  disciplineArea: string;
  focus: string;
  phenomenonSuggestions: string[];
} {
  const uac = findBgeUac(uacName);
  const area = uac ? uac.disciplineArea : 'Pensamiento Científico y Crítico';

  if (area.includes('Matemático')) {
    return {
      disciplineArea: area,
      focus: 'Modelación matemática de problemas cotidianos, interpretación de gráficas y pensamiento cuantitativo crítico.',
      phenomenonSuggestions: [
        'Análisis del consumo y costo del agua potable en la comunidad',
        'Modelación de trayectorias y velocidad de transporte en la sierra o valles de Puebla',
        'Optimización de presupuesto familiar y cálculo de intereses comerciales locales'
      ]
    };
  }

  if (area.includes('Lengua')) {
    return {
      disciplineArea: area,
      focus: 'Lectura crítica, argumentación escrita rigurosa, producción de ensayos y comunicación oral dialógica.',
      phenomenonSuggestions: [
        'Análisis del impacto de las noticias falsas y desinformación en redes sociales',
        'Rescate de testimonios orales e historia cultural de la comunidad',
        'Redacción de peticiones y manifiestos de mejora para la colonia o municipio'
      ]
    };
  }

  if (area.includes('Naturales')) {
    return {
      disciplineArea: area,
      focus: 'Indagación experimental con materiales cotidianos, leyes de conservación y relación con el ecosistema poblano.',
      phenomenonSuggestions: [
        'Calidad del suelo agrícola y contaminación de cuerpos de agua locales',
        'Eficiencia energética de paneles solares y consumo eléctrico doméstico',
        'Procesos biológicos de fermentación en alimentos típicos de Puebla'
      ]
    };
  }

  if (area.includes('Digital')) {
    return {
      disciplineArea: area,
      focus: 'Alfabetización digital responsable, automatización de tareas con software libre y ciberseguridad personal.',
      phenomenonSuggestions: [
        'Protección de datos personales y huella digital en internet',
        'Automatización de hojas de cálculo para microcomercios locales',
        'Desarrollo de contenidos digitales educativos para la comunidad escolar'
      ]
    };
  }

  return {
    disciplineArea: area,
    focus: 'Indagación socioformativa situada, vinculada a los desafíos de la comunidad y el bienestar común.',
    phenomenonSuggestions: [
      'Identificación de problemáticas prioritarias del entorno escolar (PAEC)',
      'Diseño de propuestas de intervención ciudadana juvenil',
      'Desarrollo de proyectos de mejora en convivencia y sustentabilidad'
    ]
  };
}
