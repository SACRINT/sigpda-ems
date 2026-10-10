/**
 * icon-renderer.ts — Motor de Iconografía Vectorial Offline V7
 * SEMS Puebla MCCEMS 2026-2027
 *
 * Capa 4C de la Arquitectura Editorial:
 * - 10 iconos vectoriales canónicos dibujados exclusivamente con primitivas jsPDF
 *   (circle, line, rect, roundedRect, triangle).
 * - Cero llamadas a doc.text(): 100% WinAnsi-safe por construcción matemática.
 * - 0 dependencias de Node.js (fs, path, Buffer, crypto): seguro en navegador.
 * - Degradación D9 determinista: retorna false si el icono no existe.
 */

import type { jsPDF } from 'jspdf';
import { ICON_SET, type RGB } from './design-tokens';

export type IconName =
  | 'check'
  | 'bombilla'
  | 'engranaje'
  | 'herramienta'
  | 'warning'
  | 'libro'
  | 'lupa'
  | 'gota'
  | 'chip'
  | 'flecha-doble'
  | 'flechaDoble';

const SUPPORTED_ICONS = new Set<string>([
  'check',
  'bombilla',
  'engranaje',
  'herramienta',
  'warning',
  'libro',
  'lupa',
  'gota',
  'chip',
  'flecha-doble',
  'flechaDoble',
]);

/**
 * Dibuja un icono vectorial canónico en el documento PDF usando únicamente primitivas gráficas.
 *
 * @param doc Instancia jsPDF destino
 * @param name Nombre del icono del conjunto canónico
 * @param x Posición horizontal inicial en mm
 * @param y Posición vertical inicial en mm
 * @param size Dimensión cuadrática del icono en mm (por defecto 3.5 mm)
 * @param color Tupla RGB opcional; si no se provee, se toma del token ICON_SET
 * @returns true si el icono fue dibujado exitosamente; false si no está soportado (D9)
 */
export function drawIcon(
  doc: jsPDF,
  name: IconName | string,
  x: number,
  y: number,
  size: number = 3.5,
  color?: RGB
): boolean {
  if (!doc || !name || size <= 0 || !SUPPORTED_ICONS.has(name)) {
    return false;
  }

  const canonicalName: IconName = name === 'flechaDoble' ? 'flecha-doble' : (name as IconName);
  const rgb: RGB = color ?? ICON_SET[canonicalName];
  if (!rgb || rgb.length !== 3) {
    return false;
  }

  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);

  switch (canonicalName) {
    case 'check': {
      const strokeW = Math.max(0.2, size * 0.12);
      doc.setLineWidth(strokeW);
      doc.line(x + size * 0.18, y + size * 0.52, x + size * 0.42, y + size * 0.76);
      doc.line(x + size * 0.42, y + size * 0.76, x + size * 0.84, y + size * 0.24);
      break;
    }

    case 'bombilla': {
      const strokeW = Math.max(0.18, size * 0.08);
      doc.setLineWidth(strokeW);
      // Cúpula bombilla
      doc.circle(x + size * 0.5, y + size * 0.38, size * 0.26, 'S');
      // Base / casquillo
      doc.roundedRect(x + size * 0.36, y + size * 0.62, size * 0.28, size * 0.14, 0.2, 0.2, 'S');
      // Contacto inferior
      doc.line(x + size * 0.42, y + size * 0.80, x + size * 0.58, y + size * 0.80);
      // Filamento interno
      doc.line(x + size * 0.5, y + size * 0.28, x + size * 0.5, y + size * 0.50);
      // Rayos de emisión sutiles
      doc.line(x + size * 0.5, y + size * 0.04, x + size * 0.5, y + size * 0.10);
      doc.line(x + size * 0.22, y + size * 0.16, x + size * 0.28, y + size * 0.22);
      doc.line(x + size * 0.78, y + size * 0.16, x + size * 0.72, y + size * 0.22);
      break;
    }

    case 'engranaje': {
      const cx = x + size * 0.5;
      const cy = y + size * 0.5;
      const strokeW = Math.max(0.18, size * 0.08);
      doc.setLineWidth(strokeW);
      // Anillo exterior y orificio interior
      doc.circle(cx, cy, size * 0.30, 'S');
      doc.circle(cx, cy, size * 0.12, 'S');
      // 8 Dientes radiales
      const toothW = Math.max(0.24, size * 0.12);
      doc.setLineWidth(toothW);
      const rIn = size * 0.28;
      const rOut = size * 0.46;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        doc.line(cx + rIn * cos, cy + rIn * sin, cx + rOut * cos, cy + rOut * sin);
      }
      break;
    }

    case 'herramienta': {
      const strokeW = Math.max(0.22, size * 0.12);
      doc.setLineWidth(strokeW);
      // Mango diagonal
      doc.line(x + size * 0.24, y + size * 0.76, x + size * 0.62, y + size * 0.38);
      // Cabeza superior derecha
      doc.circle(x + size * 0.70, y + size * 0.30, size * 0.18, 'S');
      // Muesca de apertura de la boca
      doc.line(x + size * 0.78, y + size * 0.22, x + size * 0.68, y + size * 0.32);
      // Anillo base inferior izquierdo
      doc.circle(x + size * 0.22, y + size * 0.78, size * 0.10, 'S');
      break;
    }

    case 'warning': {
      const strokeW = Math.max(0.18, size * 0.08);
      doc.setLineWidth(strokeW);
      // Triángulo de alerta
      doc.triangle(
        x + size * 0.5,
        y + size * 0.12,
        x + size * 0.14,
        y + size * 0.86,
        x + size * 0.86,
        y + size * 0.86,
        'S'
      );
      // Signo de exclamación: barra vertical y punto
      const barW = Math.max(0.22, size * 0.09);
      doc.setLineWidth(barW);
      doc.line(x + size * 0.5, y + size * 0.38, x + size * 0.5, y + size * 0.62);
      doc.circle(x + size * 0.5, y + size * 0.74, size * 0.04, 'FD');
      break;
    }

    case 'libro': {
      const strokeW = Math.max(0.18, size * 0.08);
      doc.setLineWidth(strokeW);
      // Lomo central
      doc.line(x + size * 0.5, y + size * 0.24, x + size * 0.5, y + size * 0.80);
      // Contorno de página izquierda
      doc.line(x + size * 0.5, y + size * 0.24, x + size * 0.16, y + size * 0.20);
      doc.line(x + size * 0.16, y + size * 0.20, x + size * 0.16, y + size * 0.76);
      doc.line(x + size * 0.16, y + size * 0.76, x + size * 0.5, y + size * 0.80);
      // Contorno de página derecha
      doc.line(x + size * 0.5, y + size * 0.24, x + size * 0.84, y + size * 0.20);
      doc.line(x + size * 0.84, y + size * 0.20, x + size * 0.84, y + size * 0.76);
      doc.line(x + size * 0.84, y + size * 0.76, x + size * 0.5, y + size * 0.80);
      // Renglones interiores de texto
      const thinW = Math.max(0.12, size * 0.05);
      doc.setLineWidth(thinW);
      doc.line(x + size * 0.24, y + size * 0.38, x + size * 0.44, y + size * 0.40);
      doc.line(x + size * 0.24, y + size * 0.54, x + size * 0.44, y + size * 0.56);
      doc.line(x + size * 0.56, y + size * 0.40, x + size * 0.76, y + size * 0.38);
      doc.line(x + size * 0.56, y + size * 0.56, x + size * 0.76, y + size * 0.54);
      break;
    }

    case 'lupa': {
      const strokeW = Math.max(0.18, size * 0.08);
      doc.setLineWidth(strokeW);
      // Lente circular
      doc.circle(x + size * 0.40, y + size * 0.40, size * 0.26, 'S');
      // Mango diagonal grueso
      const handleW = Math.max(0.28, size * 0.14);
      doc.setLineWidth(handleW);
      doc.line(x + size * 0.58, y + size * 0.58, x + size * 0.86, y + size * 0.86);
      // Reflejo óptico interno
      const thinW = Math.max(0.12, size * 0.05);
      doc.setLineWidth(thinW);
      doc.line(x + size * 0.28, y + size * 0.32, x + size * 0.36, y + size * 0.24);
      break;
    }

    case 'gota': {
      const strokeW = Math.max(0.18, size * 0.08);
      doc.setLineWidth(strokeW);
      // Base esférica
      doc.circle(x + size * 0.5, y + size * 0.60, size * 0.26, 'S');
      // Laterales convergentes hacia la cúspide
      doc.line(x + size * 0.5, y + size * 0.16, x + size * 0.27, y + size * 0.50);
      doc.line(x + size * 0.5, y + size * 0.16, x + size * 0.73, y + size * 0.50);
      // Brillo interior
      const thinW = Math.max(0.12, size * 0.05);
      doc.setLineWidth(thinW);
      doc.line(x + size * 0.40, y + size * 0.54, x + size * 0.40, y + size * 0.68);
      break;
    }

    case 'chip': {
      const strokeW = Math.max(0.16, size * 0.07);
      doc.setLineWidth(strokeW);
      // Paquete rectangular
      doc.rect(x + size * 0.28, y + size * 0.28, size * 0.44, size * 0.44, 'S');
      // Núcleo semiconductor central
      doc.circle(x + size * 0.5, y + size * 0.5, size * 0.08, 'FD');
      // Pines exteriores en los 4 bordes
      const pinW = Math.max(0.14, size * 0.06);
      doc.setLineWidth(pinW);
      const pinOffsets = [0.36, 0.50, 0.64];
      for (const po of pinOffsets) {
        doc.line(x + size * 0.12, y + size * po, x + size * 0.28, y + size * po);
        doc.line(x + size * 0.72, y + size * po, x + size * 0.88, y + size * po);
        doc.line(x + size * po, y + size * 0.12, x + size * po, y + size * 0.28);
        doc.line(x + size * po, y + size * 0.72, x + size * po, y + size * 0.88);
      }
      break;
    }

    case 'flecha-doble': {
      const strokeW = Math.max(0.22, size * 0.11);
      doc.setLineWidth(strokeW);
      // Primer cheurón
      doc.line(x + size * 0.20, y + size * 0.22, x + size * 0.46, y + size * 0.50);
      doc.line(x + size * 0.46, y + size * 0.50, x + size * 0.20, y + size * 0.78);
      // Segundo cheurón
      doc.line(x + size * 0.50, y + size * 0.22, x + size * 0.76, y + size * 0.50);
      doc.line(x + size * 0.76, y + size * 0.50, x + size * 0.50, y + size * 0.78);
      break;
    }
  }

  // Restaurar grosor de línea estándar
  doc.setLineWidth(0.2);
  return true;
}
