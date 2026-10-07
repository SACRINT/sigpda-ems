// src/__tests__/cartografia-download-button.test.tsx
/**
 * Test suite para CartografiaDownloadButton y parseDownloadResponse (F-R21-01, F-R22-02, F-R23-03)
 * Verifica que el componente capture la respuesta 422 del Quality Gate, maneje errores de red,
 * y procese cabeceras Content-Disposition tanto estándar como RFC 5987 (UTF-8) y fallbacks.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import CartografiaDownloadButton, {
  parseDownloadResponse,
} from '@/components/cartografia/CartografiaDownloadButton';

describe('CartografiaDownloadButton — Manejo UI de Bloqueo 422 y Parsing de Descarga (F-R23-03)', () => {
  it('1. Renderiza el botón de descarga con su texto y clases', () => {
    const html = renderToString(
      <CartografiaDownloadButton
        url="/api/pdf/cartografia/test-123"
        className="btn btn-sm"
        style={{ backgroundColor: '#1F3864' }}
      >
        📄 Cartografía PDF
      </CartografiaDownloadButton>
    );

    expect(html).toContain('📄 Cartografía PDF');
    expect(html).toContain('class="btn btn-sm"');
    expect(html).toContain('type="button"');
  });

  it('2. parseDownloadResponse captura HTTP 422 y extrae el reporte de Quality Gate', async () => {
    const mockPayload = {
      error: 'El proyecto no cumple con los criterios mínimos de calidad requeridos (35% - REQUIERE_REVISION). Complete los campos obligatorios antes de exportar.',
      quality: {
        score: 35,
        maxScore: 100,
        percentage: 35,
        status: 'REQUIERE_REVISION',
        recommendations: [
          'Completar la información de matrícula y caracterización de todos los planteles de la zona.',
          'Reescribir la meta general con la fórmula: [VERBO] + [%] + ...',
        ],
      },
    };

    const res = new Response(JSON.stringify(mockPayload), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });

    const parsed = await parseDownloadResponse(res);
    expect(parsed.kind).toBe('quality_422');
    if (parsed.kind === 'quality_422') {
      expect(parsed.data.percentage).toBe(35);
      expect(parsed.data.status).toBe('REQUIERE_REVISION');
      expect(parsed.data.error).toContain('35% - REQUIERE_REVISION');
      expect(parsed.data.recommendations).toHaveLength(2);
      expect(parsed.data.recommendations?.[0]).toContain('Completar la información');
      expect(parsed.data.recommendations?.[1]).toContain('Reescribir la meta general');
    }
  });

  it('3. parseDownloadResponse maneja 422 resiliente con payload JSON corrupto o vacío', async () => {
    const res = new Response('Invalid JSON payload', {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });

    const parsed = await parseDownloadResponse(res);
    expect(parsed.kind).toBe('quality_422');
    if (parsed.kind === 'quality_422') {
      expect(parsed.data.error).toBe('El proyecto no cumple con los criterios mínimos de calidad requeridos.');
      expect(parsed.data.percentage).toBeUndefined();
      expect(parsed.data.recommendations).toEqual([]);
    }
  });

  it('4. parseDownloadResponse captura errores HTTP no-422 (ej. 500, 404)', async () => {
    const res500 = new Response(JSON.stringify({ error: 'Falla interna del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

    const parsed500 = await parseDownloadResponse(res500);
    expect(parsed500.kind).toBe('generic_error');
    if (parsed500.kind === 'generic_error') {
      expect(parsed500.status).toBe(500);
      expect(parsed500.error).toBe('Falla interna del servidor');
    }

    const res404 = new Response('', { status: 404 });
    const parsed404 = await parseDownloadResponse(res404);
    expect(parsed404.kind).toBe('generic_error');
    if (parsed404.kind === 'generic_error') {
      expect(parsed404.status).toBe(404);
      expect(parsed404.error).toContain('Error 404: No se pudo descargar el documento.');
    }
  });

  it('5. parseDownloadResponse procesa exitosamente 200 OK y extrae nombre de archivo estándar con comillas', async () => {
    const blobContent = 'PK...mock zip or docx content';
    const res = new Response(blobContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="Cartografia_Zona004_2026-2027.docx"',
      },
    });

    const parsed = await parseDownloadResponse(res, 'archivo_default.docx');
    expect(parsed.kind).toBe('success');
    if (parsed.kind === 'success') {
      expect(parsed.filename).toBe('Cartografia_Zona004_2026-2027.docx');
      const text = await parsed.blob.text();
      expect(text).toBe(blobContent);
    }
  });

  it('6. Mutación/Invariante: si res.status === 422 no se bifurca como quality_422, falla la verificación', async () => {
    const res = new Response(JSON.stringify({ quality: { percentage: 40 } }), { status: 422 });
    const parsed = await parseDownloadResponse(res);
    expect(parsed.kind).not.toBe('generic_error');
    expect(parsed.kind).not.toBe('success');
    expect(parsed.kind).toBe('quality_422');
  });

  it('7. parseDownloadResponse procesa cabecera RFC 5987 (filename*=UTF-8\'\') decodificando tildes y caracteres UTF-8', async () => {
    const res = new Response('mock-docx-data', {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': "attachment; filename*=UTF-8''Cartograf%C3%ADa%20Zona004.docx",
      },
    });

    const parsed = await parseDownloadResponse(res, 'fallback.docx');
    expect(parsed.kind).toBe('success');
    if (parsed.kind === 'success') {
      expect(parsed.filename).toBe('Cartografía Zona004.docx');
    }
  });

  it('8. parseDownloadResponse utiliza el defaultFilename especificado cuando no hay cabecera Content-Disposition', async () => {
    const res = new Response('mock-content', {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    });

    const parsed = await parseDownloadResponse(res, 'Cartografia_Resumen.docx');
    expect(parsed.kind).toBe('success');
    if (parsed.kind === 'success') {
      expect(parsed.filename).toBe('Cartografia_Resumen.docx');
    }
  });

  it('9. parseDownloadResponse utiliza fallback por defecto "documento" cuando no hay cabecera ni defaultFilename', async () => {
    const res = new Response('mock-content', {
      status: 200,
    });

    const parsed = await parseDownloadResponse(res);
    expect(parsed.kind).toBe('success');
    if (parsed.kind === 'success') {
      expect(parsed.filename).toBe('documento');
    }
  });
});
