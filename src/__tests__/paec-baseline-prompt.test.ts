import { describe, it, expect } from 'vitest';
import {
  buildPrompt1Diagnostico,
  buildStatisticalBaselinePromptBlock,
  type PaecAcademicBaseline,
} from '@/lib/prompts/paec-prompts';

describe('B1: Inyección de Línea Base Estadística de Zona en Prompts PAEC (Paso 1)', () => {
  const commMock = '{"location": "San Jerónimo Caleras", "demographics": "Población semiurbana"}';
  const schoolMock = '{"cct": "21EBH0004Z", "schoolName": "Lic. Moisés Sáenz Garza"}';
  const problemMock = 'Contaminación por residuos plásticos en el río Atoyac';

  it('1. Plantel sin línea base estadística: No incluye bloque estadístico ni valores 0%', () => {
    const prompt = buildPrompt1Diagnostico(commMock, schoolMock, problemMock, null);

    expect(prompt).not.toContain('LÍNEA BASE ESTADÍSTICA OFICIAL');
    expect(prompt).not.toContain('0% de abandono');
    expect(prompt).not.toContain('0%');
  });

  it('2. Plantel sin dato de abandono pero con otras métricas: Omite abandono estrictamente sin poner 0%', () => {
    const partialBaseline: PaecAcademicBaseline = {
      eficienciaTerminal: 84.5,
      promEficienciaZona: 81.2,
      problematicasComunesZona: ['Rezago en comprensión lectora', 'Infraestructura deficiente'],
    };

    const prompt = buildPrompt1Diagnostico(commMock, schoolMock, problemMock, partialBaseline);

    expect(prompt).toContain('LÍNEA BASE ESTADÍSTICA OFICIAL (911/F11 y Cartografía de Zona)');
    expect(prompt).toContain('Eficiencia terminal del plantel: 84.5%');
    expect(prompt).toContain('Promedio de eficiencia terminal de la zona: 81.2%');
    expect(prompt).toContain('Problemáticas comunes reportadas en la zona: Rezago en comprensión lectora, Infraestructura deficiente');

    // Criterio crítico: El bloque estadístico NO debe contener "abandono" ni el prompt "0% de abandono"
    const block = buildStatisticalBaselinePromptBlock(partialBaseline);
    expect(block).not.toContain('abandono');
    expect(prompt).not.toContain('0% de abandono');
    expect(prompt).not.toContain('Tasa de abandono escolar del plantel:');
  });

  it('3. Plantel con métricas completas: Inyecta cifras textuales de 911/F11 y promedios de zona', () => {
    const fullBaseline: PaecAcademicBaseline = {
      abandono: 4.8,
      eficienciaTerminal: 89.2,
      aprobacion: 91.5,
      reprobacion: 8.5,
      rezago: 3.2,
      promAbandonoZona: 6.1,
      promEficienciaZona: 82.0,
      problematicasComunesZona: ['Deserción temprana'],
    };

    const prompt = buildPrompt1Diagnostico(commMock, schoolMock, problemMock, fullBaseline);

    expect(prompt).toContain('- Tasa de abandono escolar del plantel: 4.8%');
    expect(prompt).toContain('- Eficiencia terminal del plantel: 89.2%');
    expect(prompt).toContain('- Tasa de aprobación del plantel: 91.5%');
    expect(prompt).toContain('- Tasa de reprobación del plantel: 8.5%');
    expect(prompt).toContain('- Índice de rezago escolar del plantel: 3.2%');
    expect(prompt).toContain('- Promedio de abandono escolar de la zona: 6.1%');
    expect(prompt).toContain('- Promedio de eficiencia terminal de la zona: 82%');
  });

  it('4. Cero normativa en PAEC: El prompt no debe inyectar artículos legales ni catálogo PMC', () => {
    const fullBaseline: PaecAcademicBaseline = {
      abandono: 5.0,
    };

    const prompt = buildPrompt1Diagnostico(commMock, schoolMock, problemMock, fullBaseline);

    expect(prompt).not.toContain('Artículo 3');
    expect(prompt).not.toContain('LGSCMM');
    expect(prompt).not.toContain('pmc_catalogo_metas');
  });
});
