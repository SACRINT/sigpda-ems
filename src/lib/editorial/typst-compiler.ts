/**
 * typst-compiler.ts — Wrapper y Motor de Ejecución de Typst CLI
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 1 Spike)
 *
 * Ejecuta el binario oficial de Typst mediante `execFile` de Node.js de forma
 * desacoplada y determinista:
 * - Fija SOURCE_DATE_EPOCH=0 para garantizar hash binario idéntico entre ejecuciones.
 * - Soporta resolución automática de binario en Windows (WinGet / User PATH) y Linux (Docker / Contenedor).
 * - Extrae métricas de tiempo de compilación (ms), páginas y consumo de memoria.
 * - Soporta paso de `--root` para resolución de assets estáticos (/public/images/materiales).
 * - Temp files: almacena por defecto en `os.tmpdir()` para compatibilidad estricta con
 *   sistemas de archivos read-only en entornos serverless (Vercel Serverless / Lambda).
 * - Arquitectura de Ejecución (§7.4): Decisión adoptada para Fase 2:
 *   * Typst se ejecutará en un worker container dedicado (Fly Machines scale-to-zero) o microservicio Node/Linux.
 *   * Vercel Serverless conserva exclusivamente UI/API, desacoplando la generación pesada.
 *   * El PDF compilado por el worker se persistirá directamente en Vercel Blob Storage.
 *   * Determinismo de fuentes cross-OS: Se embeberán tipografías abiertas canónicas (Liberation Sans / Inter,
 *     métricamente compatibles; Arial descartada por licencias propietarias en Linux) mediante `--font-path`.
 *   * En Fase 1 NO se construye contenedor Docker; el spike valida la compatibilidad CLI local y serverless.
 *   * Medición de memoria (AUD-04 P2): `nodeHeapDeltaMb` reporta el heap asignado en el proceso padre Node.js.
 *     La medición de RAM del binario Typst como child process (VmHWM / cgroups) queda explícitamente agendada
 *     como TODO de Fase 2 en el worker container.
 */

import { execFile, spawnSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { StudentChapter, assertValidStudentChapter } from './student-content-model';

const execFileAsync = promisify(execFile);

export interface TypstCompileOptions {
  binaryPath?: string;
  rootDir?: string;
  workDir?: string;
  sourceDateEpoch?: number | string;
  keepTempFiles?: boolean;
}

export interface TypstCompileResult {
  success: boolean;
  pdfPath: string;
  pdfBuffer: Buffer;
  durationMs: number;
  pageCount: number;
  /**
   * Delta de memoria heap asignada en el proceso padre Node.js durante la invocación y buffering de Typst.
   * NOTA AUD-04 (P2): Typst corre como child process vía execFileAsync; la medición de RAM del proceso Typst
   * en sí (VmHWM en Linux / cgroups) queda formalmente agendada como TODO de Fase 2 en el contenedor worker.
   */
  nodeHeapDeltaMb: number;
  /** @deprecated Utilizar `nodeHeapDeltaMb`. Conservado por compatibilidad de contrato. */
  memoryUsageMb: number;
  renderedSessionCount?: number;
  renderedProductoIntegradorCount?: number;
  sha256: string;
  binaryVersion: string;
  stdout?: string;
  stderr?: string;
}

/**
 * Rutas candidatas para encontrar el binario `typst` en Windows y Linux.
 */
function getPotentialBinaryPaths(): string[] {
  const paths: string[] = [];

  if (process.env.TYPST_PATH) {
    paths.push(process.env.TYPST_PATH);
  }

  // Windows: paquetes WinGet típicos
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    if (localAppData) {
      paths.push(
        path.join(
          localAppData,
          'Microsoft',
          'WinGet',
          'Packages',
          'Typst.Typst_Microsoft.Winget.Source_8wekyb3d8bbwe',
          'typst-x86_64-pc-windows-msvc',
          'typst.exe',
        ),
      );
    }
    // Windows Apps alias
    paths.push(path.join(localAppData, 'Microsoft', 'WindowsApps', 'typst.exe'));
  } else {
    // Linux / Mac / Docker
    paths.push('/usr/local/bin/typst');
    paths.push('/usr/bin/typst');
    paths.push('/opt/typst/typst');
  }

  return paths;
}

/**
 * Resuelve la ruta al ejecutable de Typst en el sistema.
 */
export function resolveTypstBinary(customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  if (process.env.TYPST_PATH && fs.existsSync(process.env.TYPST_PATH)) {
    return process.env.TYPST_PATH;
  }

  // Verificar en rutas estándar
  for (const candidate of getPotentialBinaryPaths()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback al nombre de comando en PATH del sistema
  return process.platform === 'win32' ? 'typst.exe' : 'typst';
}

/**
 * Obtiene la versión del binario Typst instalado.
 */
export async function getTypstVersion(binaryPath?: string): Promise<string> {
  const bin = resolveTypstBinary(binaryPath);
  try {
    const { stdout } = await execFileAsync(bin, ['--version']);
    return stdout.trim();
  } catch (error) {
    throw new Error(
      `No se pudo ejecutar el binario Typst en '${bin}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Verifica si Typst está instalado y ejecutable.
 */
export async function isTypstAvailable(binaryPath?: string): Promise<boolean> {
  try {
    const version = await getTypstVersion(binaryPath);
    return version.toLowerCase().includes('typst');
  } catch {
    return false;
  }
}

/**
 * Verifica de forma sincrónica si Typst está instalado y ejecutable.
 * Permite condicionar suites de tests mediante it.skipIf / describe.skipIf sin romper gates de CI.
 */
export function isTypstAvailableSync(binaryPath?: string): boolean {
  try {
    const bin = resolveTypstBinary(binaryPath);
    const result = spawnSync(bin, ['--version'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000,
    });
    if (result.error || result.status !== 0) {
      return false;
    }
    return (result.stdout || '').toLowerCase().includes('typst');
  } catch {
    return false;
  }
}

/**
 * Cuenta las páginas del buffer PDF de forma O(N) determinista escaneando marcadores /Type /Page.
 */
export function extractPageCountFromPdf(pdfBuffer: Buffer): number {
  const str = pdfBuffer.toString('latin1');
  const matches = str.match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

/**
 * Compila un archivo `.typ` existente a `.pdf`.
 */
export async function compileTypst(
  inputPath: string,
  outputPath: string,
  options: TypstCompileOptions = {},
): Promise<TypstCompileResult> {
  const startTime = Date.now();
  const binary = resolveTypstBinary(options.binaryPath);
  const version = await getTypstVersion(binary);

  const env = {
    ...process.env,
    SOURCE_DATE_EPOCH: String(options.sourceDateEpoch ?? 0),
  };

  const args = ['compile', inputPath, outputPath];
  if (options.rootDir) {
    args.push('--root', options.rootDir);
  }

  const execOptions = {
    cwd: options.workDir || path.dirname(inputPath),
    env,
    maxBuffer: 20 * 1024 * 1024,
  };

  const memBefore = process.memoryUsage();
  const { stdout, stderr } = await execFileAsync(binary, args, execOptions);
  const durationMs = Date.now() - startTime;

  if (!fs.existsSync(outputPath)) {
    throw new Error(`La compilación de Typst finalizó pero no generó el archivo esperado en '${outputPath}'.`);
  }

  const pdfBuffer = await fs.promises.readFile(outputPath);
  const memAfter = process.memoryUsage();
  // AUD-04 (P2): Mide el delta de heap del proceso padre Node.js.
  // El binario Typst corre como child process desacoplado vía execFileAsync.
  // TODO(Fase2): Medición de memoria pico del child process (VmHWM / cgroups) en worker container.
  const nodeHeapDeltaMb = Number(
    Math.max(0, (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024)).toFixed(2),
  );
  const pageCount = extractPageCountFromPdf(pdfBuffer);
  const sha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  return {
    success: true,
    pdfPath: outputPath,
    pdfBuffer,
    durationMs,
    pageCount,
    nodeHeapDeltaMb,
    memoryUsageMb: nodeHeapDeltaMb,
    sha256,
    binaryVersion: version,
    stdout,
    stderr,
  };
}

/**
 * Compila una cadena de código fuente Typst creando archivos temporales.
 */
export async function compileTypstSource(
  typstSource: string,
  outputPath?: string,
  options: TypstCompileOptions = {},
): Promise<TypstCompileResult> {
  const tempDir = options.workDir || path.join(os.tmpdir(), 'sigpda_editorial_scratch');
  await fs.promises.mkdir(tempDir, { recursive: true });

  const runId = crypto.randomUUID();
  const tempTypPath = path.join(tempDir, `doc-${runId}.typ`);
  const finalPdfPath = outputPath || path.join(tempDir, `doc-${runId}.pdf`);

  try {
    await fs.promises.writeFile(tempTypPath, typstSource, 'utf8');
    const result = await compileTypst(tempTypPath, finalPdfPath, options);
    return result;
  } finally {
    if (!options.keepTempFiles) {
      await fs.promises.unlink(tempTypPath).catch(() => {});
      if (!outputPath) {
        await fs.promises.unlink(finalPdfPath).catch(() => {});
      }
    }
  }
}

/**
 * Compila un StudentChapter completo consumiendo la plantilla de libro de texto.
 */
export async function compileStudentChapter(
  chapter: StudentChapter,
  options: TypstCompileOptions & {
    templatePath?: string;
    outputPath?: string;
  } = {},
): Promise<TypstCompileResult> {
  assertValidStudentChapter(chapter);

  const repoRoot = options.rootDir || process.cwd();
  const templatePath =
    options.templatePath || path.join(repoRoot, 'templates', 'editorial', 'workbook-template.typ');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Plantilla de Typst no encontrada en '${templatePath}'`);
  }

  const tempDir = options.workDir || path.join(os.tmpdir(), 'sigpda_editorial_scratch');
  await fs.promises.mkdir(tempDir, { recursive: true });

  const runId = crypto.randomBytes(8).toString('hex');
  const jsonPath = path.join(tempDir, `chapter-${runId}.json`);
  const typPath = path.join(tempDir, `entry-${runId}.typ`);
  const outPdfPath = options.outputPath || path.join(tempDir, `chapter-${runId}.pdf`);

  // Raíz de proyecto para Typst: contiene tanto tempDir como repoRoot
  const effectiveRootDir = options.rootDir || path.parse(repoRoot).root;

  // Rutas relativas a effectiveRootDir requeridas por Typst con bandera --root
  const rootRelativeTemplate = '/' + path.relative(effectiveRootDir, templatePath).replace(/\\/g, '/');
  const rootRelativeJson = '/' + path.relative(effectiveRootDir, jsonPath).replace(/\\/g, '/');
  const assetsRoot = '/' + path.relative(effectiveRootDir, path.join(repoRoot, 'public')).replace(/\\/g, '/');

  // Serialización normalizada y determinista del JSON
  const jsonContent = JSON.stringify({ ...chapter, assetsRoot }, null, 2);
  await fs.promises.writeFile(jsonPath, jsonContent, 'utf8');

  const entryTypSource = `
#import "${rootRelativeTemplate}": render-student-chapter

#let chapter-data = json("${rootRelativeJson}")
#render-student-chapter(chapter-data)
`.trim();

  await fs.promises.writeFile(typPath, entryTypSource, 'utf8');

  try {
    const result = await compileTypst(typPath, outPdfPath, {
      ...options,
      rootDir: effectiveRootDir,
      workDir: tempDir,
    });

    let renderedSessionCount: number | undefined;
    let renderedProductoIntegradorCount: number | undefined;
    try {
      const binary = resolveTypstBinary(options.binaryPath);
      const { stdout: queryOut } = await execFileAsync(binary, [
        'query',
        '--root',
        effectiveRootDir,
        typPath,
        '<rendered-session>',
      ]);
      const parsed = JSON.parse(queryOut);
      if (Array.isArray(parsed)) {
        renderedSessionCount = parsed.length;
      }

      const { stdout: prodOut } = await execFileAsync(binary, [
        'query',
        '--root',
        effectiveRootDir,
        typPath,
        '<rendered-producto-integrador>',
      ]);
      const parsedProd = JSON.parse(prodOut);
      if (Array.isArray(parsedProd)) {
        renderedProductoIntegradorCount = parsedProd.length;
      }
    } catch {
      // Fallback tolerante si la consulta no está soportada
    }

    return {
      ...result,
      renderedSessionCount,
      renderedProductoIntegradorCount,
    };
  } finally {
    if (!options.keepTempFiles) {
      await fs.promises.unlink(jsonPath).catch(() => {});
      await fs.promises.unlink(typPath).catch(() => {});
      if (!options.outputPath) {
        await fs.promises.unlink(outPdfPath).catch(() => {});
      }
    }
  }
}
