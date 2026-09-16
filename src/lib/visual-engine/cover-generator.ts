/**
 * cover-generator.ts — Generador de Portadas Editoriales y Contraportadas Institucionales
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Módulo de la Fase V2:
 * 1. Portada Editorial Personalizada:
 *    - Capa Generativa: FLUX.1-schnell (Together AI serverless) para generar fondo abstracto editorial.
 *      Superposición tipográfica nítida mediante sharp.composite() (sin quemar texto en el modelo generativo).
 *    - Capa 0 Fallback Determinista: Generación vectorial SVG matemática completa (1200x1600px a 300 DPI)
 *      con paleta institucional DBEPA (#1F3864, #2E74B5, #800020, #E8A020).
 *    - Degradación Silenciosa: Si no existe FLUX_API_KEY o falla la red, conmuta a Capa 0 sin errores.
 * 2. Contraportada Institucional con Trazabilidad:
 *    - Ficha de acreditación del plantel, CCT, subsistema, docente y proyecto PAEC.
 *    - Código QR vectorial de alta resolución apuntando a ${APP_URL}/validar/${hash}.
 *    - Folio criptográfico SHA-256 institucional.
 */

import sharp from 'sharp';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { getVerificationUrl } from '@/lib/digital-signature';
import { SCHOOL_YEAR } from '@/lib/config';

export interface BookCoverOptions {
  plantelNombre: string;
  cct: string;
  uacName: string;
  semestre?: string;
  cicloEscolar?: string;
  blockName?: string;
  blockIndex?: number;
  subsystem?: string;
  paecProjectName?: string;
  docente?: string;
  forceFallback?: boolean;
}

export interface CoverGenerationResult {
  buffer: Buffer;
  format: 'JPEG';
  isFallback: boolean;
  latencyMs: number;
  costEstimateUsd: number;
  source: 'flux_schnell' | 'deterministic_svg_fallback';
}

export interface ContraportadaData {
  qrBuffer: Buffer;
  qrDataUrl: string;
  verificationUrl: string;
  hash: string;
  plantelNombre: string;
  cct: string;
  subsystem: string;
  uacName: string;
  semestre: string;
  cicloEscolar: string;
  docente: string;
  paecProjectName: string;
}

function escapeXml(unsafe: string | null | undefined): string {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Normaliza la cadena de semestre eliminando comillas residuales y duplicaciones.
 */
function cleanSemesterString(raw: string | undefined): string {
  return (raw || 'Segundo Semestre')
    .replace(/"/g, '')
    .replace(/\bSEMESTRE\b(\s+SEMESTRE\b)+/gi, 'SEMESTRE')
    .trim();
}

/**
 * Divide un título largo en líneas equilibradas para renderizado SVG (máximo 3 líneas)
 * y calcula un fontSize que garantiza que ninguna línea desborde el ancho disponible (960px).
 *
 * Fórmula de estimación: ancho = fontSize * 0.62 * maxChars.
 * Mientras exceda 960px, reduce fontSize de 2 en 2 (mínimo 34).
 * Si excede con 2 líneas o maxChars > 30 y hay >= 3 palabras, divide en 3 líneas.
 */
function layoutTitleForSvg(text: string, maxWidth = 960): { lines: string[]; fontSize: number } {
  const clean = text.trim();
  const words = clean.split(/\s+/);

  if (words.length <= 1) {
    let fs = 64;
    while (fs * 0.62 * clean.length > maxWidth && fs > 34) {
      fs -= 2;
    }
    return { lines: [clean], fontSize: fs };
  }

  function partition(parts: number): string[] {
    const target = Math.ceil(clean.length / parts);
    const res: string[] = [];
    let cur: string[] = [];
    let curLen = 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const remainingWords = words.length - i;
      const remainingSlots = parts - res.length;

      if (
        remainingSlots > 1 &&
        cur.length > 0 &&
        (curLen + 1 + w.length > target || remainingWords === remainingSlots)
      ) {
        res.push(cur.join(' '));
        cur = [w];
        curLen = w.length;
      } else {
        cur.push(w);
        curLen += (cur.length > 1 ? 1 : 0) + w.length;
      }
    }
    if (cur.length > 0) res.push(cur.join(' '));
    return res;
  }

  // 1. Intentar en 2 líneas
  let lines = partition(2);
  let maxChars = Math.max(...lines.map((l) => l.length));
  let fs = 58;

  while (fs * 0.62 * maxChars > maxWidth && fs > 34) {
    fs -= 2;
  }

  // 2. Si excede con fs=34 o maxChars > 30 y palabras >= 3, particionar en 3 líneas
  if ((fs * 0.62 * maxChars > maxWidth || (maxChars > 30 && words.length >= 3)) && words.length >= 3) {
    const lines3 = partition(3);
    const maxChars3 = Math.max(...lines3.map((l) => l.length));
    let fs3 = 48;
    while (fs3 * 0.62 * maxChars3 > maxWidth && fs3 > 34) {
      fs3 -= 2;
    }
    if (fs3 * 0.62 * maxChars3 <= maxWidth) {
      lines = lines3;
      fs = fs3;
    }
  }

  return { lines, fontSize: fs };
}

/**
 * Genera el marcado SVG de alta definición (1200 x 1600 px) para la portada institucional Capa 0.
 */
function buildDeterministicCoverSvg(opts: BookCoverOptions): string {
  const plantel = escapeXml(opts.plantelNombre || 'Bachillerato General Oficial');
  const cct = escapeXml(opts.cct || '21ECT0017T');
  const subsistema = escapeXml((opts.subsystem || 'BGE').toUpperCase());
  const semestre = escapeXml(cleanSemesterString(opts.semestre));
  const ciclo = escapeXml(opts.cicloEscolar || SCHOOL_YEAR);
  const uac = escapeXml(opts.uacName.toUpperCase());
  const blockTitle = escapeXml(
    opts.blockName
      ? (opts.blockIndex !== undefined ? `BLOQUE ${opts.blockIndex + 1}: ` : '') + opts.blockName
      : 'FORMACIÓN FUNDAMENTAL Y LABORAL'
  );
  const paec = opts.paecProjectName ? escapeXml(opts.paecProjectName) : null;

  const { lines: titleLines, fontSize: titleFontSize } = layoutTitleForSvg(uac, 960);
  const titleStartY = titleLines.length >= 3 ? 150 : 175;
  const lineSpacing = titleFontSize + 12;
  const totalTitleOffset = (titleLines.length - 1) * lineSpacing;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600" width="1200" height="1600">
  <defs>
    <!-- Gradientes Institucionales -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07101E" />
      <stop offset="35%" stop-color="#0F2445" />
      <stop offset="70%" stop-color="#1F3864" />
      <stop offset="100%" stop-color="#14274E" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#E8A020" />
      <stop offset="50%" stop-color="#F6C90E" />
      <stop offset="100%" stop-color="#E8A020" />
    </linearGradient>
    <linearGradient id="wineGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#800020" />
      <stop offset="100%" stop-color="#4A0012" />
    </linearGradient>
    <linearGradient id="blueAccentGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2E74B5" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#1F3864" stop-opacity="0.1" />
    </linearGradient>

    <!-- Patrón geométrico sutil de fondo -->
    <pattern id="gridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
      <circle cx="30" cy="30" r="1.5" fill="#FFFFFF" fill-opacity="0.08" />
      <path d="M 60 0 L 0 60 M 0 0 L 60 60" stroke="#FFFFFF" stroke-width="0.5" stroke-opacity="0.03" />
    </pattern>
  </defs>

  <!-- Fondo Principal -->
  <rect width="1200" height="1600" fill="url(#bgGrad)" />
  <rect width="1200" height="1600" fill="url(#gridPattern)" />

  <!-- Formas geométricas dinámicas de composición editorial -->
  <!-- Polígono Puebla Wine superior derecho -->
  <path d="M 750 0 L 1200 0 L 1200 420 L 980 340 Z" fill="url(#wineGrad)" opacity="0.85" />
  <path d="M 740 0 L 760 0 L 1200 350 L 1200 370 Z" fill="url(#goldGrad)" opacity="0.9" />

  <!-- Diagonal Azul Medio inferior izquierda -->
  <polygon points="0,1150 520,1600 0,1600" fill="url(#blueAccentGrad)" />
  <polygon points="0,1280 360,1600 0,1600" fill="#2E74B5" opacity="0.2" />

  <!-- Franja decorativa dorada inferior -->
  <rect x="0" y="1520" width="1200" height="12" fill="url(#goldGrad)" />

  <!-- ── 1. ENCABEZADO INSTITUCIONAL SUPERIOR ── -->
  <rect x="0" y="0" width="1200" height="145" fill="#060C16" fill-opacity="0.85" />
  <rect x="0" y="142" width="1200" height="3" fill="url(#goldGrad)" />

  <!-- Escudo / Icono vectorial institucional de Puebla -->
  <g transform="translate(60, 32)">
    <circle cx="40" cy="40" r="34" fill="#1F3864" stroke="#E8A020" stroke-width="2.5" />
    <polygon points="40,16 47,32 64,32 50,43 56,60 40,49 24,60 30,43 16,32 33,32" fill="#E8A020" />
  </g>

  <!-- Textos de Cabecera Oficial -->
  <text x="160" y="62" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="21" font-weight="bold" fill="#FFFFFF" letter-spacing="1.5">
    SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA
  </text>
  <text x="160" y="94" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="#E8A020" letter-spacing="1.2">
    DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA (DBEPA)
  </text>
  <text x="160" y="120" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="normal" fill="#94A3B8">
    SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR · MCCEMS ${SCHOOL_YEAR}
  </text>

  <!-- ── 2. FICHA DEL PLANTEL Y SUBSISTEMA ── -->
  <g transform="translate(80, 200)">
    <!-- Tarjeta de Acreditación Escolar -->
    <rect x="0" y="0" width="1040" height="135" rx="14" fill="#0B1B33" fill-opacity="0.8" stroke="#2E74B5" stroke-width="1.5" />
    <rect x="0" y="0" width="10" height="135" rx="4" fill="url(#goldGrad)" />

    <text x="36" y="44" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="26" font-weight="bold" fill="#FFFFFF">
      ${plantel}
    </text>
    <text x="36" y="80" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#E8A020">
      CLAVE C.C.T.: ${cct}   ·   SUBSISTEMA: ${subsistema}   ·   ${semestre.toUpperCase()}
    </text>
    <text x="36" y="112" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="15" font-weight="normal" fill="#94A3B8">
      Ciclo Escolar Oficial ${ciclo}   |   Coordinación de Desarrollo Curricular EMS Puebla
    </text>
  </g>

  <!-- ── 3. NÚCLEO EDITORIAL (HERO UAC) ── -->
  <g transform="translate(80, 390)">
    <!-- Gran Contenedor Glassmorphism -->
    <rect x="0" y="0" width="1040" height="740" rx="20" fill="#081426" fill-opacity="0.88" stroke="#1F3864" stroke-width="2" />

    <!-- Distintivo Superior del Modelo Educativo -->
    <rect x="40" y="40" width="370" height="38" rx="8" fill="#1F3864" stroke="#2E74B5" stroke-width="1" />
    <text x="56" y="65" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#F6C90E" letter-spacing="1">
      NUEVA ESCUELA MEXICANA (NEM)
    </text>

    <!-- Sub-etiqueta de Tipo de Recurso -->
    <text x="430" y="65" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#94A3B8" letter-spacing="1.2">
      RECURSO SOCIOCOGNITIVO / SOCIOEMOCIONAL
    </text>

    <!-- Título Principal de la Asignatura (UAC) -->
    ${titleLines
      .map(
        (line, idx) => `
    <text x="40" y="${titleStartY + idx * lineSpacing}" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="${titleFontSize}" font-weight="900" fill="#FFFFFF" letter-spacing="0.5">
      ${line}
    </text>`
      )
      .join('')}

    <!-- Línea divisoria elegante -->
    <line x1="40" y1="${titleStartY + 35 + totalTitleOffset}" x2="1000" y2="${titleStartY + 35 + totalTitleOffset}" stroke="url(#goldGrad)" stroke-width="3" />

    <!-- Título del Bloque Formativo -->
    <g transform="translate(40, ${titleStartY + 65 + totalTitleOffset})">
      <rect x="0" y="0" width="960" height="100" rx="12" fill="#0D1E38" stroke="#2E74B5" stroke-width="1.2" />
      <text x="24" y="38" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="14" font-weight="bold" fill="#E8A020" letter-spacing="1.5">
        ORGANIZACIÓN CURRICULAR POR PROGRESIONES
      </text>
      <text x="24" y="74" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="22" font-weight="bold" fill="#FFFFFF">
        ${blockTitle}
      </text>
    </g>

    <!-- Proyecto PAEC vinculante (si está disponible) -->
    ${
      paec
        ? `
    <g transform="translate(40, ${titleStartY + 185 + totalTitleOffset})">
      <rect x="0" y="0" width="960" height="66" rx="10" fill="#800020" fill-opacity="0.3" stroke="#800020" stroke-width="1.5" />
      <text x="24" y="26" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#F87171" letter-spacing="1">
        PROYECTO ESCOLAR COMUNITARIO (PAEC)
      </text>
      <text x="24" y="52" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="#FFFFFF">
        ${paec}
      </text>
    </g>`
        : ''
    }

    <!-- Pilares Pedagógicos del Libro Activo -->
    <g transform="translate(40, ${titleStartY + (paec ? 275 : 190) + totalTitleOffset})">
      <text x="0" y="0" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#94A3B8" letter-spacing="1.2">
        ARQUITECTURA DE APRENDIZAJE ACTIVO:
      </text>

      <g transform="translate(0, 18)">
        <rect x="0" y="0" width="220" height="46" rx="8" fill="#1F3864" />
        <text x="110" y="28" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">
          1. Concepto Cero
        </text>

        <rect x="240" y="0" width="220" height="46" rx="8" fill="#1F3864" />
        <text x="350" y="28" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">
          2. Práctica Guiada
        </text>

        <rect x="480" y="0" width="220" height="46" rx="8" fill="#1F3864" />
        <text x="590" y="28" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">
          3. Reto Autónomo
        </text>

        <rect x="720" y="0" width="240" height="46" rx="8" fill="#1F3864" />
        <text x="840" y="28" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">
          4. Rúbrica &amp; Resiliencia
        </text>
      </g>
    </g>
  </g>

  <!-- ── 4. TARJETA INFERIOR DE IDENTIDAD EDITORIAL ── -->
  <g transform="translate(80, 1180)">
    <rect x="0" y="0" width="1040" height="280" rx="16" fill="#0B192C" fill-opacity="0.9" stroke="#E8A020" stroke-width="1.8" />

    <text x="50" y="60" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="34" font-weight="900" fill="#E8A020" letter-spacing="3">
      CUADERNO DE APRENDIZAJE ACTIVO
    </text>
    <text x="50" y="100" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="20" font-weight="600" fill="#FFFFFF">
      Edición Oficial para el Estudiante · Con Espacios Interactivos y Talleres de Aplicación
    </text>
    <text x="50" y="135" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="15" font-weight="normal" fill="#94A3B8">
      Diseñado para el desarrollo de progresiones de aprendizaje, pensamiento crítico y proyectos integradores.
    </text>

    <!-- Datos de Alumno y Grupo -->
    <g transform="translate(50, 165)">
      <rect x="0" y="0" width="450" height="75" rx="8" fill="#132743" stroke="#2E74B5" stroke-width="1" />
      <text x="16" y="26" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#94A3B8">
        NOMBRE DEL ESTUDIANTE:
      </text>
      <line x1="16" y1="58" x2="430" y2="58" stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />

      <rect x="480" y="0" width="200" height="75" rx="8" fill="#132743" stroke="#2E74B5" stroke-width="1" />
      <text x="496" y="26" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#94A3B8">
        GRUPO / TURNO:
      </text>
      <line x1="496" y1="58" x2="660" y2="58" stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />

      <rect x="710" y="0" width="230" height="75" rx="8" fill="#132743" stroke="#2E74B5" stroke-width="1" />
      <text x="726" y="26" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#94A3B8">
        NÚMERO DE LISTA:
      </text>
      <line x1="726" y1="58" x2="920" y2="58" stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />
    </g>
  </g>

  <!-- ── 5. PIE DE PORTADA ── -->
  <rect x="0" y="1532" width="1200" height="68" fill="#040810" />
  <text x="600" y="1572" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#64748B" letter-spacing="2">
    PUEBLA, MÉXICO · SECRETARÍA DE EDUCACIÓN PÚBLICA · SISTEMA SIGPDA-EMS MCCEMS ${SCHOOL_YEAR}
  </text>
</svg>`;
}

/**
 * Genera el marcado SVG de superposición tipográfica (1200 x 1600 px)
 * para componer sobre un fondo generado por IA (FLUX.1-schnell).
 */
function buildGenerativeTypographyOverlaySvg(opts: BookCoverOptions): string {
  const plantel = escapeXml(opts.plantelNombre || 'Bachillerato General Oficial');
  const cct = escapeXml(opts.cct || '21ECT0017T');
  const subsistema = escapeXml((opts.subsystem || 'BGE').toUpperCase());
  const semestre = escapeXml(cleanSemesterString(opts.semestre));
  const ciclo = escapeXml(opts.cicloEscolar || SCHOOL_YEAR);
  const uac = escapeXml(opts.uacName.toUpperCase());
  const blockTitle = escapeXml(
    opts.blockName
      ? (opts.blockIndex !== undefined ? `BLOQUE ${opts.blockIndex + 1}: ` : '') + opts.blockName
      : 'FORMACIÓN FUNDAMENTAL Y LABORAL'
  );
  const paec = opts.paecProjectName ? escapeXml(opts.paecProjectName) : null;

  const { lines: titleLines, fontSize: titleFontSize } = layoutTitleForSvg(uac, 960);
  const titleStartY = titleLines.length >= 3 ? 150 : 175;
  const lineSpacing = titleFontSize + 12;
  const totalTitleOffset = (titleLines.length - 1) * lineSpacing;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600" width="1200" height="1600">
  <defs>
    <linearGradient id="goldOverlayGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#E8A020" />
      <stop offset="50%" stop-color="#F6C90E" />
      <stop offset="100%" stop-color="#E8A020" />
    </linearGradient>
  </defs>

  <!-- Viñeta oscura periférica para destacar la composición editorial -->
  <rect width="1200" height="1600" fill="#000000" fill-opacity="0.32" />

  <!-- ── 1. CABECERA INSTITUCIONAL SUPERIOR ── -->
  <rect x="0" y="0" width="1200" height="145" fill="#07101E" fill-opacity="0.94" />
  <rect x="0" y="142" width="1200" height="3" fill="url(#goldOverlayGrad)" />

  <g transform="translate(60, 32)">
    <circle cx="40" cy="40" r="34" fill="#1F3864" stroke="#E8A020" stroke-width="2.5" />
    <polygon points="40,16 47,32 64,32 50,43 56,60 40,49 24,60 30,43 16,32 33,32" fill="#E8A020" />
  </g>

  <text x="160" y="62" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="21" font-weight="bold" fill="#FFFFFF" letter-spacing="1.5">
    SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA
  </text>
  <text x="160" y="94" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="#E8A020" letter-spacing="1.2">
    DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA (DBEPA)
  </text>
  <text x="160" y="120" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="normal" fill="#CBD5E1">
    MCCEMS ${SCHOOL_YEAR} · NUEVA ESCUELA MEXICANA
  </text>

  <!-- ── 2. FICHA DEL PLANTEL ── -->
  <g transform="translate(80, 190)">
    <rect x="0" y="0" width="1040" height="130" rx="14" fill="#07101E" fill-opacity="0.92" stroke="#2E74B5" stroke-width="1.5" />
    <rect x="0" y="0" width="10" height="130" rx="4" fill="url(#goldOverlayGrad)" />

    <text x="36" y="44" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="26" font-weight="bold" fill="#FFFFFF">
      ${plantel}
    </text>
    <text x="36" y="80" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#E8A020">
      CLAVE C.C.T.: ${cct}   ·   SUBSISTEMA: ${subsistema}   ·   ${semestre.toUpperCase()}
    </text>
    <text x="36" y="110" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="14" font-weight="normal" fill="#94A3B8">
      Ciclo Escolar ${ciclo}   |   Cuaderno de Trabajo Editorializado
    </text>
  </g>

  <!-- ── 3. TARJETA CENTRAL HERO UAC ── -->
  <g transform="translate(80, 370)">
    <rect x="0" y="0" width="1040" height="740" rx="20" fill="#07101E" fill-opacity="0.92" stroke="#E8A020" stroke-width="1.8" />

    <rect x="40" y="38" width="370" height="38" rx="8" fill="#1F3864" stroke="#2E74B5" stroke-width="1" />
    <text x="56" y="63" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#F6C90E" letter-spacing="1">
      NUEVA ESCUELA MEXICANA (NEM)
    </text>

    <!-- Título Asignatura UAC -->
    ${titleLines
      .map(
        (line, idx) => `
    <text x="40" y="${titleStartY + idx * lineSpacing}" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="${titleFontSize}" font-weight="900" fill="#FFFFFF" letter-spacing="0.5">
      ${line}
    </text>`
      )
      .join('')}

    <line x1="40" y1="${titleStartY + 35 + totalTitleOffset}" x2="1000" y2="${titleStartY + 35 + totalTitleOffset}" stroke="url(#goldOverlayGrad)" stroke-width="3" />

    <g transform="translate(40, ${titleStartY + 65 + totalTitleOffset})">
      <rect x="0" y="0" width="960" height="100" rx="12" fill="#0D1E38" fill-opacity="0.9" stroke="#2E74B5" stroke-width="1.2" />
      <text x="24" y="38" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="14" font-weight="bold" fill="#E8A020" letter-spacing="1.5">
        ORGANIZACIÓN CURRICULAR POR PROGRESIONES
      </text>
      <text x="24" y="74" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="22" font-weight="bold" fill="#FFFFFF">
        ${blockTitle}
      </text>
    </g>

    ${
      paec
        ? `
    <g transform="translate(40, ${titleStartY + 185 + totalTitleOffset})">
      <rect x="0" y="0" width="960" height="66" rx="10" fill="#800020" fill-opacity="0.45" stroke="#800020" stroke-width="1.5" />
      <text x="24" y="26" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#F87171" letter-spacing="1">
        PROYECTO ESCOLAR COMUNITARIO (PAEC)
      </text>
      <text x="24" y="52" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="#FFFFFF">
        ${paec}
      </text>
    </g>`
        : ''
    }

    <!-- Pilares -->
    <g transform="translate(40, ${titleStartY + (paec ? 275 : 190) + totalTitleOffset})">
      <rect x="0" y="0" width="220" height="46" rx="8" fill="#1F3864" />
      <text x="110" y="28" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">
        1. Concepto Cero
      </text>

      <rect x="240" y="0" width="220" height="46" rx="8" fill="#1F3864" />
      <text x="350" y="28" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">
        2. Práctica Guiada
      </text>

      <rect x="480" y="0" width="220" height="46" rx="8" fill="#1F3864" />
      <text x="590" y="28" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">
        3. Reto Autónomo
      </text>

      <rect x="720" y="0" width="240" height="46" rx="8" fill="#1F3864" />
      <text x="840" y="28" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">
        4. Rúbrica &amp; Resiliencia
      </text>
    </g>
  </g>

  <!-- ── 4. TARJETA INFERIOR DE IDENTIDAD ── -->
  <g transform="translate(80, 1160)">
    <rect x="0" y="0" width="1040" height="300" rx="16" fill="#07101E" fill-opacity="0.94" stroke="#E8A020" stroke-width="1.8" />

    <text x="50" y="60" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="34" font-weight="900" fill="#E8A020" letter-spacing="3">
      CUADERNO DE APRENDIZAJE ACTIVO
    </text>
    <text x="50" y="100" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="20" font-weight="600" fill="#FFFFFF">
      Edición Oficial para el Estudiante · Con Espacios Interactivos y Talleres de Aplicación
    </text>
    <text x="50" y="135" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="15" font-weight="normal" fill="#94A3B8">
      Diseñado para el desarrollo de progresiones de aprendizaje, pensamiento crítico y proyectos integradores.
    </text>

    <!-- Campos de Alumno -->
    <g transform="translate(50, 175)">
      <rect x="0" y="0" width="450" height="85" rx="8" fill="#132743" stroke="#2E74B5" stroke-width="1" />
      <text x="16" y="28" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#94A3B8">
        NOMBRE DEL ESTUDIANTE:
      </text>
      <line x1="16" y1="65" x2="430" y2="65" stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />

      <rect x="480" y="0" width="200" height="85" rx="8" fill="#132743" stroke="#2E74B5" stroke-width="1" />
      <text x="496" y="28" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#94A3B8">
        GRUPO / TURNO:
      </text>
      <line x1="496" y1="65" x2="660" y2="65" stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />

      <rect x="710" y="0" width="230" height="85" rx="8" fill="#132743" stroke="#2E74B5" stroke-width="1" />
      <text x="726" y="28" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#94A3B8">
        NÚMERO DE LISTA:
      </text>
      <line x1="726" y1="65" x2="920" y2="65" stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />
    </g>
  </g>

  <!-- ── 5. PIE ── -->
  <rect x="0" y="1532" width="1200" height="68" fill="#040810" />
  <text x="600" y="1572" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#64748B" letter-spacing="2">
    PUEBLA, MÉXICO · SECRETARÍA DE EDUCACIÓN PÚBLICA · SISTEMA SIGPDA-EMS MCCEMS ${SCHOOL_YEAR}
  </text>
</svg>`;
}

/**
 * Genera la portada institucional determinista de alta definición (Capa 0).
 * No realiza llamadas externas y nunca arroja error.
 */
export async function generateFallbackCover(opts: BookCoverOptions): Promise<CoverGenerationResult> {
  const start = Date.now();
  try {
    const svg = buildDeterministicCoverSvg(opts);
    const jpegBuffer = await sharp(Buffer.from(svg, 'utf8'), { density: 180 })
      .flatten({ background: '#07101E' })
      .jpeg({ quality: 92 })
      .toBuffer();

    return {
      buffer: jpegBuffer,
      format: 'JPEG',
      isFallback: true,
      latencyMs: Date.now() - start,
      costEstimateUsd: 0,
      source: 'deterministic_svg_fallback',
    };
  } catch (error) {
    logger.warn('[CoverGenerator] Error inesperado en generateFallbackCover, generando buffer minimalista:', error);
    // Buffer de emergencia mínimo en caso de fallo crítico de sharp
    const emergencySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600"><rect width="1200" height="1600" fill="#1F3864"/><text x="600" y="800" font-family="Arial" font-size="48" fill="#FFFFFF" text-anchor="middle">${escapeXml(opts.uacName)}</text></svg>`;
    const emergencyBuffer = await sharp(Buffer.from(emergencySvg, 'utf8')).jpeg().toBuffer();
    return {
      buffer: emergencyBuffer,
      format: 'JPEG',
      isFallback: true,
      latencyMs: Date.now() - start,
      costEstimateUsd: 0,
      source: 'deterministic_svg_fallback',
    };
  }
}

/**
 * Genera la portada editorial del libro.
 *
 * Cumple Condición 1:
 * - Lee la API key exclusivamente de variables de entorno (FLUX_API_KEY o TOGETHER_API_KEY).
 * - Si no está definida, vacía, o si falla la red, degrada silenciosamente a generateFallbackCover()
 *   sin lanzar error ni mostrar nada al usuario.
 */
export async function generateBookCover(opts: BookCoverOptions): Promise<CoverGenerationResult> {
  const start = Date.now();

  if (opts.forceFallback) {
    return generateFallbackCover(opts);
  }

  const apiKey = (process.env.FLUX_API_KEY || process.env.TOGETHER_API_KEY || '').trim();

  // Si la variable no existe o está vacía -> degradación silenciosa inmediata
  if (!apiKey) {
    return generateFallbackCover(opts);
  }

  try {
    const cleanUac = opts.uacName.replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑ]/g, '').trim();
    const prompt = `Abstract minimalist academic editorial textbook cover background for ${cleanUac}, subtle conceptual geometry, deep navy blue (#1F3864) and rich gold (#E8A020) palette, clean modern educational art, cinematic studio lighting, sharp 8k resolution, elegant, no text, no letters, no words, no signs, empty central space`;

    // Timeout de 10s para no retrasar la generación del libro
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt,
        width: 1024,
        height: 1344,
        steps: 4,
        n: 1,
        response_format: 'b64_json',
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      logger.warn(`[CoverGenerator] FLUX endpoint devolvió HTTP ${response.status}. Degradando en silencio.`);
      return generateFallbackCover(opts);
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      logger.warn('[CoverGenerator] Respuesta FLUX sin b64_json. Degradando en silencio.');
      return generateFallbackCover(opts);
    }

    const bgBuffer = Buffer.from(b64, 'base64');
    const overlaySvg = buildGenerativeTypographyOverlaySvg(opts);

    // Componer tipografía nítida sobre el fondo generado
    const compositeBuffer = await sharp(bgBuffer)
      .resize(1200, 1600, { fit: 'cover' })
      .composite([
        {
          input: Buffer.from(overlaySvg, 'utf8'),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 92 })
      .toBuffer();

    return {
      buffer: compositeBuffer,
      format: 'JPEG',
      isFallback: false,
      latencyMs: Date.now() - start,
      costEstimateUsd: 0.003, // FLUX.1-schnell standard rate ~$0.003 / image
      source: 'flux_schnell',
    };
  } catch (error) {
    logger.warn('[CoverGenerator] Excepción al llamar FLUX endpoint. Degradando en silencio:', error);
    return generateFallbackCover(opts);
  }
}

/**
 * Genera los datos y recursos vectoriales de la contraportada con validación QR y sello criptográfico.
 *
 * Cumple Condición 2:
 * - Utiliza getVerificationUrl(), la cual resuelve la URL base dinámicamente desde
 *   la configuración (NEXT_PUBLIC_APP_URL, VERCEL_URL o localhost en desarrollo).
 */
export async function generateContraportadaData(
  opts: BookCoverOptions & { hash?: string; baseUrl?: string }
): Promise<ContraportadaData> {
  const plantelNombre = opts.plantelNombre || 'Bachillerato General Oficial';
  const cct = opts.cct || '21ECT0017T';
  const subsystem = (opts.subsystem || 'BGE').toUpperCase();
  const uacName = opts.uacName;
  const semestre = cleanSemesterString(opts.semestre);
  const cicloEscolar = opts.cicloEscolar || SCHOOL_YEAR;
  const docente = opts.docente || 'Academia Docente del Plantel';
  const paecProjectName = opts.paecProjectName || 'Vinculación Comunitaria y Desarrollo Sostenible';

  // Sello criptográfico SHA-256 único para este cuaderno
  const hash =
    opts.hash ||
    crypto
      .createHash('sha256')
      .update(`${cct}|${uacName}|${cicloEscolar}|sigpda-ems-mccems-2026`)
      .digest('hex');

  // URL dinámica construida desde configuración (Condición 2)
  const verificationUrl = getVerificationUrl(hash, opts.baseUrl);

  // Código QR institucional de alta resolución (280x280 px)
  const qrBuffer = await QRCode.toBuffer(verificationUrl, {
    type: 'png',
    margin: 1,
    width: 280,
    color: {
      dark: '#1F3864',
      light: '#FFFFFF',
    },
  });

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    margin: 1,
    width: 280,
    color: {
      dark: '#1F3864',
      light: '#FFFFFF',
    },
  });

  return {
    qrBuffer,
    qrDataUrl,
    verificationUrl,
    hash,
    plantelNombre,
    cct,
    subsystem,
    uacName,
    semestre,
    cicloEscolar,
    docente,
    paecProjectName,
  };
}
