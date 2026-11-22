import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', '09-page-defects.txt');
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

const INCOMPLETE: Array<[string, RegExp]> = [
  ['concepto_gestion', /Comprendes los principios de la gestión(?!\s+térmica)/],
  ['concepto_ventilador', /Además, comprueba que el ventilador/],
  ['concepto_cubicacion', /La cubicación es el proceso técnico\./],
  ['fenomeno_ciencia', /Ocurre esto y cómo la ciencia nos/],
  ['control_logre', /R ¿Logré mantener(?:\s+PROCEDIMIENTO|\s*$)/],
  ['control_detallar', /R ¿Puedo detallar(?:\s+PROCEDIMIENTO|\s*$)/],
  ['fenomeno_alguna_vez', /F ¿Alguna vez(?:\s+C|\s*$)/],
  ['practica_pesos_4', /P Registraste los pesos cargados en 4(?:\s+D|\s*$)/],
  ['perspectiva_sistema', /La perspectiva isométrica es un sistema\./],
  ['guia_grabacion', /F La grabación de una guía(?:\s+S|\s*$)/],
  ['wrong_area', /A\s*=\s*0\.5\s*m\b/],
];
const GENERIC: Array<[string, RegExp]> = [
  ['escribe_bloque', /Piensa en todo el Bloque II y escribe\./],
  ['para_evitar', /para evitar\./],
  ['cuyo_texto', /cuyo texto\./],
  ['eliminacion_total', /eliminación total\./],
  ['para_diagnosticar', /para diagnosticar\./],
  ['visualicen', /posibilita que tus pares visualicen\./],
];

async function pages(file: string) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try { return (await p.getText()).pages ?? []; } finally { await p.destroy(); }
}
async function main() {
  let out = '';
  const dirs = fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort();
  for (const dir of dirs) {
    const full = path.join(BASE, dir);
    const f09 = fs.readdirSync(full).find((f) => f.startsWith('09_'))!;
    const ps = await pages(path.join(full, f09));
    const bad: Array<{ page: number; kinds: string[]; sample: string }> = [];
    for (let i = 0; i < (ps as unknown[]).length; i++) {
      const p = ps[i] as { text?: string } | string;
      const text = clean(typeof p === 'string' ? p : p.text || '');
      const kinds: string[] = [];
      for (const [kind, re] of INCOMPLETE) if (re.test(text)) kinds.push(kind);
      for (const [kind, re] of GENERIC) if (re.test(text)) kinds.push(kind);
      if (kinds.length) bad.push({ page: i + 1, kinds, sample: text.slice(0, 220) });
    }
    out += `${dir}\tpages=${(ps as unknown[]).length}\tflagged=${bad.length}\n`;
    for (const b of bad) out += `  p${b.page}: ${b.kinds.join(', ')}\n    ${b.sample}\n`;
  }
  fs.writeFileSync(OUT, out, 'utf8');
}
main().catch((e) => { console.error(e); process.exit(1); });
