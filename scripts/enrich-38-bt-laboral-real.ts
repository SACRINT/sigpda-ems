import { loadEnvLocal } from './lib/load-env';
loadEnvLocal();
import { sql } from '../src/lib/db/client';

// Generador de saberes específicos para las especialidades del Bachillerato Tecnológico
function generateBtSaberes(career: string, uacName: string, actName: string): string[] {
  const c = career.toLowerCase();
  const a = actName.toLowerCase();

  if (c.includes('computo') || c.includes('ti') || c.includes('ciberseguridad') || c.includes('programación') || c.includes('inteligencia')) {
    return [
      `Aplica procedimientos de diagnóstico, instalación y configuración técnica para ${actName}, interpretando diagramas de arquitectura lógica y manuales de fabricante.`,
      `Ejecuta pruebas de funcionalidad y rendimiento con utilerías especializadas y multímetro digital, observando normas de seguridad física, antiestática (ESD) y de protección de datos personales.`,
      `Documenta los parámetros de operación y bitácoras de servicio conforme a estándares de calidad de la industria de tecnologías de información y comunicación.`,
      `Adopta una actitud ética, proactiva y de responsabilidad social ante el resguardo y privacidad de la información institucional del usuario.`
    ];
  } else if (c.includes('solar') || c.includes('energía') || c.includes('eléctric') || c.includes('mantenimiento') || c.includes('instrumentación') || c.includes('mecatrónica')) {
    return [
      `Interpreta diagramas unifilares, esquemas de conexión y especificaciones técnicas para la ejecución segura de ${actName} conforme a la NOM-001-SEDE.`,
      `Maneja instrumental de medición eléctrica y herramientas de taller industrial, calibrando sensores y verificando parámetros nominales de voltaje, corriente y aislamiento.`,
      `Aplica protocolos de bloqueo y etiquetado (LOTO), equipo de protección personal (EPP dieléctrico) y normatividad de seguridad e higiene industrial NOM-029-STPS.`,
      `Demuestra rigor técnico en el ensamble y cableado, optimizando los recursos energéticos y previniendo impactos ambientales adversos.`
    ];
  } else if (c.includes('refrigeración') || c.includes('aire')) {
    return [
      `Aplica principios de termodinámica y ciclos de refrigeración por compresión de vapor en la ejecución de ${actName}, respetando normas de contención de gases refrigerantes.`,
      `Utiliza manómetros manifold, bombas de vacío, vacuómetros y detectores electrónicos de fugas, asegurando presiones y temperaturas de saturación óptimas.`,
      `Cumple con el Protocolo de Montreal y la normatividad ambiental de recuperación y reciclaje seguro de fluidos refrigerantes sin emisión a la atmósfera.`,
      `Mantiene orden, pulcritud y disciplina en el manejo de cilindros presurizados y equipo de oxicorte para soldadura de tuberías de cobre.`
    ];
  } else if (c.includes('acuátic') || c.includes('salud') || c.includes('alimento') || c.includes('agro')) {
    return [
      `Aplica metodologías y protocolos normativos higiénico-sanitarios y de bioseguridad para el desarrollo de ${actName} en entornos especializados.`,
      `Opera equipo e instrumental técnico con apego a guías operativas, verificando condiciones de inocuidad, desinfección y salvaguarda de la integridad física.`,
      `Registra bitácoras de control continuo y reporta desviaciones técnicas al personal responsable para implementar acciones correctivas inmediatas.`,
      `Muestra empatía, ética profesional, respeto a la dignidad humana y compromiso con el cuidado de los ecosistemas y la salud comunitaria.`
    ];
  } else {
    // Administración, Emprendimiento, Logística, Hospedaje
    return [
      `Aplica técnicas de análisis, levantamiento de información y modelado operativo para ${actName}, conforme a los manuales organizacionales y legislación aplicable.`,
      `Elabora instrumentos de control, registros estructurados en hojas de cálculo y bases de datos relacionales para optimizar la toma de decisiones.`,
      `Monitorea indicadores clave de desempeño (KPI) y estándares de calidad en el servicio al cliente y gestión de inventarios.`,
      `Muestra probidad ética, confidencialidad en el tratamiento de información y actitud colaborativa orientada a la mejora continua.`
    ];
  }
}

async function main() {
  console.log('========================================================================');
  console.log('  ENRIQUECIMIENTO DE SABERES EN BACHILLERATO TECNOLÓGICO (FASE 2)       ');
  console.log('  Eliminación de saberes: [] en las 38 UACs de subsystem = tecnologico  ');
  console.log('========================================================================\n');

  const db = sql();

  const rows = await db`
    SELECT id, uac_name, curriculum_name, semester, activities, contenidos_formativos
    FROM programs_catalog
    WHERE component = 'laboral' AND subsystem = 'tecnologico'
  `;

  console.log(`Total UACs Tecnológico evaluadas: ${rows.length}`);
  let updatedUacs = 0;
  let fixedActivities = 0;

  for (const r of rows) {
    const acts = Array.isArray(r.activities) ? r.activities : [];
    const cfs = Array.isArray(r.contenidos_formativos) ? r.contenidos_formativos : [];
    let needsUpdate = false;

    // 1. Revisar y reparar activities
    const updatedActs = acts.map((a: any) => {
      const actName = typeof a === 'string' ? a : (a.name || a.actividad || 'Actividad técnica');
      let actSaberes = a.saberes;
      if (!actSaberes || (Array.isArray(actSaberes) && actSaberes.length === 0)) {
        actSaberes = generateBtSaberes(r.curriculum_name, r.uac_name, actName);
        fixedActivities++;
        needsUpdate = true;
      }
      return {
        ...a,
        saberes: actSaberes
      };
    });

    // 2. Revisar y reparar contenidos_formativos
    const updatedCfs = cfs.map((cf: any, idx: number) => {
      const actName = cf.actividad || cf.contenidoFormativo || updatedActs[idx]?.name || 'Actividad técnica';
      let cfSaberes = cf.saberes;
      if (!cfSaberes || (Array.isArray(cfSaberes) && cfSaberes.length === 0)) {
        cfSaberes = generateBtSaberes(r.curriculum_name, r.uac_name, actName);
        needsUpdate = true;
      }
      return {
        ...cf,
        saberes: cfSaberes
      };
    });

    if (needsUpdate) {
      await db`
        UPDATE programs_catalog
        SET activities = ${JSON.stringify(updatedActs)},
            contenidos_formativos = ${JSON.stringify(updatedCfs)}
        WHERE id = ${r.id}
      `;
      updatedUacs++;
      console.log(`  ✓ UAC BT reparada: [${r.curriculum_name}] "${r.uac_name}"`);
    }
  }

  console.log('\n========================================================================');
  console.log(`Total UACs Tecnológico reparadas: ${updatedUacs}`);
  console.log(`Total Actividades con saberes completados: ${fixedActivities}`);
  console.log('========================================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('[enrich-38-bt-laboral-real] Error:', err);
  process.exit(1);
});
