import {
  Paragraph,
  TextRun,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  HeadingLevel,
} from 'docx';
import { logger } from '@/lib/logger';
import { isValidStaffName, isCollectiveOrNonHumanEntity } from '@/lib/pmc/staff-reconciler';

// ─── PALETA CROMÁTICA INSTITUCIONAL OFICIAL ─────────────────────────────────
export const BRAND = {
  guinda: '691C32',       // Primario oficial SEP/Puebla
  dorado: 'BC955C',       // Secundario institucional
  doradoClaro: 'F4EDE4',  // Fondo de acento
  grisFondo: 'F9FAFB',    // Relleno alterno de celdas
  grisBorde: 'D1D5DB',    // Bordes de tabla sutiles
  textoOscuro: '1F2937',  // Texto principal
  textoMuted: '4B5563',   // Texto secundario
  blanco: 'FFFFFF',       // Fondo blanco
};

// Medidas estándar de página (Twips: 1 pulgada = 1440 twips)
export const PAGE_W = 12240;      // Carta (8.5 x 11 pulgadas)
export const MARGIN = 1080;       // 0.75 pulgadas
export const CONTENT_W = PAGE_W - MARGIN * 2; // 10080 twips

// ─── INTERFACES DE DATOS CANÓNICAS (information_schema.columns) ─────────────
export interface PmcMetasInstitucionalesItem {
  tema?: string;
  diagnostico_meta?: string;
  meta?: string;
  estrategia?: string;
  linea_base?: string;
  personal_designado?: string;
  entregable?: string;
  periodo_inicio?: string;
  periodo_fin?: string;
}

export interface PmcMetasPersonalesItem {
  nombre?: string;
  cargo?: string;
  categoria?: string | null;
  tema?: string | null;
  meta_individual?: string | null;
  estrategia?: string | null;
  entregable?: string | null;
  periodo?: string | null;
}

export interface MaestroRejectionResult {
  rejected: boolean;
  status?: number;
  body?: {
    error: string;
    mensaje: string;
    faltantes: {
      diagnostico: boolean;
      plan_accion: boolean;
    };
  };
}

/**
 * Valida si un proyecto PMC cuenta con los pasos obligatorios (Paso 1 y 2)
 * para emitir el Documento Maestro Oficial. De no tenerlos, genera la respuesta 422 formal.
 */
export function resolveMaestroRejection(project: {
  diagnostico_generado?: unknown;
  plan_accion?: unknown;
}): MaestroRejectionResult {
  const hasDiagnostico = Boolean(project.diagnostico_generado);
  const hasPlanAccion = Boolean(project.plan_accion);

  if (!hasDiagnostico || !hasPlanAccion) {
    return {
      rejected: true,
      status: 422,
      body: {
        error: 'PROYECTO_INCOMPLETO_BORRADOR',
        mensaje:
          'El proyecto PMC se encuentra en estado de borrador incompleto. Debe generar y guardar el Diagnóstico Integral (Paso 1) y el Plan de Acción (Paso 2) antes de exportar el Documento Maestro.',
        faltantes: {
          diagnostico: !hasDiagnostico,
          plan_accion: !hasPlanAccion,
        },
      },
    };
  }

  return { rejected: false };
}

export type SqlQueryable = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => PromiseLike<Record<string, unknown>[]>;

/**
 * H-116: Resuelve la plantilla de personal para el PMC Maestro con aislamiento estricto por CCT.
 * Previene la fuga de personal entre planteles:
 *  1. Busca un director en 'teachers' cuyo CCT coincida con project.school_cct (no el de sesión).
 *  2. Si no lo encuentra, solo usa el id del usuario de sesión si su propio CCT coincide con el del proyecto.
 *  3. Re-verifica que el director resuelto pertenezca al CCT del proyecto antes de consultar escuela_personal.
 *  4. Si no hay director de ese CCT o escuela_personal está vacío, recurre al fallback seguro de project.staff_data.
 */
export async function resolvePersonalForMaestro(
  db: SqlQueryable,
  project: { school_cct?: string | null; staff_data?: unknown },
  teacher: { id?: string | null; role?: string | null; cct?: string | null } | Record<string, unknown>
): Promise<PmcPersonalItem[]> {
  let effectiveDirectorId: string | null = null;
  const projectCct = (project.school_cct as string | undefined)?.trim().toUpperCase() ?? '';
  const sessionCct = (teacher.cct as string | undefined)?.trim().toUpperCase() ?? '';

  // Paso 1: buscar director cuyo CCT coincida con el del PROYECTO (no con el de la sesión)
  if (projectCct) {
    try {
      const resolvedDir = await db`
        SELECT id FROM teachers
        WHERE role = 'director'
          AND UPPER(TRIM(cct)) = ${projectCct}
        LIMIT 1
      `;
      if (resolvedDir.length > 0 && resolvedDir[0]?.id) {
        effectiveDirectorId = String(resolvedDir[0].id);
      }
    } catch (error) {
      logger.warn('[PMC DOCX Maestro] Error resolviendo director por CCT del proyecto:', error);
    }
  }

  // Paso 2: si no encontró por CCT y el usuario de sesión es director del MISMO plantel, usar su id
  if (!effectiveDirectorId && teacher.role === 'director' && projectCct && sessionCct === projectCct && teacher.id) {
    effectiveDirectorId = String(teacher.id);
  }

  // Consultar personal de escuela_personal SOLO si el director encontrado pertenece al CCT del proyecto
  let personalRows: PmcPersonalItem[] = [];
  if (effectiveDirectorId) {
    try {
      // Verificación de seguridad: el director resuelto debe pertenecer al CCT del proyecto
      const [dirVerify] = await db`
        SELECT id, cct FROM teachers WHERE id = ${effectiveDirectorId}::uuid LIMIT 1
      `;
      const dirCct = (dirVerify?.cct as string | undefined)?.trim().toUpperCase() ?? '';
      const cctMatch = !projectCct || !dirCct || dirCct === projectCct;

      if (cctMatch) {
        const pRows = await db`
          SELECT id, director_id, nombre, apellido_paterno, apellido_materno, email, cargo, horas_base, activo
          FROM escuela_personal
          WHERE director_id = ${effectiveDirectorId}::uuid AND activo = TRUE
          ORDER BY apellido_paterno, nombre
        `;
        personalRows = pRows as unknown as PmcPersonalItem[];
      } else {
        logger.warn(
          `[PMC DOCX Maestro] H-116: CCT de director (${dirCct}) ≠ CCT del proyecto (${projectCct}); omitiendo escuela_personal para evitar fuga de datos.`
        );
      }
    } catch (error) {
      logger.warn('[PMC DOCX Maestro] Error consultando escuela_personal:', error);
      personalRows = [];
    }
  }

  // Fallback: si escuela_personal está vacío, construir desde project.staff_data (los nombres del wizard)
  if (personalRows.length === 0 && project.staff_data) {
    try {
      const staffRaw = typeof project.staff_data === 'string'
        ? (JSON.parse(project.staff_data) as unknown[])
        : (project.staff_data as unknown[]);
      if (Array.isArray(staffRaw)) {
        personalRows = staffRaw
          .filter((s): s is Record<string, unknown> => {
            if (typeof s !== 'object' || s === null) return false;
            const n = String((s as Record<string, unknown>).nombre ?? '').trim();
            return isValidStaffName(n) && !isCollectiveOrNonHumanEntity(n);
          })
          .map((s, idx) => ({
            id: String(idx),
            nombre: String(s.nombre ?? 'Docente'),
            apellido_paterno: '',
            apellido_materno: null,
            email: null,
            cargo: String(s.cargo ?? 'Docente frente a grupo'),
            horas_base: null,
            activo: true,
          }));
      }
    } catch {
      personalRows = [];
    }
  }

  return personalRows;
}

export interface PmcDiagnosticoGenerado {
  presentacion?: string;
  contexto?: string;
  analisis_indicadores?: string;
  priorizacion?: string;
  sintesis_foda?: string;
}

export interface PmcPlanAccion {
  metas_institucionales?: PmcMetasInstitucionalesItem[];
  metas_personales?: PmcMetasPersonalesItem[];
}

export interface PmcProjectMasterData {
  id: string;
  teacher_id: string;
  school_name?: string;
  school_cct?: string;
  municipality?: string;
  locality?: string;
  school_zone?: string;
  director_name?: string;
  supervisor_name?: string;
  ciclo_escolar?: string;
  subsystem?: string;
  total_staff?: number | string;
  staff_data?: unknown;
  indicadores_academicos?: unknown;
  foda?: unknown;
  categorias_priorizadas?: unknown;
  diagnostico_comunidad?: unknown;
  normativa?: unknown;
  diagnostico_generado?: PmcDiagnosticoGenerado | string;
  plan_accion?: PmcPlanAccion | string;
  current_step?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PmcPersonalItem {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  email?: string | null;
  cargo?: string | null;
  horas_base?: number | string | null;
  activo?: boolean;
}

export interface PmcCatalogoMetaItem {
  id: string;
  nombre: string;
  categoria: string;
  subcategoria: string;
  articulos: string[];
  vigencia?: boolean;
  aplicabilidad_nivel: 'obligatoria' | 'recomendada' | 'contextual';
  aplicabilidad_justificacion: string;
  evidencia?: string | null;
  orden_display?: number;
}

export interface PmcDocxMaestroOptions {
  catalogoMetas?: PmcCatalogoMetaItem[];
  personal?: PmcPersonalItem[];
}

// ─── HELPERS DE CONSTRUCCIÓN VISUAL DOCX ─────────────────────────────────────
export const CELL_PADDING = { top: 100, bottom: 100, left: 140, right: 140 };

export function bdr(color = BRAND.grisBorde) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

export function bdrTopOnly(color = BRAND.dorado) {
  const b = { style: BorderStyle.SINGLE, size: 8, color };
  const none = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  return { top: b, bottom: none, left: none, right: none };
}

export function cell(
  content: string | Paragraph[],
  options: {
    w?: number;
    span?: number;
    bold?: boolean;
    fill?: string;
    color?: string;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    italics?: boolean;
  } = {}
): TableCell {
  const {
    w = 2000,
    span = 1,
    bold = false,
    fill,
    color = BRAND.textoOscuro,
    size = 20, // 10pt
    align = AlignmentType.LEFT,
    italics = false,
  } = options;

  let children: Paragraph[];
  if (typeof content === 'string') {
    children = [
      new Paragraph({
        alignment: align,
        spacing: { before: 40, after: 40, line: 240 },
        children: [
          new TextRun({
            text: content,
            bold,
            italics,
            color,
            size,
            font: 'Arial',
          }),
        ],
      }),
    ];
  } else {
    children = content;
  }

  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    columnSpan: span,
    margins: CELL_PADDING,
    borders: bdr(),
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    children,
  });
}

export function h1(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 32, // 16pt
        color: BRAND.guinda,
        font: 'Arial',
      }),
    ],
  });
}

export function h2(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 26, // 13pt
        color: BRAND.dorado,
        font: 'Arial',
      }),
    ],
  });
}

export function p(text: string, opts: { bold?: boolean; italics?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align || AlignmentType.BOTH,
    spacing: { before: 60, after: 80, line: 276 },
    children: [
      new TextRun({
        text,
        bold: opts.bold || false,
        italics: opts.italics || false,
        color: opts.color || BRAND.textoOscuro,
        size: opts.size || 22, // 11pt
        font: 'Arial',
      }),
    ],
  });
}

export function parseJsonField<T>(field: unknown, fallback: T): T {
  if (!field) return fallback;
  if (typeof field === 'object') return field as T;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}


export interface PmcMaestroContext {
  project: PmcProjectMasterData;
  options: PmcDocxMaestroOptions;
  diag: PmcDiagnosticoGenerado;
  metasInst: PmcMetasInstitucionalesItem[];
  metasPers: PmcMetasPersonalesItem[];
  schoolName: string;
  cct: string;
  municipio: string;
  localidad: string;
  zona: string;
  ciclo: string;
  subsistema: string;
  director: string;
  supervisor: string;
}
