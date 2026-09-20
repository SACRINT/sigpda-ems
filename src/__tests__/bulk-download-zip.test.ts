import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildExtraDocx } from '@/lib/docx-helpers';
import { generateExtraPdfDocument } from '@/lib/pdf-extra-renderer';
import { sanitizeDocFilename } from '@/lib/document-branding';

describe('Fase 5: Descarga Masiva ZIP por Bloque en UI y API', () => {
  const mockExtras = [
    {
      id: 'extra-1',
      title: 'Plan de Clase: Sesión 1 - Inducción a la Dinámica',
      type: 'lesson_plan',
      content_text: `# PLAN DE CLASE · SESIÓN 1\n**UAC:** Física I | **Semestre:** 3°\n\n## SECUENCIA DIDÁCTICA\n- **Rol del Docente:** Modelado y activación.\n- **Rol del Estudiante:** Bitácora.\n\n| Criterio | Nivel |\n|---|---|\n| Comprensión | Excelente |`,
    },
    {
      id: 'extra-2',
      title: 'Plan de Clase: Sesión 2 - Segunda Ley de Newton',
      type: 'lesson_plan',
      content_text: `# PLAN DE CLASE · SESIÓN 2\n**UAC:** Física I | **Semestre:** 3°\n\n## SECUENCIA DIDÁCTICA\n- **Rol del Docente:** Despeje algebraico.\n- **Rol del Estudiante:** Problemario.`,
    },
    {
      id: 'extra-3',
      title: 'Rúbrica Analítica de Desempeño: Dinámica Clásica',
      type: 'rubric',
      content_text: `# RÚBRICA DE EVALUACIÓN\n| Criterio | Sobresaliente (4) | Notable (3) | Suficiente (2) | Insuficiente (1) |\n|---|---|---|---|---|\n| Aplicación de Leyes | Modela perfectamente | Resuelve la mayoría | Procedimiento parcial | No logra aplicar |`,
    },
  ];

  it('1. Compila un extra individual a DOCX con cabecera ZIP nativa PK', async () => {
    const docxBuffer = await buildExtraDocx(mockExtras[0]);
    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.length).toBeGreaterThan(1000);
    // Verificar firma binaria PK\x03\x04 de archivo ZIP/DOCX
    expect(docxBuffer[0]).toBe(0x50); // 'P'
    expect(docxBuffer[1]).toBe(0x4b); // 'K'
    expect(docxBuffer[2]).toBe(0x03);
    expect(docxBuffer[3]).toBe(0x04);
  });

  it('2. Compila un extra individual a PDF con cabecera %PDF-', () => {
    const pdfDoc = generateExtraPdfDocument(mockExtras[2]);
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    const header = pdfBuffer.toString('ascii', 0, 5);
    expect(header).toBe('%PDF-');
  });

  it('3. Empaqueta múltiples extras en un archivo ZIP con JSZip', async () => {
    const zip = new JSZip();

    for (const extra of mockExtras) {
      const fileName = `${sanitizeDocFilename(extra.title, 50)}.docx`;
      const docxBuffer = await buildExtraDocx(extra);
      zip.file(fileName, docxBuffer);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    expect(zipBuffer).toBeInstanceOf(Buffer);
    expect(zipBuffer.length).toBeGreaterThan(3000);
    // Firma binaria PK
    expect(zipBuffer[0]).toBe(0x50);
    expect(zipBuffer[1]).toBe(0x4b);

    // Leer el ZIP generado y verificar que contiene los 3 archivos
    const loadedZip = await JSZip.loadAsync(zipBuffer);
    const files = Object.keys(loadedZip.files);
    expect(files.length).toBe(3);
    expect(files.some((f) => f.includes('sesion_1'))).toBe(true);
    expect(files.some((f) => f.includes('rubrica'))).toBe(true);
  });

  it('4. E2E: Genera y valida un ZIP masivo de PDFs para un bloque completo de 18 sesiones con deduplicación', async () => {
    // Generar 18 extras simulando un bloque didáctico completo real
    const realBlockExtras = Array.from({ length: 18 }, (_, idx) => ({
      id: `real-extra-${idx + 1}`,
      title: idx === 5 || idx === 6 
        ? 'Plan de Clase: Sesión Especial — Laboratorio y Modelado' // Título repetido intencionalmente
        : `Plan de Clase: Sesión ${idx + 1} — Ecuaciones y Funciones Cuadráticas`,
      type: 'lesson_plan',
      content_text: `# PLAN DE CLASE · SESIÓN ${idx + 1}\n**UAC:** Pensamiento Matemático III | **Semestre:** 3°\n\n## APERTURA\n- **Rol del Docente:** Explicación del modelo contextual en sesión ${idx + 1}.\n- **Rol del Estudiante:** Bitácora de trabajo colaborativo.\n\n## DESARROLLO\nResolución de ejercicios prácticos sobre situaciones de interés.\n\n## CIERRE\nEvaluación formativa y retroalimentación grupal.`,
    }));

    const brandingCtx = {
      schoolName: 'Bachillerato General Oficial Lic. Nemesio Diez Riega',
      cct: '21EBH0345Z',
      semester: 3,
    };

    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (let i = 0; i < realBlockExtras.length; i++) {
      const item = realBlockExtras[i];
      let baseName = sanitizeDocFilename(item.title, 55);
      if (!baseName) baseName = `extra_${i + 1}`;

      let fileName = `${baseName}.pdf`;
      let counter = 1;
      while (usedNames.has(fileName.toLowerCase())) {
        fileName = `${baseName}_${counter}.pdf`;
        counter++;
      }
      usedNames.add(fileName.toLowerCase());

      const pdfDoc = generateExtraPdfDocument(item, brandingCtx);
      const pdfBytes = Buffer.from(pdfDoc.output('arraybuffer'));
      zip.file(fileName, pdfBytes);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    expect(zipBuffer).toBeInstanceOf(Buffer);
    expect(zipBuffer.length).toBeGreaterThan(10000);

    const loadedZip = await JSZip.loadAsync(zipBuffer);
    const fileKeys = Object.keys(loadedZip.files);

    // Debe contener exactamente 18 archivos
    expect(fileKeys.length).toBe(18);

    // Verificar deduplicación de nombres para los títulos repetidos
    expect(fileKeys.some((k) => k.includes('sesion_especial') && !k.includes('_1.pdf'))).toBe(true);
    expect(fileKeys.some((k) => k.includes('sesion_especial') && k.includes('_1.pdf'))).toBe(true);

    // Verificar que cada archivo dentro del ZIP sea un PDF válido
    for (const key of fileKeys) {
      const fileData = await loadedZip.files[key].async('nodebuffer');
      expect(fileData.length).toBeGreaterThan(500);
      expect(fileData.toString('ascii', 0, 5)).toBe('%PDF-');
    }
  });

  it('5. E2E: Genera y valida un ZIP masivo de DOCX con branding y verifica paquetes OpenXML internos', async () => {
    const mixedExtras = [
      {
        id: 'docx-extra-1',
        title: 'Plan de Clase: Sesión 1 / Álgebra & Geometría: Introducción*',
        type: 'lesson_plan',
        content_text: '# PLAN DE CLASE\n**UAC:** Pensamiento Matemático III\n\n## SECUENCIA DIDÁCTICA\n- Actividad de inicio y diagnóstico.',
      },
      {
        id: 'docx-extra-2',
        title: 'Rúbrica Socioformativa: Evaluación de Ecuaciones 2x2',
        type: 'rubric',
        content_text: '# RÚBRICA\n| Criterio | Nivel |\n|---|---|\n| Modelado | Destacado |',
      },
      {
        id: 'docx-extra-3',
        title: 'Guía de Estudio: Teorema de Pitágoras y Napoleón',
        type: 'study_guide',
        content_text: '# GUÍA DE ESTUDIO\nDemostraciones geométricas y problemas meta.',
      },
    ];

    const brandingCtx = {
      schoolName: 'Bachillerato General Oficial Lic. Nemesio Diez Riega',
      cct: '21EBH0345Z',
      semester: 3,
    };

    const zip = new JSZip();
    for (const item of mixedExtras) {
      const fileName = `${sanitizeDocFilename(item.title, 50)}.docx`;
      const docxBuffer = await buildExtraDocx(item, brandingCtx);
      zip.file(fileName, docxBuffer);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const loadedZip = await JSZip.loadAsync(zipBuffer);
    const fileKeys = Object.keys(loadedZip.files);
    expect(fileKeys.length).toBe(3);

    // Cada archivo DOCX es a su vez un ZIP (OpenXML)
    for (const key of fileKeys) {
      // Caracteres conflictivos sanitizados
      expect(key.includes('/')).toBe(false);
      expect(key.includes('*')).toBe(false);
      expect(key.includes('&')).toBe(false);

      const docxData = await loadedZip.files[key].async('nodebuffer');
      // Validar que el archivo DOCX interno sea un ZIP válido de OpenXML
      const innerDocxZip = await JSZip.loadAsync(docxData);
      expect(innerDocxZip.file('[Content_Types].xml')).not.toBeNull();
      expect(innerDocxZip.file('word/document.xml')).not.toBeNull();
    }
  });
});

