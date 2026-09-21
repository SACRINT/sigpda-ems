/**
 * imc-percentiles.ts
 * Módulo de Dominio Clínico-Pedagógico para Adolescentes de Educación Media Superior (15 a 19 años).
 * 
 * Basado estrictamente en las Tablas y Referencias Oficiales:
 * WHO Child Growth Standards / Growth reference data for 5-19 years (Organización Mundial de la Salud, 2007)
 * URL Oficial: https://www.who.int/tools/growth-reference-data-for-5to19-years
 * Adoptado por la Secretaría de Salud (SSA México) y el Programa Vida Saludable de la NEM.
 */

export type CategoriaImcAdolescente = 'bajo_peso' | 'peso_saludable' | 'sobrepeso' | 'obesidad';

export interface PercentileValues {
  p3: number;
  p5: number;
  p15: number;
  p50: number;
  p85: number;
  p90: number;
  p95: number;
  p97: number;
}

export interface ImcClassificationResult {
  category: CategoriaImcAdolescente;
  categoryLabel: string;
  percentileRange: string;
  p85Cutoff: number;
  p95Cutoff: number;
  exactPercentiles: PercentileValues;
  criterioNormativo: string;
  protocoloBioetico: string;
}

export const WHO_2007_PERCENTILES: Record<'M' | 'F', Record<number, PercentileValues>> = {
  M: {
    15: { p3: 15.6, p5: 16.0, p15: 17.1, p50: 20.2, p85: 24.2, p90: 25.4, p95: 27.0, p97: 28.0 },
    16: { p3: 16.2, p5: 16.7, p15: 17.8, p50: 21.0, p85: 25.0, p90: 26.2, p95: 27.9, p97: 28.9 },
    17: { p3: 16.8, p5: 17.3, p15: 18.4, p50: 21.7, p85: 25.8, p90: 27.0, p95: 28.6, p97: 29.6 },
    18: { p3: 17.3, p5: 17.8, p15: 19.0, p50: 22.2, p85: 26.3, p90: 27.6, p95: 29.2, p97: 30.2 },
  },
  F: {
    15: { p3: 15.4, p5: 15.9, p15: 17.2, p50: 20.6, p85: 24.9, p90: 26.1, p95: 27.8, p97: 28.8 },
    16: { p3: 15.9, p5: 16.4, p15: 17.7, p50: 21.2, p85: 25.5, p90: 26.8, p95: 28.5, p97: 29.5 },
    17: { p3: 16.4, p5: 16.9, p15: 18.2, p50: 21.7, p85: 26.0, p90: 27.3, p95: 29.0, p97: 30.0 },
    18: { p3: 16.7, p5: 17.2, p15: 18.5, p50: 22.0, p85: 26.3, p90: 27.7, p95: 29.3, p97: 30.3 },
  },
};

export const PROTOCOLO_BIOETICO_AULA = `PROTOCOLO BIOÉTICO DE AULA PARA LA SALUD Y SENSIBILIDAD CORPORAL (NEM / OMS):
1. Todo tratamiento de datos antropométricos (peso, estatura, IMC) debe realizarse bajo estricto anonimato (mediante datos muestrales prefabricados o registros personales cerrados en bitácora individual).
2. Queda ESTRICTAMENTE PROHIBIDO el pesaje público frente a los compañeros o la exposición/comparación corporal en plenaria, salvaguardando la salud mental y previniendo el acoso escolar.
3. Para adolescentes (15-18 años), NUNCA deben aplicarse los puntos de corte fijos de adultos (25.0 y 30.0); se deben emplear los percentiles P85 y P95 según edad y sexo de las Tablas OMS 2007.`;

/**
 * Determina la categoría de IMC para adolescentes según edad (15-18 años) y sexo.
 */
export function getImcPercentileCategory(
  ageYears: number,
  sexInput: string,
  imc: number
): ImcClassificationResult {
  // Normalizar sexo
  const normalizedSex: 'M' | 'F' = (sexInput && (sexInput.toUpperCase().startsWith('F') || sexInput.toLowerCase().includes('muj'))) ? 'F' : 'M';

  // Clampear edad al rango de bachillerato (15 a 18 años)
  const clampedAge = Math.min(18, Math.max(15, Math.floor(ageYears)));

  const percentiles = WHO_2007_PERCENTILES[normalizedSex][clampedAge];

  let category: CategoriaImcAdolescente;
  let categoryLabel: string;
  let percentileRange: string;

  if (imc < percentiles.p5) {
    category = 'bajo_peso';
    categoryLabel = 'Bajo Peso (< P5)';
    percentileRange = `< P5 (< ${percentiles.p5})`;
  } else if (imc < percentiles.p85) {
    category = 'peso_saludable';
    categoryLabel = 'Peso Saludable (P5 a < P85)';
    percentileRange = `P5 a < P85 (${percentiles.p5} - ${percentiles.p85})`;
  } else if (imc < percentiles.p95) {
    category = 'sobrepeso';
    categoryLabel = 'Sobrepeso (P85 a < P95)';
    percentileRange = `P85 a < P95 (${percentiles.p85} - ${percentiles.p95})`;
  } else {
    category = 'obesidad';
    categoryLabel = 'Obesidad (≥ P95)';
    percentileRange = `≥ P95 (≥ ${percentiles.p95})`;
  }

  return {
    category,
    categoryLabel,
    percentileRange,
    p85Cutoff: percentiles.p85,
    p95Cutoff: percentiles.p95,
    exactPercentiles: percentiles,
    criterioNormativo: `OMS 2007 Growth Reference (5-19 años) — Edad: ${clampedAge} años, Sexo: ${normalizedSex === 'M' ? 'Masculino' : 'Femenino'}`,
    protocoloBioetico: PROTOCOLO_BIOETICO_AULA,
  };
}
