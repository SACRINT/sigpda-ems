/**
 * Pruebas Unitarias: /api/docs (OpenAPI 3.1 + Scalar UI) — SIGPDA-EMS
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, OPENAPI_SPEC } from '@/app/api/docs/route';

describe('GET /api/docs — OpenAPI 3.1 Documentation & Scalar UI', () => {
  it('OPENAPI_SPEC contiene metadata válida de OpenAPI 3.1', () => {
    expect(OPENAPI_SPEC.openapi).toBe('3.1.0');
    expect(OPENAPI_SPEC.info.title).toContain('SIGPDA-EMS');
    expect(OPENAPI_SPEC.paths['/api/planeaciones/{id}/secuencia']).toBeDefined();
    expect(OPENAPI_SPEC.paths['/api/planeaciones/{id}/secuencia'].get).toBeDefined();
    expect(OPENAPI_SPEC.paths['/api/planeaciones/{id}/secuencia'].post).toBeDefined();
    expect(OPENAPI_SPEC.paths['/api/planeaciones/{id}/secuencia'].put).toBeDefined();
  });

  it('debe retornar JSON cuando format=json', async () => {
    const req = new NextRequest('http://localhost:3000/api/docs?format=json');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.openapi).toBe('3.1.0');
    expect(data.info.version).toBe('2026-2027');
  });

  it('debe retornar JSON cuando el header Accept solicita application/json', async () => {
    const req = new NextRequest('http://localhost:3000/api/docs', {
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.openapi).toBe('3.1.0');
  });

  it('debe retornar HTML interactivo con Scalar UI por defecto', async () => {
    const req = new NextRequest('http://localhost:3000/api/docs');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('@scalar/api-reference');
    expect(html).toContain('id="api-reference"');
    expect(html).toContain('/api/planeaciones/{id}/secuencia');
  });
});
