const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando análisis de viabilidad del horario...");

  // 1. Cargar datos
  const profesores = await prisma.profesor.findMany({
    include: {
      asignaturas: true,
      horasBloqueadas: true,
    }
  });

  const grupos = await prisma.grupo.findMany({
    include: {
      asignaturas: {
        include: {
          profesor: true,
        }
      }
    }
  });

  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const HORAS = 7; // Asumiendo 7 horas al día
  const TOTAL_SLOTS = DIAS.length * HORAS; // 35

  console.log(`\n--- ANÁLISIS DE PROFESORES ---`);
  let viabilidadProfesores = true;

  for (const prof of profesores) {
    const horasNecesarias = prof.asignaturas.reduce((sum, asig) => sum + asig.horasSemanales, 0);
    const slotsDisponibles = TOTAL_SLOTS - prof.horasBloqueadas.length;

    console.log(`Profesor: ${prof.nombre} ${prof.apellido}`);
    console.log(`  Horas a impartir: ${horasNecesarias}`);
    console.log(`  Horas bloqueadas: ${prof.horasBloqueadas.length}`);
    console.log(`  Slots disponibles: ${slotsDisponibles}`);

    if (horasNecesarias > slotsDisponibles) {
      console.log(`  [ERROR] IMPOSIBLE: El profesor necesita dar ${horasNecesarias} horas pero solo tiene ${slotsDisponibles} disponibles.`);
      viabilidadProfesores = false;
    } else if (horasNecesarias === slotsDisponibles) {
      console.log(`  [ALERTA] CRÍTICO: El profesor no tiene margen (0 horas libres). Es muy probable que colisione con las necesidades de los grupos.`);
    } else {
      console.log(`  [OK] Tiene ${slotsDisponibles - horasNecesarias} slots de margen.`);
    }
  }

  console.log(`\n--- ANÁLISIS DE GRUPOS ---`);
  let viabilidadGrupos = true;

  for (const grupo of grupos) {
    const horasNecesarias = grupo.asignaturas.reduce((sum, asig) => sum + asig.horasSemanales, 0);
    
    console.log(`Grupo: ${grupo.grado}°${grupo.letra}`);
    console.log(`  Horas de clase: ${horasNecesarias}`);
    if (horasNecesarias > TOTAL_SLOTS) {
        console.log(`  [ERROR] IMPOSIBLE: El grupo tiene ${horasNecesarias} horas pero solo hay ${TOTAL_SLOTS} slots.`);
        viabilidadGrupos = false;
    }
  }

  console.log("\n--- RESULTADO FINAL ---");
  if (!viabilidadProfesores || !viabilidadGrupos) {
    console.log("EL HORARIO ES MATEMÁTICAMENTE IMPOSIBLE. Hay profesores o grupos que superan los límites de tiempo.");
  } else {
    console.log("Viabilidad básica (cantidad de horas vs slots): POSIBLE.");
    console.log("Nota: Podría haber imposibilidad por 'cuellos de botella' (combinatoria).");
  }

}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
