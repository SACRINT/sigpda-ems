import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'SIGPDA-EMS API Documentation',
    version: '2026-2027',
    description: 'Especificación Oficial OpenAPI 3.1 para el Sistema de Información y Gestión Pedagógica de Media Superior (SEMS Puebla). Incluye ciclo de vida micro de secuencias didácticas, calidad pedagógica y catálogos MCCEMS.',
  },
  servers: [
    {
      url: '/',
      description: 'Servidor Actual (SIGPDA-EMS)',
    },
  ],
  tags: [
    { name: 'Secuencia Didáctica', description: 'Gestión y micro-generación de secuencias por bloque pedagógico' },
    { name: 'Plataforma y Salud', description: 'Estado operativo y mantenimiento de plataforma' },
  ],
  paths: {
    '/api/planeaciones/{id}/secuencia': {
      get: {
        summary: 'Obtener la secuencia didáctica micro de una planeación',
        description: 'Retorna el mapa completo de secuencias didácticas micro por bloque (sequence_json) asociadas a la planeación docente.',
        tags: ['Secuencia Didáctica'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'UUID único de la planeación docente',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Secuencia didáctica obtenida exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sequence: {
                      type: 'object',
                      description: 'Diccionario indexado por número de bloque con sus sesiones didácticas',
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'No autorizado (sesión no válida)' },
          '404': { description: 'Planeación no encontrada' },
          '500': { description: 'Error interno al obtener secuencia' },
        },
      },
      post: {
        summary: 'Generar micro-secuencia didáctica para un bloque curricular',
        description: 'Dispara la generación con IA pedagógica para las micro-sesiones de un bloque específico respetando la metodología activa y la Garantía Dual Offline.',
        tags: ['Secuencia Didáctica'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'UUID único de la planeación docente',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['blockIndex'],
                properties: {
                  blockIndex: {
                    type: 'integer',
                    minimum: 0,
                    description: 'Índice base 0 del bloque curricular a generar',
                  },
                  totalHours: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Número de horas de clase a dosificar (opcional)',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Secuencia didáctica generada y persistida exitosamente' },
          '400': { description: 'Entrada inválida según SecuenciaGenerateInputSchema' },
          '401': { description: 'No autorizado' },
          '404': { description: 'Planeación no encontrada' },
          '500': { description: 'Error en el motor de IA o persistencia' },
        },
      },
      put: {
        summary: 'Guardar edición manual de sesiones de un bloque en la secuencia',
        description: 'Permite al docente persistir modificaciones directas a las sesiones didácticas de un bloque curricular previamente generado.',
        tags: ['Secuencia Didáctica'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'UUID único de la planeación docente',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['blockIndex', 'sessions'],
                properties: {
                  blockIndex: {
                    type: 'integer',
                    minimum: 0,
                    description: 'Índice base 0 del bloque editado',
                  },
                  sessions: {
                    type: 'array',
                    minItems: 1,
                    description: 'Lista actualizada de sesiones didácticas del bloque conforme a SecuenciaUpdateInputSchema',
                    items: {
                      type: 'object',
                      required: ['title', 'phase', 'teachingActivity', 'learningActivity', 'evidence', 'evaluation'],
                      properties: {
                        sessionNum: { type: 'integer' },
                        totalSessions: { type: 'integer' },
                        phase: { type: 'string', enum: ['Apertura', 'Desarrollo', 'Cierre'] },
                        title: { type: 'string' },
                        teachingActivity: { type: 'string' },
                        learningActivity: { type: 'string' },
                        evidence: { type: 'string' },
                        evaluation: { type: 'string' },
                        garantiaDualOffline: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Cambios persistidos exitosamente en sequence_json' },
          '400': { description: 'Parámetros inválidos según SecuenciaUpdateInputSchema' },
          '401': { description: 'No autorizado' },
          '404': { description: 'Planeación no encontrada' },
          '500': { description: 'Error al guardar cambios en BD' },
        },
      },
    },
    '/api/maintenance-status': {
      get: {
        summary: 'Consultar estado de mantenimiento de la plataforma',
        description: 'Retorna si la plataforma se encuentra en ventana de mantenimiento y el mensaje institucional para los docentes.',
        tags: ['Plataforma y Salud'],
        responses: {
          '200': {
            description: 'Estado de mantenimiento consultado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    maintenance: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const acceptHeader = request.headers.get('accept') || '';

  // Si se solicita explícitamente JSON vía query o header Accept
  if (format === 'json' || acceptHeader.includes('application/json')) {
    return NextResponse.json(OPENAPI_SPEC);
  }

  // Interfaz Interactiva Scalar API Reference (OpenAPI 3.1)
  const specJson = JSON.stringify(OPENAPI_SPEC);
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SIGPDA-EMS — Documentación OpenAPI 3.1 (Scalar UI)</title>
    <link rel="icon" href="/favicon.ico" />
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <script id="api-reference" type="application/json">
${specJson}
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
