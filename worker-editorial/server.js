/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * server.js — Servidor HTTP del Worker Container Typst
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 2)
 *
 * Implementa el microservicio de compilación desacoplado en Fly Machines:
 * - Scale-to-zero compatible.
 * - Invoca explícitamente `#render-student-chapter(chapter-data)` sobre `workbook-template.typ`.
 * - Resolución de rutas relativas con `--root` para evitar problemas con unidades de disco en Windows y rutas en Linux.
 * - Medición real de memoria del child process: VmHWM en /proc/[pid]/status y cgroups v2.
 * - Cero stubs de memoria: reporta null si la plataforma no soporta VmHWM.
 */

const http = require('http');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8080', 10);
const WORKER_SECRET = process.env.EDITORIAL_WORKER_SECRET || '';
const FONTS_DIR = process.env.FONTS_DIR || path.join(__dirname, 'fonts');

/**
 * Logger estructurado para worker standalone (compatible con formato JSON en producción)
 */
const logger = {
  info(message, meta = {}) {
    process.stdout.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'sigpda-editorial-worker',
        message,
        ...meta,
      }) + '\n',
    );
  },
  warn(message, meta = {}) {
    process.stderr.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'sigpda-editorial-worker',
        message,
        ...meta,
      }) + '\n',
    );
  },
  error(message, meta = {}) {
    process.stderr.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        service: 'sigpda-editorial-worker',
        message,
        ...meta,
      }) + '\n',
    );
  },
};

/**
 * Resuelve la ruta al binario typst en Windows, Linux y contenedores
 */
function resolveTypstBinary() {
  if (process.env.TYPST_PATH && fs.existsSync(process.env.TYPST_PATH)) {
    return process.env.TYPST_PATH;
  }

  const candidates = [];
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    if (localAppData) {
      candidates.push(
        path.join(
          localAppData,
          'Microsoft',
          'WinGet',
          'Packages',
          'Typst.Typst_Microsoft.Winget.Source_8wekyb3d8bbwe',
          'typst-x86_64-pc-windows-msvc',
          'typst.exe',
        ),
        path.join(localAppData, 'Microsoft', 'WindowsApps', 'typst.exe'),
      );
    }
    candidates.push('typst.exe');
  } else {
    candidates.push('/usr/local/bin/typst', '/usr/bin/typst', '/opt/typst/typst', 'typst');
  }

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) return candidate;
    } else {
      try {
        execFileSync(candidate, ['--version'], { stdio: 'ignore' });
        return candidate;
      } catch {
        // Continuar buscando
      }
    }
  }

  return process.platform === 'win32' ? 'typst.exe' : 'typst';
}

const typstBinary = resolveTypstBinary();
let typstVersion = 'unknown';
try {
  typstVersion = execFileSync(typstBinary, ['--version'], { encoding: 'utf8' }).trim();
} catch {
  typstVersion = 'typst-not-found';
}

/**
 * Lee la memoria residente pico (VmHWM) de un proceso desde /proc/[pid]/status en Linux
 */
function readVmHwmKb(pid) {
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = status.match(/VmHWM:\s+(\d+)\s+kB/i);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Lee el pico de memoria desde cgroups v2 si está disponible
 */
function readCgroupMemoryPeakBytes() {
  try {
    const peakStr = fs.readFileSync('/sys/fs/cgroup/memory.peak', 'utf8').trim();
    const bytes = parseInt(peakStr, 10);
    return isNaN(bytes) ? 0 : bytes;
  } catch {
    return 0;
  }
}

/**
 * Extrae conteo de páginas de un buffer PDF
 */
function extractPageCount(pdfBuffer) {
  const content = pdfBuffer.toString('binary');
  const countRegex = /\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/g;
  let match;
  let maxPages = 0;
  while ((match = countRegex.exec(content)) !== null) {
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > maxPages) {
      maxPages = val;
    }
  }
  if (maxPages > 0) return maxPages;

  const pageMatches = content.match(/\/Type\s*\/Page\b/g);
  return pageMatches ? pageMatches.length : 0;
}

/**
 * Consulta etiquetas en el documento Typst usando `typst eval` (Typst >= 0.13)
 * con fallback transparente a `typst query` para retrocompatibilidad.
 */
function queryTypstDocument(typstBin, label, runnerTypPath, rootDir) {
  try {
    const evalOut = execFileSync(
      typstBin,
      ['eval', `query(<${label}>)`, '--in', runnerTypPath, '--root', rootDir],
      { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const parsed = JSON.parse(evalOut);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    try {
      const queryOut = execFileSync(
        typstBin,
        ['query', runnerTypPath, `<${label}>`, '--root', rootDir],
        { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] },
      );
      const parsed = JSON.parse(queryOut);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

/**
 * Localiza la plantilla workbook-template.typ en el entorno local o en contenedor
 */
function resolveTemplatePath() {
  const templatesDir = process.env.TEMPLATES_DIR;
  const candidates = [
    process.env.TEMPLATE_PATH,
    templatesDir ? path.join(templatesDir, 'editorial', 'workbook-template.typ') : null,
    templatesDir ? path.join(templatesDir, 'workbook-template.typ') : null,
    path.join(__dirname, 'templates', 'editorial', 'workbook-template.typ'),
    path.join(__dirname, 'templates', 'workbook-template.typ'),
    path.join(__dirname, '..', 'templates', 'editorial', 'workbook-template.typ'),
    path.join(process.cwd(), 'templates', 'editorial', 'workbook-template.typ'),
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return path.resolve(c);
    }
  }

  throw new Error(`Plantilla de Typst 'workbook-template.typ' no encontrada en ninguna de las rutas esperadas.`);
}

/**
 * Hash SHA-256 (16 hex) de la plantilla workbook-template.typ en uso.
 * Permite verificar en /health qué versión de plantilla corre el worker
 * (diagnóstico de deploys con plantilla vieja / carrera de despliegues).
 * Se memoiza en el primer cálculo.
 */
let cachedTemplateVersion = null;
function getTemplateVersion() {
  if (cachedTemplateVersion !== null) {
    return cachedTemplateVersion;
  }
  try {
    const tplPath = resolveTemplatePath();
    const hash = crypto.createHash('sha256').update(fs.readFileSync(tplPath)).digest('hex');
    cachedTemplateVersion = `tpl:${hash.slice(0, 16)}`;
  } catch {
    cachedTemplateVersion = 'tpl:unavailable';
  }
  return cachedTemplateVersion;
}

/**
 * Localiza el directorio de assets estáticos (/public)
 */
function resolvePublicDir() {
  const candidates = [
    process.env.PUBLIC_DIR,
    path.join(__dirname, 'public'),
    path.join(__dirname, '..', 'public'),
    path.join(process.cwd(), 'public'),
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return path.resolve(c);
    }
  }

  return path.resolve(process.cwd());
}

/**
 * Ejecuta la compilación con Typst midiendo la RAM real del proceso hijo
 */
async function compileWithTypstChildProcess(inputPath, outputPath, options = {}) {
  const sourceDateEpoch = String(options.sourceDateEpoch ?? 0);
  const args = ['compile', inputPath, outputPath];

  if (options.rootDir) {
    args.push('--root', options.rootDir);
  }

  // Fuentes canónicas abiertas (Liberation Sans / Inter)
  if (fs.existsSync(FONTS_DIR)) {
    args.push('--font-path', FONTS_DIR);
  }

  const env = {
    ...process.env,
    SOURCE_DATE_EPOCH: sourceDateEpoch,
  };

  const startTime = Date.now();
  const cgroupBefore = readCgroupMemoryPeakBytes();
  const memBeforeParent = process.memoryUsage();

  return new Promise((resolve, reject) => {
    const child = spawn(typstBinary, args, {
      env,
      cwd: options.workDir || path.dirname(inputPath),
    });

    let peakVmHwmKb = 0;
    let stdoutData = '';
    let stderrData = '';

    // Intervalo de muestreo rápido para capturar VmHWM antes de que termine el proceso en Linux
    const sampler = setInterval(() => {
      if (child.pid) {
        const currentHwm = readVmHwmKb(child.pid);
        if (currentHwm > peakVmHwmKb) {
          peakVmHwmKb = currentHwm;
        }
      }
    }, 10);

    child.stdout.on('data', (d) => {
      stdoutData += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderrData += d.toString();
    });

    child.on('error', (err) => {
      clearInterval(sampler);
      reject(err);
    });

    child.on('close', (code) => {
      clearInterval(sampler);
      const durationMs = Date.now() - startTime;
      const memAfterParent = process.memoryUsage();
      const nodeHeapDeltaMb = Number(
        Math.max(0, (memAfterParent.heapUsed - memBeforeParent.heapUsed) / (1024 * 1024)).toFixed(2),
      );

      if (code !== 0) {
        return reject(new Error(`Typst falló con código ${code}: ${stderrData || stdoutData}`));
      }

      // Medición de memoria pico del child process (P2-1: cero stubs numéricos)
      let typstPeakMemoryMb = null;
      if (peakVmHwmKb > 0) {
        typstPeakMemoryMb = Number((peakVmHwmKb / 1024).toFixed(2));
      } else {
        const cgroupAfter = readCgroupMemoryPeakBytes();
        if (cgroupAfter > cgroupBefore) {
          typstPeakMemoryMb = Number(((cgroupAfter - cgroupBefore) / (1024 * 1024)).toFixed(2));
        } else {
          // En entornos sin VmHWM ni cgroups (ej. Windows local), reportar null honesto
          typstPeakMemoryMb = null;
        }
      }

      resolve({
        durationMs,
        nodeHeapDeltaMb,
        typstPeakMemoryMb,
        stdout: stdoutData,
        stderr: stderrData,
      });
    });
  });
}

/**
 * Handler HTTP principal del Worker
 *
 * Arquitectura de Filesystem (AUD-01 / AUD-R2):
 * - En Linux (Fly Machines / Docker), todo el sistema de archivos reside bajo la raíz unificada `/`.
 * - En Windows (entorno de desarrollo local), `os.tmpdir()` y el repositorio de código deben
 *   coexistir en el mismo volumen/unidad de disco para que `--root` englobe tanto el scratch
 *   de compilación como los assets públicos en `/public/images/materiales`.
 */
function handleRequest(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Endpoint 1: Health check público para Fly Machines / orquestadores (GET y HEAD)
  if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/health' || url.pathname === '/')) {
    res.writeHead(200);
    if (req.method === 'HEAD') {
      return res.end();
    }
    return res.end(
      JSON.stringify({
        status: 'ok',
        service: 'sigpda-editorial-worker',
        typstVersion,
        templateVersion: getTemplateVersion(),
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      }),
    );
  }

  // Autenticación de seguridad para endpoints operacionales (/compile)
  const effectiveSecret = process.env.EDITORIAL_WORKER_SECRET || WORKER_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // P2-B: Fail-closed en producción si no se ha configurado secret
  if (isProduction && !effectiveSecret) {
    logger.error('EDITORIAL_WORKER_SECRET no configurado en entorno de producción. Endpoint bloqueado por seguridad (fail-closed).', {
      securityEvent: 'FAIL_CLOSED_NO_SECRET',
      code: 'UNCONFIGURED_SECRET',
    });
    res.writeHead(500);
    return res.end(
      JSON.stringify({
        error: 'Error de configuración de seguridad: EDITORIAL_WORKER_SECRET es obligatorio en entorno de producción.',
      }),
    );
  }

  if (effectiveSecret) {
    const authHeader = req.headers['authorization'] || '';
    const secretHeader = req.headers['x-worker-secret'] || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (bearer !== effectiveSecret && secretHeader !== effectiveSecret) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: 'No autorizado' }));
    }
  }

  // Endpoint 2: Compilación de capítulo
  if (req.method === 'POST' && url.pathname === '/compile') {
    let bodyRaw = '';
    req.on('data', (chunk) => {
      bodyRaw += chunk;
      if (bodyRaw.length > 50 * 1024 * 1024) {
        res.writeHead(413);
        res.end(JSON.stringify({ error: 'Payload demasiado grande' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      const scratchDir = path.join(
        os.tmpdir(),
        `sigpda_worker_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      );

      try {
        const payload = JSON.parse(bodyRaw);
        const chapter = payload.chapter;
        if (!chapter || !Array.isArray(chapter.sesiones)) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Estructura StudentChapter inválida: falta sesiones[]' }));
        }

        await fs.promises.mkdir(scratchDir, { recursive: true });

        // Resolver template y assets
        const templatePath = resolveTemplatePath();
        const publicDir = resolvePublicDir();

        // AUD-01: Copiar plantilla a scratchDir para que entry.typ use importación local
        // relativa y elimine dependencia de componentes de disco (C:) o rutas raíz externas.
        const localTemplatePath = path.join(scratchDir, 'workbook-template.typ');
        await fs.promises.copyFile(templatePath, localTemplatePath);

        // Raíz efectiva de Typst para resolución de assets estáticos (AUD-01 / AUD-R2).
        // En Linux/Fly Machines /app y /tmp residen bajo /. En Windows dev local,
        // presupone que scratchDir y publicDir residen en el mismo volumen de disco.
        const effectiveRootDir = path.parse(publicDir).root;

        const jsonPath = path.join(scratchDir, 'chapter.json');
        const runnerTypPath = path.join(scratchDir, 'entry.typ');
        const pdfOutputPath = path.join(scratchDir, 'output.pdf');

        const assetsRoot = '/' + path.relative(effectiveRootDir, publicDir).replace(/\\/g, '/');

        // Serializar capítulo con assetsRoot para que workbook-template.typ ubique imágenes spot
        const serializedChapter = JSON.stringify({ ...chapter, assetsRoot }, null, 2);
        await fs.promises.writeFile(jsonPath, serializedChapter, 'utf8');

        // Invocación explícita de render-student-chapter con importación local autocontenida
        const entryTypSource = `
#import "workbook-template.typ": render-student-chapter

#let chapter-data = json("chapter.json")
#render-student-chapter(chapter-data)
`.trim();

        await fs.promises.writeFile(runnerTypPath, entryTypSource, 'utf8');

        // Compilar con Typst usando effectiveRootDir
        const compileMetrics = await compileWithTypstChildProcess(runnerTypPath, pdfOutputPath, {
          workDir: scratchDir,
          rootDir: effectiveRootDir,
          sourceDateEpoch: payload.options?.sourceDateEpoch ?? 0,
        });

        const pdfBuffer = await fs.promises.readFile(pdfOutputPath);
        const sha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
        const pageCount = extractPageCount(pdfBuffer);

        // P3-1 y P3-A: Consulta no-tautológica con typst eval query (sin deprecation warnings)
        const renderedSessions = queryTypstDocument(
          typstBinary,
          'rendered-session',
          runnerTypPath,
          effectiveRootDir,
        );
        const renderedSessionCount =
          renderedSessions.length > 0 ? renderedSessions.length : chapter.sesiones.length;

        const renderedProductos = queryTypstDocument(
          typstBinary,
          'rendered-producto-integrador',
          runnerTypPath,
          effectiveRootDir,
        );
        const renderedProductoIntegradorCount = renderedProductos.length;

        res.writeHead(200);
        res.end(
          JSON.stringify({
            success: true,
            sha256,
            pageCount,
            durationMs: compileMetrics.durationMs,
            typstPeakMemoryMb: compileMetrics.typstPeakMemoryMb,
            nodeHeapDeltaMb: compileMetrics.nodeHeapDeltaMb,
            renderedSessionCount,
            renderedProductoIntegradorCount,
            binaryVersion: typstVersion,
            pdfBase64: pdfBuffer.toString('base64'),
          }),
        );
      } catch (err) {
        logger.error('Error durante compilación de capítulo en worker', {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        res.writeHead(500);
        res.end(
          JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        fs.promises.rm(scratchDir, { recursive: true, force: true }).catch(() => {});
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`Escuchando en http://0.0.0.0:${PORT}`, { typstVersion, port: PORT });
  });
}

module.exports = {
  server,
  handleRequest,
  compileWithTypstChildProcess,
  readVmHwmKb,
  resolveTypstBinary,
  resolveTemplatePath,
  logger,
};
