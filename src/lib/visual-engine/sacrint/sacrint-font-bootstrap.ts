import fs from 'fs';
import os from 'os';
import path from 'path';
import { interRegularB64 } from '../fonts/sacrint/inter-regular';
import { interSemiBoldB64 } from '../fonts/sacrint/inter-semibold';
import { spaceGroteskBoldB64 } from '../fonts/sacrint/space-grotesk-bold';
import { spaceGroteskMediumB64 } from '../fonts/sacrint/space-grotesk-medium';

let registered = false;

export function buildSacrintFontsConf(fontsDir: string, cacheDir: string): string {
  return [
    '<?xml version="1.0"?>',
    '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
    '<fontconfig>',
    `  <dir>${fontsDir.replace(/\\/g, '/')}</dir>`,
    `  <cachedir>${cacheDir.replace(/\\/g, '/')}</cachedir>`,
    '  <alias><family>sans-serif</family><prefer><family>Inter</family><family>Space Grotesk</family></prefer></alias>',
    '  <alias><family>Inter</family><prefer><family>Space Grotesk</family><family>sans-serif</family></prefer></alias>',
    '  <alias><family>Space Grotesk</family><prefer><family>Inter</family><family>sans-serif</family></prefer></alias>',
    '  <alias><family>Arial</family><prefer><family>Inter</family></prefer></alias>',
    '  <alias><family>Helvetica</family><prefer><family>Inter</family></prefer></alias>',
    '</fontconfig>',
    '',
  ].join('\n');
}

export function ensureSacrintFontsRegistered(): boolean {
  if (registered) return true;
  try {
    const baseDir = path.join(os.tmpdir(), 'sacrint-svg-fonts');
    const fontsDir = path.join(baseDir, 'fonts');
    const cacheDir = path.join(baseDir, 'cache');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });

    const files: Array<[string, string]> = [
      ['SpaceGrotesk-Medium.ttf', spaceGroteskMediumB64],
      ['SpaceGrotesk-Bold.ttf', spaceGroteskBoldB64],
      ['Inter-Regular.ttf', interRegularB64],
      ['Inter-SemiBold.ttf', interSemiBoldB64],
    ];
    for (const [name, base64] of files) {
      const target = path.join(fontsDir, name);
      if (!fs.existsSync(target)) {
        fs.writeFileSync(target, Buffer.from(base64, 'base64'));
      }
    }

    const confPath = path.join(baseDir, 'fonts.conf');
    fs.writeFileSync(confPath, buildSacrintFontsConf(fontsDir, cacheDir), 'utf8');
    process.env.FONTCONFIG_PATH = baseDir;
    process.env.FONTCONFIG_FILE = confPath;
    registered = true;
    return true;
  } catch {
    return false;
  }
}

export function getSacrintFontFiles(): string[] {
  if (!ensureSacrintFontsRegistered()) return [];
  const fontsDir = path.join(os.tmpdir(), 'sacrint-svg-fonts', 'fonts');
  return ['SpaceGrotesk-Medium.ttf', 'SpaceGrotesk-Bold.ttf', 'Inter-Regular.ttf', 'Inter-SemiBold.ttf'].map((name) =>
    path.join(fontsDir, name)
  );
}
