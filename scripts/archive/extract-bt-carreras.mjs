import fs from 'fs';
import path from 'path';

/**
 * Extractor y Auditor Oficial de Carreras Técnicas para Bachilleratos Tecnológicos (BT)
 * Directorio: documentos_referencia/[02] Programas_de_Estudio Tecnologicos/Carreras_Tecnicas
 */

async function main() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dir = 'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[02] Programas_de_Estudio Tecnologicos/Carreras_Tecnicas';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));

  console.log(`[extract-bt-carreras] Analizando ${files.length} programas oficiales en PDF...`);

  const carreras = [];
  const report = [];

  for (const f of files) {
    const fullPath = path.join(dir, f);
    const buffer = fs.readFileSync(fullPath);
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;

    // 1. Extraer metadatos generales (nombre, acuerdo, año, clave)
    let title = '';
    let clave = '';
    let fecha = '';
    let edition = '';

    for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(it => it.str).join(' ');

      const tMatch = text.match(/T[eé]cnico\s+(?:en\s+)?([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,50})/i) ||
                    text.match(/CARRERA DE\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,50})/i) ||
                    text.match(/carrera de T[eé]cnico en\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,50})/i);
      if (tMatch && !title) {
        title = tMatch[1].replace(/\s+/g, ' ').trim();
      }

      const cMatch = text.match(/CLAVE:\s*([0-9A-Z\-]+)/i);
      if (cMatch && !clave) clave = cMatch[1].trim();

      const fMatch = text.match(/(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)[,\s]+(20\d\d)/i);
      if (fMatch && !fecha) fecha = fMatch[0].trim();

      if (text.toLowerCase().includes('tercera edición') || text.toLowerCase().includes('3ª edición')) {
        edition = 'Tercera edición 2024';
      } else if (text.toLowerCase().includes('segunda edición')) {
        edition = 'Segunda edición';
      }
    }

    // Limpieza de nombre
    const rawClean = f.replace(/^[A-Za-z0-9]+-/, '').replace(/\.pdf$/, '').replace(/\.pptx$/, '').replace(/_/g, ' ').trim();
    if (!title || title.length > 50 || title.toLowerCase().includes('basi') || title.toLowerCase().includes('de la')) {
      title = rawClean;
    }
    title = title.replace(/\s+/g, ' ').trim();

    // Normalizar capitalización del título
    const formattedTitle = title
      .split(' ')
      .map(w => w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
      .join(' ')
      .replace(/\b(De|En|Y|E|Para|El|La|Los|Las|Del)\b/g, m => m.toLowerCase())
      .replace(/^[a-z]/, m => m.toUpperCase());

    const isNuevo = fecha.includes('2024') || fecha.includes('2025') || fecha.includes('2026') || clave.includes('-23') || clave.includes('-24') || clave.includes('-26');
    const acuerdo = isNuevo ? '09/05/24' : '653';
    const edicionStr = edition || (isNuevo ? 'Tercera edición 2024' : (fecha || 'Plan Anterior'));

    // 2. Extraer submódulos y horas buscando en el documento completo
    const submodulosFound = [];
    for (let i = 12; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(it => it.str).join(' ');

      // Patrón de información general de submódulos:
      // // SUBMÓDULO 1 Nombre de submódulo Horas 192   o   Submódulo 1 Nombre 192 horas
      const regexSub = /(?:\/\/\s*)?SUBM[ÓO]DULO\s*(\d)\s*[-:]?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s,–-]+?)\s*(?:Horas\s*(\d+)|\s+(\d+)\s*horas)/gi;
      let match;
      while ((match = regexSub.exec(text)) !== null) {
        const subNum = parseInt(match[1], 10);
        let subName = match[2].trim().replace(/\s+/g, ' ');
        const hours = parseInt(match[3] || match[4], 10);

        // Validar que subName no sea basura y tenga sentido
        if (subName.length >= 5 && subName.length < 100 && hours >= 40 && hours <= 240) {
          // Evitar duplicados por menciones repetidas
          const exists = submodulosFound.find(s => s.name.toLowerCase() === subName.toLowerCase() && s.hours === hours);
          if (!exists) {
            submodulosFound.push({
              page: i,
              num: subNum,
              name: subName,
              hours
            });
          }
        }
      }
    }

    // 3. Estructurar Módulos I a V
    // Si la extracción de submódulos encontró la estructura completa, organizamos
    // Estructura oficial estándar BT:
    // Sem 2: Módulo I (272h)
    // Sem 3: Módulo II (272h)
    // Sem 4: Módulo III (272h)
    // Sem 5: Módulo IV (192h)
    // Sem 6: Módulo V (192h)

    report.push({
      file: f,
      title: formattedTitle,
      isNuevo,
      acuerdo,
      edicion: edicionStr,
      submodulosCount: submodulosFound.length,
      sampleSubmodulos: submodulosFound.slice(0, 4)
    });
  }

  console.log('---------------------------------------------------------');
  console.log(`[extract-bt-carreras] Resumen preliminar de ${report.length} carreras:`);
  report.slice(0, 10).forEach(r => {
    console.log(`- ${r.title} | ${r.isNuevo ? 'NUEVO' : 'ANTERIOR'} | ${r.edicion} | Submódulos hallados: ${r.submodulosCount}`);
  });
}

main().catch(console.error);
