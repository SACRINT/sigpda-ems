import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', 'activity-defect-candidates.txt');
const clean = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();

const TASK = /\b(?:Analiza|Calcula|Halla|Determina|Explica|Describe|Identifica|Reconoce|Elabora|Diseña|Traza|Representa|Construye|Examina|Registra|Justifica|Argumenta|Completa|Resuelve|Aplica|Emplea|Investiga|Selecciona|Clasifica|Transforma|Lee|Escribe|Anota|Piensa|Valora|Propón|Propone|Dibuja|Compara|Observa|Mide|Ubica|Ordena|Formula|Plantea|Sustituye|Verifica|Contrasta|Relaciona|Fundamenta|Integra|Incorpora|Presenta|Entrega|Comparte|Debate|Reflexiona|Deduce|Demuestra|Experimenta|Modela|Simula|Programa|Crea|Redacta|Corrige|Revisa|Escucha|Narra|Resume|Sintetiza|Parafrasea|Traduce|Ilustra|Grafica|Tabula|Obtén|Convierte|Redondea|Estima|Aproxima|Pesa|Prepara|Mezcla|Filtra|Calienta|Enfría|Siembra|Cosecha|Recolecta|Interpreta|Distingue|Enumera|Señala|Marca|Subraya|Llena|Colorea|Recorta|Pega|Arma|Desarma|Repara|Limpia|Instala|Configura|Optimiza|Actualiza|Diagnostica|Evalúa|Audita|Valida|Prueba|Recopila|Organiza|Planifica|Expone|Defiende|Concluye|Responde|Contesta|Elige|Indica|Menciona|Localiza|Encuentra|Obtén|Sustenta|Desarrolla|Demuestra|Explica)\b/i;

const TRUNC_END = /\b(?:de|del|la|el|los|las|un|una|unos|unas|y|o|para|por|con|sin|en|a|al|que|su|sus|tu|tus|mi|mis|este|esta|estos|estas|ese|esa|esos|esas|como|cuando|donde|mientras|sobre|entre|hasta|desde|según|durante|mediante|través|partir|total|técnico|técnica|sistema|función|visual|conexión|ventilador|categorías|mide|distinguir|grabación|proceso|cálculo|diagnosticar|evitar|escribe|listo|siguiendo|postes|centímetros|minutos|gramos|mililitros|metros|litros|pesos|por ciento|desempeño|resultado|datos|valores|medidas|materiales|componentes|insumos|herramientas|equipo|área|volumen|masa|longitud|dosis|resistencia|costo|tasa|velocidad|temperatura|densidad|perímetro|altura|ancho|largo|profundidad|tiempo|peso|capacidad|concentración|porcentaje)\.?$/i;
const MISSING_UNIT = /\b(?:de|del)\s+\d+(?:[.,]\d+)?\./;
const DATA_ONLY_START = /^(?:Un|Una|El|La|Los|Las|En|Durante|Al|A|Se|Cada|Dos|Tres|Cuatro|Cinco|Seis|Siete|Ocho|Nueve|Diez)\b/;

async function slideTexts(file: string) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(z.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: Array<{ slide: number; text: string }> = [];
  for (const name of names) {
    const xml = await z.files[name]!.async('text');
    out.push({ slide: Number(name.match(/\d+/)![0]), text: clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!).join(' | ')) });
  }
  return out;
}
function extractActivity(tokens: string[], label: string, stop: string[]) {
  const i = tokens.findIndex((t) => t.trim() === label);
  if (i < 0) return '';
  const body: string[] = [];
  for (let j = i + 1; j < tokens.length; j++) {
    const t = tokens[j]!.trim();
    if (stop.includes(t)) break;
    body.push(t);
  }
  return body.join(' ').replace(/\s+/g, ' ').trim();
}
async function main() {
  let out = '';
  const dirs = fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort();
  let total = 0;
  for (const dir of dirs) {
    const full = path.join(BASE, dir);
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const s = await slideTexts(path.join(full, f08));
    const found: string[] = [];
    for (const slide of s) {
      const tokens = slide.text.split('|').map((x) => x.trim());
      for (const label of ['ACTIVIDAD 1', 'ACTIVIDAD 2', 'APLICACIÓN REAL']) {
        const body = extractActivity(tokens, label, ['Pista:', 'ACTIVIDAD 2', 'APLICACIÓN REAL', 'EVALUACIÓN', 'EVIDENCIA', 'Héroes de la Patria']);
        if (!body || body.length < 8) continue;
        const hasQuestion = body.includes('?');
        const hasTask = TASK.test(body);
        const trunc = body.match(TRUNC_END)?.[0] ?? '';
        const missingUnit = MISSING_UNIT.test(body);
        const dataOnly = !hasQuestion && !hasTask && DATA_ONLY_START.test(body);
        if (trunc || missingUnit || dataOnly) {
          total++;
          found.push(`S${slide.slide} ${label}: ${body}${trunc ? `  [TRUNC:${trunc}]` : ''}${missingUnit ? '  [MISSING_UNIT]' : ''}${dataOnly ? '  [DATA_ONLY]' : ''}`);
        }
      }
    }
    if (found.length) {
      out += `\n######## ${dir} (${found.length})\n`;
      for (const f of found) out += `- ${f}\n`;
    }
  }
  out = `TOTAL CANDIDATES=${total}\n${out}`;
  fs.writeFileSync(OUT, out, 'utf8');
}
main().catch((e) => { console.error(e); process.exit(1); });
