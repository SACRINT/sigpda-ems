import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/package.json');
const { neon } = require('@neondatabase/serverless');

// Load environment variables into process.env
const envContent = fs.readFileSync('c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      let v = trimmed.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  }
});

const db = neon(process.env.DATABASE_URL);

// Dynamically import TS modules using relative paths AFTER process.env is set
const { enrichWithExplicitSaberes, validatePlanningIntegrity, getSafeEvaluationContext } = await import('../src/lib/planning-integrity-system.ts');
const { evaluarPlaneacion } = await import('../src/lib/planeaciones-evaluator.ts');

const TARGET_ID = '6a025380-c019-4f2a-84ec-3a6f098b874f';

console.log(`\n=== 1. Obteniendo planeación ${TARGET_ID} de Neon Postgres ===`);
const rows = await db`
  SELECT p.id, p.uac_name, p.semester, p.component, p.content_json, p.paec_context, t.name as teacher_name
  FROM plannings p
  JOIN teachers t ON t.id = p.teacher_id
  WHERE p.id = ${TARGET_ID}::uuid
  LIMIT 1
`;

if (!rows.length) {
  console.error('Planeación no encontrada en la BD.');
  process.exit(1);
}

const planning = rows[0];
console.log(`UAC: ${planning.uac_name}`);
console.log(`Docente: ${planning.teacher_name}`);
console.log(`Semestre: ${planning.semester}°`);
console.log(`Componente: ${planning.component}`);

console.log('\n=== 2. Aplicando enriquecimiento con los 3 Saberes ===');
// Limpiar saberes anteriores para forzar la re-generación con los 3 bloques diferenciados
if (planning.content_json?.sectionIV?.activities) {
  planning.content_json.sectionIV.activities.forEach(a => { delete a.saberes; });
}
const enrichedContent = enrichWithExplicitSaberes(planning.content_json);

// Verificar los saberes agregados
console.log('\nSaberes desglosados en Bloque 1:');
console.log(JSON.stringify(enrichedContent.sectionIV?.activities?.[0]?.saberes, null, 2));
console.log('\nSaberes desglosados en Bloque 2:');
console.log(JSON.stringify(enrichedContent.sectionIV?.activities?.[1]?.saberes, null, 2));
console.log('\nSaberes desglosados en Bloque 3:');
console.log(JSON.stringify(enrichedContent.sectionIV?.activities?.[2]?.saberes, null, 2));

console.log('\n=== 3. Validación de integridad del sistema ===');
const integrity = validatePlanningIntegrity(enrichedContent, planning.component);
console.log('¿Es Válida?:', integrity.isValid);
console.log('Errores:', integrity.errors);
console.log('Advertencias:', integrity.warnings);
console.log('Resumen:', integrity.summary);

console.log('\n=== 4. Guardando content_json enriquecido en Neon Postgres ===');
await db`
  UPDATE plannings
  SET content_json = ${JSON.stringify(enrichedContent)}::jsonb,
      updated_at = NOW()
  WHERE id = ${TARGET_ID}::uuid
`;
console.log('✅ Base de datos actualizada con éxito.');

console.log('\n=== 5. Generando contexto de evaluación seguro (sin truncamiento) ===');
planning.content_json = enrichedContent;
const safeContext = getSafeEvaluationContext(planning);
console.log(`Longitud del texto evaluado: ${safeContext.formattedText.length} caracteres (antes cortado en 15,000)`);
console.log('Final del texto evaluado:');
console.log(safeContext.formattedText.slice(-300));

console.log('\n=== 6. Ejecutando Evaluación Oficial con IA (CRITERIOS_LABORAL) ===');
const resultado = await evaluarPlaneacion({
  tipoEvaluacion: 'LABORAL',
  asignatura: planning.uac_name,
  semestre: planning.semester,
  docenteNombre: planning.teacher_name,
  textoPlanificacion: safeContext.formattedText,
  textoPaecPec: planning.paec_context,
});

console.log('\n======================================================');
console.log(`RÚBRICA: ${resultado.rubricaUsada}`);
console.log(`PUNTAJE: ${resultado.puntajeTotal} / ${resultado.puntajeMaximo}`);
console.log(`NIVEL DE CUMPLIMIENTO: ${resultado.nivelCumplimiento}`);
console.log('======================================================');
console.log('\nDESGLOSE DE CRITERIOS:');
resultado.criterios.forEach((c) => {
  console.log(`- [${c.cumple}] ${c.criterio}: ${c.puntajeObtenido}/${c.puntajeMax} pts`);
  if (c.observacion) console.log(`    Obs: ${c.observacion}`);
});

console.log('\nPUNTOS FUERTES:', resultado.puntosFuertes);
console.log('MEJORAS URGENTES:', resultado.mejorasUrgentes);
console.log('DICTAMEN DOCENTE:\n', resultado.retroalimentacionDocente);
