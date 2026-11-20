import { getDisciplinaryAdapter } from '../src/lib/prompts/disciplinary-adapters';

const cases: Array<[string, string, string]> = [
  ['Mecánica Dental', 'Formación Laboral', 'Mecánica Dental'],
  ['Geografía', 'Currículum Fundamental', ''],
  ['Estética y Belleza', 'Formación Laboral', 'Estética y Belleza'],
  ['Ciencias de la Salud', 'Formación Laboral', 'Enfermería'],
  ['Instalaciones Residenciales', 'Formación Laboral', 'Instalaciones Residenciales'],
  ['Sistemas Eléctricos', 'Formación Laboral', 'Sistemas Eléctricos'],
  ['Francés', 'Currículum Ampliado', ''],
  ['Comunicación Gráfica', 'Formación Laboral', 'Comunicación Gráfica'],
  ['Refrigeración y Aire Acondicionado', 'Formación Laboral', 'Refrigeración'],
  ['Instrumentación Industrial', 'Formación Laboral', 'Instrumentación Industrial'],
  ['Agricultura Sostenible de Traspatio', 'Formación Laboral', 'Agricultura'],
  ['Servicios de Hostelería', 'Formación Laboral', 'Turismo'],
  ['Preparación de Alimentos Artesanales', 'Formación Laboral', 'Gastronomía'],
  ['Fotografía', 'Currículum Ampliado', ''],
  ['Cine', 'Currículum Ampliado', ''],
  ['Periodismo', 'Currículum Ampliado', ''],
  ['Comunicación Social', 'Currículum Ampliado', ''],
  ['Recursos Humanos', 'Formación Laboral', 'Administración'],
  ['Finanzas', 'Formación Laboral', 'Contabilidad'],
  ['Emprendimiento', 'Formación Laboral', 'Administración'],
  ['Diseño de Modas', 'Formación Laboral', 'Diseño'],
  ['Corte y Confección', 'Formación Laboral', 'Corte y Confección'],
  ['Nutrición', 'Formación Laboral', 'Nutrición'],
  ['Primeros Auxilios', 'Formación Laboral', 'Salud'],
  ['Seguridad e Higiene', 'Formación Laboral', 'Seguridad'],
  ['Desarrollo Sustentable', 'Currículum Ampliado', ''],
  ['Ciencias Naturales', 'Currículum Fundamental', ''],
  ['Geografía Humana', 'Currículum Fundamental', ''],
  ['Taller de Lectura y Redacción', 'Currículum Fundamental', ''],
  ['Taller de Expresión Oral', 'Currículum Fundamental', ''],
  ['Bioética', 'Currículum Ampliado', ''],
  ['Patrimonio Cultural', 'Currículum Ampliado', ''],
  ['Dibujo', 'Currículum Ampliado', ''],
  ['Física', 'Currículum Fundamental', ''],
  ['Educación Física', 'Currículum Fundamental', ''],
];

for (const [uac, component, career] of cases) {
  const a = getDisciplinaryAdapter(uac, component, career);
  console.log(`${uac} | ${component} | ${career} => ${a.id} (${a.family})`);
}
