import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const TARGETS: Record<string, number[]> = {
  Paquete_AECAEF_PDF: [30, 51, 75],
  Paquete_CECBV_PDF: [112, 13, 64],
  Paquete_DT1_PDF: [19, 97, 57],
  Paquete_ICDIBV_PDF: [49, 68, 110],
  Paquete_LMTCLCDIV_PDF: [11, 55, 59],
  Paquete_PM3_PDF: [108, 15, 42, 54, 140, 155],
  Paquete_PMCCELCDTM_PDF: [35, 95],
  Paquete_TPV1_PDF: [15, 46, 49, 79, 104],
  Paquete_I1_PDF: [24],
  Paquete_LC1_PDF: [11, 115],
};
const clean = (text: string) =>
  text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();

async function main() {
  let out = '';
  for (const [dir, nums] of Object.entries(TARGETS)) {
    const full = path.join(BASE, dir);
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const z = await JSZip.loadAsync(fs.readFileSync(path.join(full, f08)));
    for (const n of nums) {
      const name = `ppt/slides/slide${n}.xml`;
      const xml = await z.files[name]!.async('text');
      const text = clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!).join(' | '));
      out += `\n######## ${dir} S${n}\n${text}\n`;
    }
  }
  fs.writeFileSync(path.join(process.env.TEMP!, 'opencode', 'flagged-slides.txt'), out, 'utf8');
}
main().catch((e) => { console.error(e); process.exit(1); });
