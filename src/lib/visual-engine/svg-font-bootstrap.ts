/**
 * svg-font-bootstrap.ts — Registro de fuentes institucionales para librsvg/sharp (Linux serverless)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Causa raíz de los glifos tofu (□□□□) en portadas y diagramas rasterizados en Vercel:
 * librsvg (motor SVG de sharp) NO soporta `@font-face` con data-URI; sólo resuelve fuentes
 * mediante fontconfig. En lambdas sin fuentes de sistema, todo `<text>` se rasteriza como tofu.
 *
 * Solución: al cargar el módulo (antes del primer render con texto) se materializan las fuentes
 * ya empaquetadas en base64 (Montserrat Bold, Lato Regular/Bold) en un directorio temporal y se
 * apunta fontconfig a un fonts.conf mínimo mediante FONTCONFIG_FILE / FONTCONFIG_PATH.
 * Es idempotente, sólo actúa en Linux y nunca interrumpe la generación del libro.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '@/lib/logger';
import { montserratBoldB64 } from './fonts/montserrat-bold';
import { latoRegularB64 } from './fonts/lato-regular';
import { latoBoldB64 } from './fonts/lato-bold';

let registered = false;

/**
 * Genera el contenido de fonts.conf mínimo para fontconfig.
 * Exportado para pruebas unitarias.
 */
export function buildFontsConf(fontsDir: string, cacheDir: string): string {
  return [
    '<?xml version="1.0"?>',
    '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
    '<fontconfig>',
    `  <dir>${fontsDir}</dir>`,
    `  <cachedir>${cacheDir}</cachedir>`,
    '  <alias><family>sans-serif</family><prefer><family>Lato</family><family>Montserrat</family></prefer></alias>',
    '  <alias><family>serif</family><prefer><family>Lato</family></prefer></alias>',
    '  <alias><family>Arial</family><prefer><family>Lato</family></prefer></alias>',
    '  <alias><family>Calibri</family><prefer><family>Lato</family></prefer></alias>',
    '  <alias><family>Helvetica</family><prefer><family>Lato</family></prefer></alias>',
    '</fontconfig>',
    '',
  ].join('\n');
}

/**
 * Registra las fuentes institucionales en fontconfig. Devuelve true si quedó activo.
 */
export function ensureSvgFontsRegistered(): boolean {
  if (registered) return true;
  if (process.platform !== 'linux') return false;

  try {
    const baseDir = path.join(os.tmpdir(), 'sigpda-svg-fonts');
    const fontsDir = path.join(baseDir, 'fonts');
    const cacheDir = path.join(baseDir, 'cache');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });

    const files: Array<[string, string]> = [
      ['Montserrat-Bold.ttf', montserratBoldB64],
      ['Lato-Regular.ttf', latoRegularB64],
      ['Lato-Bold.ttf', latoBoldB64],
    ];
    for (const [name, b64] of files) {
      const target = path.join(fontsDir, name);
      if (!fs.existsSync(target)) {
        fs.writeFileSync(target, Buffer.from(b64, 'base64'));
      }
    }

    const confPath = path.join(baseDir, 'fonts.conf');
    fs.writeFileSync(confPath, buildFontsConf(fontsDir, cacheDir), 'utf8');

    process.env.FONTCONFIG_PATH = baseDir;
    process.env.FONTCONFIG_FILE = confPath;
    registered = true;
    return true;
  } catch (error) {
    logger.warn('[svg-font-bootstrap] No se pudieron registrar las fuentes institucionales en fontconfig:', error);
    return false;
  }
}

// Efecto de módulo: debe ejecutarse antes del primer render de texto SVG con sharp.
ensureSvgFontsRegistered();
