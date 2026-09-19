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
});
