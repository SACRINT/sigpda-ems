import { PrismaClient } from '@prisma/client';

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
    console.log(`  Horas a impartir (todas sus asignaturas): ${horasNecesarias}`);
    console.log(`  Horas bloqueadas: ${prof.horasBloqueadas.length}`);
    console.log(`  Slots disponibles: ${slotsDisponibles}`);

    if (horasNecesarias > slotsDisponibles) {
      console.log(`  [ERROR] IMPOSIBLE: El profesor necesita dar ${horasNecesarias} horas pero solo tiene ${slotsDisponibles} horas disponibles.`);
      viabilidadProfesores = false;
    } else {
      console.log(`  [OK] Tiene suficientes slots.`);
    }

    // Análisis de colisión de grupos (mismo profesor, misma hora)
    // No es necesario en este nivel básico, ya que solo importa el total de slots vs total de horas.
  }

  console.log(`\n--- ANÁLISIS DE GRUPOS ---`);
  let viabilidadGrupos = true;

  for (const grupo of grupos) {
    const horasNecesarias = grupo.asignaturas.reduce((sum, asig) => sum + asig.horasSemanales, 0);
    
    // Contar cuántos slots están disponibles para el grupo.
    // Un slot está disponible para el grupo si AL MENOS UN profesor de sus asignaturas está disponible en ese slot.
    // Peor caso: todos los profesores del grupo están bloqueados al mismo tiempo, dejando al grupo sin clase.
    // Para ser precisos, un grupo necesita 'horasNecesarias' slots. Esos slots no deben coincidir TODOS con bloqueos de TODOS sus profesores.
    
    console.log(`Grupo: ${grupo.grado}°${grupo.letra}`);
    console.log(`  Horas a recibir: ${horasNecesarias}`);
    if (horasNecesarias > TOTAL_SLOTS) {
        console.log(`  [ERROR] IMPOSIBLE: El grupo debe recibir ${horasNecesarias} horas pero solo hay ${TOTAL_SLOTS} slots en la semana.`);
        viabilidadGrupos = false;
    } else {
        console.log(`  [OK] Horas de clase (${horasNecesarias}) <= Total slots de la semana (${TOTAL_SLOTS}).`);
    }
  }

  console.log("\n--- RESULTADO FINAL ---");
  if (!viabilidadProfesores || !viabilidadGrupos) {
    console.log("EL HORARIO ES MATEMÁTICAMENTE IMPOSIBLE. Hay profesores o grupos que superan los límites de tiempo.");
  } else {
    console.log("Viabilidad básica (cantidad de horas vs slots): POSIBLE.");
    console.log("Nota: Podría haber imposibilidad por 'cuellos de botella' (ej. 5 profesores necesitan dar clase al grupo A, y todos solo pueden el Viernes a la hora 1). Esto requiere un análisis combinatorio más profundo.");
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
