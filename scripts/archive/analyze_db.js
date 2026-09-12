const { neon } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL en el archivo .env");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  
  // Buscar un teacher_id. Como no tengo el ID a mano, obtendré el primer horario_config con datos
  const configs = await sql`
    SELECT * FROM horario_config
    WHERE config_data IS NOT NULL
    LIMIT 1
  `;
  
  if (configs.length === 0) {
    console.log("No se encontraron configuraciones guardadas.");
    return;
  }
  
  const config = configs[0].config_data;
  
  const docentes = config.docentes || [];
  const grupos = config.grupos || [];
  const cargas = config.cargas || [];
  const restriccionesDocentes = config.restriccionesDocentes || [];
  
  console.log("=== Análisis de viabilidad ===\n");
  console.log(`- Días lectivos: ${config.diasLectivos || 5}`);
  console.log(`- Horas por día: ${config.horasPorDia || 6}`);
  const TOTAL_SLOTS = (config.diasLectivos || 5) * (config.horasPorDia || 6);
  console.log(`- Total slots semanales: ${TOTAL_SLOTS}\n`);
  
  let esViable = true;
  
  // Análisis de docentes
  console.log("--- DOCENTES ---");
  for (const doc of docentes) {
    // Horas requeridas por las cargas
    const horasCarga = cargas
        .filter(c => c.docenteId === doc.id || c.personalId === doc.id)
        .reduce((sum, c) => sum + Number(c.horasSemanales || c.horas_semanales || 0), 0);
    
    // Slots bloqueados
    const res = restriccionesDocentes.find(r => r.docenteId === doc.id);
    const slotsBloqueados = res && Array.isArray(res.bloqueos) ? res.bloqueos.length : 0;
    const slotsDisponibles = TOTAL_SLOTS - slotsBloqueados;
    
    console.log(`Profesor: ${doc.nombreCompleto || doc.nombre}`);
    console.log(`  Horas requeridas: ${horasCarga}`);
    console.log(`  Slots bloqueados: ${slotsBloqueados}`);
    console.log(`  Slots disponibles: ${slotsDisponibles}`);
    
    if (horasCarga > slotsDisponibles) {
        console.log(`  [ERROR] IMPOSIBLE: Necesita dar ${horasCarga} horas pero solo tiene ${slotsDisponibles} libres.`);
        esViable = false;
    } else if (horasCarga === slotsDisponibles) {
        console.log(`  [ALERTA] CRÍTICO: No tiene slots de margen (0 horas libres extra).`);
    } else {
        console.log(`  [OK] Tiene ${slotsDisponibles - horasCarga} slots de margen.`);
    }
  }
  
  console.log("\n--- GRUPOS ---");
  for (const grp of grupos) {
    const grpId = grp.id || grp.nombre;
    const horasCarga = cargas
        .filter(c => c.grupoId === grpId || c.grupo_nombre === grp.nombre)
        .reduce((sum, c) => sum + Number(c.horasSemanales || c.horas_semanales || 0), 0);
        
    console.log(`Grupo: ${grp.nombre}`);
    console.log(`  Horas a recibir: ${horasCarga}`);
    
    if (horasCarga > TOTAL_SLOTS) {
        console.log(`  [ERROR] IMPOSIBLE: El grupo debe recibir ${horasCarga} horas pero solo hay ${TOTAL_SLOTS} en la semana.`);
        esViable = false;
    }
  }
  
  console.log("\n--- RESULTADO FINAL ---");
  if (!esViable) {
    console.log("El horario es matemáticamente IMPOSIBLE debido a la falta de slots disponibles para los docentes.");
  } else {
    console.log("El horario es matemáticamente POSIBLE en base a la cantidad total de horas y slots libres.");
  }
}

main().catch(console.error);
