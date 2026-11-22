import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', 'quality-markers.txt');

const clean = (text: string) =>
  text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();

const MARKERS: Array<[string, RegExp]> = [
  ['boilerplate_entorno', /permite interpretar datos del entorno y resolver situaciones con rigor metodológico/gi],
  ['generic_datos_anteriores', /Resuelve la situación planteada con los datos anteriores/gi],
  ['stub_comprendes_gestion', /Comprendes los principios de la gestión/gi],
  ['stub_ventilador', /Además, comprueba que el ventilador/gi],
  ['stub_alguna_vez', /Alguna vez te has preguntado/gi],
  ['stub_que_consideraciones', /¿Qué consideraciones/gi],
  ['stub_cubicacion', /La cubicación es el proceso técnico\./gi],
  ['stub_estado_define', /El Estado se define/gi],
  ['stub_analizas_funcion', /Analizas la función/gi],
  ['stub_ciencia_nos', /Ocurre esto y cómo la ciencia nos/gi],
  ['stub_logre_mantener', /¿Logré mantener/gi],
  ['stub_perspectiva_sistema', /La perspectiva isométrica es un sistema\./gi],
  ['stub_comprendes_ciencia', /Comprendes la ciencia experimental/gi],
  ['stub_sistema', /\bSistema\s+Comprendes/gi],
  ['gender_una_instrumento', /una instrumento/gi],
  ['gender_instrumento_preferida', /instrumento digital preferida/gi],
  ['gender_la_largo', /la largo/gi],
  ['gender_una_largo', /una largo/gi],
  ['wrong_estimar_objetos', /estimar objetos/gi],
  ['wrong_area_05m', /A\s*=\s*0\.5\s*m\b/gi],
  ['trunc_disenados', /diseñados\./gi],
  ['trunc_cuantificar', /para cuantificar\./gi],
  ['trunc_disenada', /proyecto, diseñada\./gi],
  ['trunc_realizar', /necesarios para realizar\./gi],
  ['trunc_cumplan', /(?:materiales|insumos) cumplan\./gi],
  ['trunc_cumplen', /soluciones posibles que cumplen\./gi],
  ['trunc_pasos_finales', /son los pasos finales\./gi],
  ['trunc_postes', /los postes\./gi],
  ['trunc_visualicen', /pares visualicen\./gi],
  ['trunc_listo', /preciso, listo\./gi],
  ['trunc_siguiendo', /en la lámina siguiendo\./gi],
  ['trunc_soporte_visual', /equipo de proyección o soporte visual\./gi],
  ['trunc_requiere_mayor', /requiere mayor\./gi],
  ['trunc_a_ese', /se asigna a ese\./gi],
  ['trunc_cuyo_texto', /cuyo texto\./gi],
  ['trunc_colores_poco', /colores poco\./gi],
  ['trunc_eliminacion_total', /eliminación total\./gi],
  ['trunc_para_diagnosticar', /para diagnosticar\./gi],
  ['trunc_escribe', /y escribe\./gi],
  ['trunc_como_esto', /cómo esto\./gi],
  ['trunc_ayuda_entender', /ayuda a entender\./gi],
  ['trunc_solubilidad', /solubilidad máxima\./gi],
  ['trunc_volumen_total_300', /volumen total de 300\./gi],
  ['trunc_como_emplearias', /cómo emplearías\./gi],
  ['trunc_por_que_valor', /por qué el valor\./gi],
  ['trunc_protocolo_5', /el 5 por ciento del volumen\./gi],
  ['trunc_y_piensa', /y piensa\./gi],
  ['trunc_dosis_200', /dosis experimental de 200\./gi],
  ['trunc_evitar', /para evitar\./gi],
  ['trunc_150_70', /150\./gi],
  ['trunc_unidad_80', /volumen ocupado de 80\./gi],
  ['trunc_20_centimetros', /volumen de 20 centímetros\./gi],
  ['trunc_longitud_12', /longitud de una franja de suelo contaminado es de 12\./gi],
  ['trunc_equipo_a_20', /Equipo A \(20 min\)\./gi],
  ['num_555', /180 \+ 75 = 255/gi],
  ['num_15000', /3,000 \+ 1,200x = 15,000/gi],
  ['num_232', /t=5: 232/gi],
  ['num_154', /\(12\+14\+13\+18\+20\)/gi],
  ['quote_zocalo', /Are the guides\.\.\.\?'\?/g],
];

async function pdfPages(file: string) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try { return (await p.getText()).pages ?? []; } finally { await p.destroy(); }
}
async function pptxSlides(file: string) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(z.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: Array<{ slide: number; text: string }> = [];
  for (const name of names) {
    const xml = await z.files[name]!.async('text');
    out.push({ slide: Number(name.match(/\d+/)![0]), text: clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!).join(' | ')) });
  }
  return out;
}

async function main() {
  let out = '';
  const dirs = fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort();
  for (const dir of dirs) {
    const full = path.join(BASE, dir);
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const f09 = fs.readdirSync(full).find((f) => f.startsWith('09_'))!;
    const s = await pptxSlides(path.join(full, f08));
    const pages = await pdfPages(path.join(full, f09));
    const counts = new Map<string, number>();
    const examples = new Map<string, string[]>();
    const add = (kind: string, where: string, text: string, index: number, len: number) => {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      const arr = examples.get(kind) ?? [];
      if (arr.length < 4) arr.push(`${where}: ${text.slice(Math.max(0, index - 50), Math.min(text.length, index + len + 90))}`);
      examples.set(kind, arr);
    };
    for (const slide of s) {
      for (const [kind, re] of MARKERS) {
        re.lastIndex = 0;
        const m = re.exec(slide.text);
        if (m) add(kind, `08 S${slide.slide}`, slide.text, m.index, m[0].length);
      }
    }
    for (let i = 0; i < (pages as unknown[]).length; i++) {
      const p = pages[i] as { text?: string } | string;
      const text = clean(typeof p === 'string' ? p : p.text || '');
      for (const [kind, re] of MARKERS) {
        re.lastIndex = 0;
        const m = re.exec(text);
        if (m) add(kind, `09 p${i + 1}`, text, m.index, m[0].length);
      }
    }
    out += `\n######## ${dir}\n`;
    for (const [kind, count] of [...counts.entries()].sort()) {
      out += `- ${kind}: ${count}\n`;
      for (const e of examples.get(kind) ?? []) out += `    ${e}\n`;
    }
  }
  fs.writeFileSync(OUT, out, 'utf8');
}
main().catch((e) => { console.error(e); process.exit(1); });
