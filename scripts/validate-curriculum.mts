import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  UACSchema,
  type UACCanonical,
} from './schemas/curriculum-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface ValidationIssue {
  uacName: string;
  semester: number;
  component: string;
  field?: string;
  message: string;
}

interface ValidationReport {
  total: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  pm1CheckPassed: boolean;
}

export function validateCurriculumJson(filePath?: string): ValidationReport {
  const targetPath = filePath || path.join(rootDir, 'scripts', 'data', 'curriculum_canonical_203.json');
  if (!existsSync(targetPath)) {
    throw new Error(`Archivo no encontrado: ${targetPath}`);
  }

  const raw = readFileSync(targetPath, 'utf-8');
  const uacs: unknown[] = JSON.parse(raw);

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  let pm1CheckPassed = false;

  for (const rawItem of uacs) {
    const item = typeof rawItem === 'object' && rawItem !== null ? (rawItem as Record<string, unknown>) : {};
    const uacName = typeof item.uac_name === 'string' ? item.uac_name : 'UAC_SIN_NOMBRE';
    const semester = typeof item.semester === 'number' ? item.semester : 0;
    const component = typeof item.component === 'string' ? item.component : 'desconocido';

    // ── 1. Validación de Esquema Zod ─────────────────────────────────────────
    const schemaResult = UACSchema.safeParse(item);
    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        errors.push({
          uacName,
          semester,
          component,
          field: issue.path.join('.'),
          message: `[ZOD] ${issue.message}`,
        });
      }
      continue;
    }

    const uac: UACCanonical = schemaResult.data;

    // ── 2. Reglas de Negocio Específicas ─────────────────────────────────────

    // Regla A: UACs Fundamentales (semestres 1 a 4) deben tener contenidos formativos no vacíos
    if (uac.component === 'fundamental' && uac.semester <= 4) {
      if (!uac.contenidos_formativos || uac.contenidos_formativos.length === 0) {
        errors.push({
          uacName,
          semester,
          component,
          field: 'contenidos_formativos',
          message: `UAC Fundamental sem ${uac.semester} DEBE tener contenidos_formativos poblados (actualmente vacío/null)`,
        });
      }
    }

    // Regla B: UACs Fundamentales deben tener learning_outcome no nulo
    if (uac.component === 'fundamental') {
      if (!uac.learning_outcome || uac.learning_outcome.trim().length < 10) {
        errors.push({
          uacName,
          semester,
          component,
          field: 'learning_outcome',
          message: `UAC Fundamental DEBE tener learning_outcome auténtico no nulo (mínimo 10 caracteres)`,
        });
      }
    }

    // Regla C: Validación de Propósitos y Contenidos Formativos
    if (uac.contenidos_formativos && uac.contenidos_formativos.length > 0) {
      const seenProps = new Set<string>();

      for (const cf of uac.contenidos_formativos) {
        // C.1: Al menos 1 contenido
        if (!cf.contenidos || cf.contenidos.length === 0) {
          errors.push({
            uacName,
            semester,
            component,
            field: `cf[${cf.order}].contenidos`,
            message: `El propósito formativo ${cf.order} no tiene contenidos asociados`,
          });
        }

        // C.2: Detección de fallback destructivo (propósito idéntico a contenido único)
        if (
          cf.contenidos &&
          cf.contenidos.length === 1 &&
          cf.contenidos[0].trim().toLowerCase() === cf.proposito.trim().toLowerCase()
        ) {
          errors.push({
            uacName,
            semester,
            component,
            field: `cf[${cf.order}]`,
            message: `Fallback erróneo detectado: el contenido es idéntico al propósito "${cf.proposito.substring(0, 40)}..."`,
          });
        }

        // C.3: Sin contenidos vacíos
        for (const c of cf.contenidos || []) {
          if (!c || c.trim().length === 0) {
            errors.push({
              uacName,
              semester,
              component,
              field: `cf[${cf.order}].contenidos`,
              message: `Se encontró un contenido vacío en PF ${cf.order}`,
            });
          }
        }

        // C.4: Sin propósitos duplicados
        const normProp = cf.proposito.trim().toLowerCase();
        if (seenProps.has(normProp)) {
          errors.push({
            uacName,
            semester,
            component,
            field: `cf[${cf.order}].proposito`,
            message: `Propósito formativo duplicado en la misma UAC: "${cf.proposito.substring(0, 40)}..."`,
          });
        }
        seenProps.add(normProp);
      }
    }

    // Regla D: Total de horas cuadra con la suma de actividades (tolerancia ±1)
    if (uac.activities && uac.activities.length > 0) {
      const hasHours = uac.activities.some((a) => typeof a.hours === 'number');
      if (hasHours) {
        const sumHours = uac.activities.reduce((acc, a) => acc + (a.hours || 0), 0);
        const diff = Math.abs(uac.total_hours - sumHours);
        if (diff > 1) {
          warnings.push({
            uacName,
            semester,
            component,
            field: 'activities[].hours',
            message: `Discrepancia de horas: total_hours=${uac.total_hours} vs suma actividades=${sumHours} (diferencia: ${diff}h)`,
          });
        }
      }
    }

    // ── 3. Test de Aceptación Especial: Pensamiento Matemático I ──────────────
    if (uac.uac_name === 'Pensamiento Matemático I' && uac.semester === 1) {
      const cfs = uac.contenidos_formativos || [];
      const pf1 = cfs.find((c) => c.order === 1);
      const pf2 = cfs.find((c) => c.order === 2);
      const pf3 = cfs.find((c) => c.order === 3);
      const pf4 = cfs.find((c) => c.order === 4);

      const pf1Valid =
        pf1 &&
        pf1.contenidos.length === 4 &&
        pf1.contenidos.some((c) => c.toLowerCase().includes('lógica matemática')) &&
        pf1.contenidos.some((c) => c.toLowerCase().includes('tablas de verdad'));

      const pf2Valid =
        pf2 &&
        pf2.contenidos.length === 4 &&
        pf2.contenidos.some((c) => c.toLowerCase().includes('sistemas de conteo')) &&
        pf2.contenidos.some((c) => c.toLowerCase().includes('ábaco') || c.toLowerCase().includes('abaco'));

      const pf3Valid = pf3 && pf3.contenidos.length === 5;
      const pf4Valid = pf4 && pf4.contenidos.length === 4;

      if (cfs.length === 7 && pf1Valid && pf2Valid && pf3Valid && pf4Valid) {
        pm1CheckPassed = true;
      } else {
        errors.push({
          uacName,
          semester,
          component,
          field: 'pm1_acceptance_gate',
          message: `Fallo en el Gate de Aceptación de PM I: PFs=${cfs.length}/7, PF1_4conts=${!!pf1Valid}, PF2_4conts=${!!pf2Valid}, PF3_5conts=${!!pf3Valid}, PF4_4conts=${!!pf4Valid}`,
        });
      }
    }
  }

  const errorUacNames = new Set(errors.map((e) => e.uacName));
  const warningUacNames = new Set(warnings.map((w) => w.uacName));
  const validCount = uacs.length - errorUacNames.size;

  return {
    total: uacs.length,
    validCount,
    warningCount: warningUacNames.size,
    errorCount: errorUacNames.size,
    errors,
    warnings,
    pm1CheckPassed,
  };
}

// ── Ejecución CLI ─────────────────────────────────────────────────────────────
function runCli() {
  console.log('===============================================================');
  console.log('🛡️  QUALITY GATE FORMAL: VALIDACIÓN CURRICULAR CANÓNICA (ZOD)');
  console.log('===============================================================\n');

  try {
    const report = validateCurriculumJson();

    console.log(`📊 RESULTADOS DEL ANÁLISIS:`);
    console.log(`  • Total UACs procesadas : ${report.total}`);
    console.log(`  • UACs 100% Válidas     : \x1b[32m${report.validCount}\x1b[0m`);
    console.log(`  • UACs con Advertencias : \x1b[33m${report.warningCount}\x1b[0m`);
    console.log(`  • UACs con Errores      : \x1b[31m${report.errorCount}\x1b[0m\n`);

    console.log(`🔍 VERIFICACIÓN DE CONTROL DE CALIDAD (PENSAMIENTO MATEMÁTICO I):`);
    if (report.pm1CheckPassed) {
      console.log(`  \x1b[32m✓ PASÓ GATE PM I:\x1b[0m 7 Propósitos Formativos completos.`);
      console.log(`    - PF 1: 4 contenidos (incluyendo "Tablas de verdad" y "Lógica matemática")`);
      console.log(`    - PF 2: 4 contenidos (Sistemas de conteo, Leonardo de Pisa, Ábaco)`);
      console.log(`    - PF 3: 5 contenidos (Reales, Enteros, MCD, MCM, Factorización)`);
      console.log(`    - PF 4: 4 contenidos (Fracciones, Proporciones, Porcentajes)`);
    } else {
      console.log(`  \x1b[31m✗ FALLÓ GATE PM I:\x1b[0m Estructura de PM I no satisface los criterios canónicos.`);
    }

    if (report.warnings.length > 0) {
      console.log(`\n⚠️  ADVERTENCIAS DETECTADAS (${report.warnings.length}):`);
      for (const w of report.warnings.slice(0, 10)) {
        console.log(`  [\x1b[33mWARN\x1b[0m] ${w.uacName} (Sem ${w.semester}): ${w.message}`);
      }
      if (report.warnings.length > 10) {
        console.log(`  ... (+${report.warnings.length - 10} advertencias adicionales)`);
      }
    }

    if (report.errors.length > 0) {
      console.log(`\n❌ ERRORES CRÍTICOS DETECTADOS (${report.errors.length}):`);
      for (const e of report.errors) {
        console.log(`  [\x1b[31mERROR\x1b[0m] ${e.uacName} (Sem ${e.semester}) [${e.field}]: ${e.message}`);
      }
      console.log('\n❌ ESTADO: BLOQUEADO PARA SINCRONIZACIÓN DB (Existen errores que deben corregirse).');
      process.exit(1);
    } else {
      console.log('\n✅ ESTADO: APTO PARA SINCRONIZACIÓN A NEON DB (0 errores críticos).');
      process.exit(0);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n💥 Error durante la validación:`, errorMsg);
    process.exit(1);
  }
}

// Ejecutar automáticamente si es llamado desde terminal
if (process.argv[1]?.endsWith('validate-curriculum.mts') || process.argv[1]?.endsWith('validate-curriculum.ts')) {
  runCli();
}
