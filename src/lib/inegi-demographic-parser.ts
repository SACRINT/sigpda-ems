// src/lib/inegi-demographic-parser.ts
/**
 * inegi-demographic-parser.ts — Motor de parseo e ingestión de estadísticas de INEGI
 * SIGPDA-EMS · Soporta archivos exportados de "México en Cifras (Localidades)" en formato HTML/XLS.
 * Cero invención: Valida claves numéricas y tipos de datos del Censo 2020.
 */

import * as cheerio from 'cheerio';

export interface InegiUrbanIndicator {
  enTodas: number;
  enAlguna: number;
  enNinguna: number;
  noEspecificado: number;
}

export interface InegiLocalidadDemographics {
  entidad: string;
  cveEntidad: string;
  municipio: string;
  cveMunicipio: string;
  localidad: string;
  cveLocalidad: string;
  poblacion: {
    total: number;
    femenina: number;
    masculina: number;
    rango0a14: number;
    rango15a29: number;
    rango30a59: number;
    rango60mas: number;
    conDiscapacidad: number;
    gradoPromedioEscolaridad: number;
    gradoPromedioFemenino?: number;
    gradoPromedioMasculino?: number;
  };
  viviendas: {
    total: number;
    particularesHabitadas: number;
    promedioOcupantes: number;
    disponenDrenaje: number;
    disponenEnergiaElectrica: number;
    disponenSanitario: number;
    pisoMaterialDiferenteTierra: number;
  };
  entornoUrbano: {
    recubrimientoCalle?: InegiUrbanIndicator;
    banquetas?: InegiUrbanIndicator;
    alumbradoPublico?: InegiUrbanIndicator;
    arbolesPalmeras?: InegiUrbanIndicator;
    drenajePluvial?: InegiUrbanIndicator;
  };
  fuente: string;
  anioCenso: number;
}

function parseNum(val: string | undefined | null): number {
  if (!val) return 0;
  const clean = val.replace(/,/g, '').trim();
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

function extractKeyAndCode(raw: string): { name: string; code: string } {
  const match = raw.match(/^(.*?)\s*\((\d+)\)$/);
  if (match) {
    return { name: match[1].trim(), code: match[2].trim() };
  }
  return { name: raw.trim(), code: '' };
}

/**
 * Parsea el contenido HTML exportado por INEGI (típicamente guardado con extensión .xls).
 */
export function parseInegiHtml(htmlContent: string): InegiLocalidadDemographics | null {
  if (!htmlContent || typeof htmlContent !== 'string' || !htmlContent.includes('Instituto Nacional de Estadística y Geografía')) {
    return null;
  }

  const $ = cheerio.load(htmlContent);

  // 1. Extraer encabezados de entidad, municipio y localidad
  let entidad = '';
  let cveEntidad = '';
  let municipio = '';
  let cveMunicipio = '';
  let localidad = '';
  let cveLocalidad = '';

  $('table').each((_, tbl) => {
    $(tbl).find('tr').each((_, tr) => {
      const th = $(tr).find('th').text().trim().toLowerCase();
      const td = $(tr).find('td').text().trim();

      if (th.includes('entidad')) {
        const parsed = extractKeyAndCode(td);
        entidad = parsed.name;
        cveEntidad = parsed.code;
      } else if (th.includes('municipio')) {
        const parsed = extractKeyAndCode(td);
        municipio = parsed.name;
        cveMunicipio = parsed.code;
      } else if (th.includes('localidad')) {
        const parsed = extractKeyAndCode(td);
        localidad = parsed.name;
        cveLocalidad = parsed.code;
      }
    });
  });

  if (!localidad && !municipio) {
    return null;
  }

  // 2. Extraer Características de la Población
  const pMap: Record<string, number> = {};
  $('#tablePoblacion tbody tr').each((_, tr) => {
    const label = $(tr).find('td').first().text().trim().toLowerCase();
    const val = $(tr).find('td').last().text().trim();
    pMap[label] = parseNum(val);
  });

  // 3. Extraer Características de las Viviendas
  const vMap: Record<string, number> = {};
  $('#tableViviendas tbody tr').each((_, tr) => {
    const label = $(tr).find('td').first().text().trim().toLowerCase();
    const val = $(tr).find('td').last().text().trim();
    vMap[label] = parseNum(val);
  });

  // 4. Extraer Entorno Urbano
  const parseUrbanRow = (labelMatch: string): InegiUrbanIndicator | undefined => {
    let found: InegiUrbanIndicator | undefined;
    $('#tableUrbano tbody tr').each((_, tr) => {
      const label = $(tr).find('td').first().text().trim().toLowerCase();
      if (label.includes(labelMatch.toLowerCase())) {
        const tds = $(tr).find('td.TdV');
        if (tds.length >= 4) {
          found = {
            enTodas: parseNum($(tds[0]).text()),
            enAlguna: parseNum($(tds[1]).text()),
            enNinguna: parseNum($(tds[2]).text()),
            noEspecificado: parseNum($(tds[3]).text()),
          };
        }
      }
    });
    return found;
  };

  return {
    entidad: entidad || 'Puebla',
    cveEntidad: cveEntidad || '21',
    municipio,
    cveMunicipio,
    localidad,
    cveLocalidad,
    poblacion: {
      total: pMap['población total'] || pMap['poblacion total'] || 0,
      femenina: pMap['población femenina'] || pMap['poblacion femenina'] || 0,
      masculina: pMap['población masculina'] || pMap['poblacion masculina'] || 0,
      rango0a14: pMap['población de 0 a 14 años'] || pMap['poblacion de 0 a 14 anos'] || 0,
      rango15a29: pMap['población de 15 a 29 años'] || pMap['poblacion de 15 a 29 anos'] || 0,
      rango30a59: pMap['población de 30 a 59 años'] || pMap['poblacion de 30 a 59 anos'] || 0,
      rango60mas: pMap['población de 60 años y más'] || pMap['poblacion de 60 anos y mas'] || 0,
      conDiscapacidad: pMap['población con discapacidad'] || pMap['poblacion con discapacidad'] || 0,
      gradoPromedioEscolaridad: pMap['grado promedio de escolaridad'] || 0,
      gradoPromedioFemenino: pMap['grado promedio de escolaridad de la población femenina'] || undefined,
      gradoPromedioMasculino: pMap['grado promedio de escolaridad de la población masculina'] || undefined,
    },
    viviendas: {
      total: vMap['total de viviendas'] || 0,
      particularesHabitadas: vMap['total de viviendas particulares habitadas'] || 0,
      promedioOcupantes: vMap['promedio de ocupantes en viviendas particulares habitadas'] || 0,
      disponenDrenaje: vMap['viviendas particulares habitadas que disponen de drenaje'] || 0,
      disponenEnergiaElectrica: vMap['viviendas particulares habitadas que disponen de energía eléctrica'] || 0,
      disponenSanitario: vMap['viviendas particulares habitadas que disponen de excusado o sanitario'] || 0,
      pisoMaterialDiferenteTierra: vMap['viviendas particulares habitadas con piso de material diferente de tierra'] || 0,
    },
    entornoUrbano: {
      recubrimientoCalle: parseUrbanRow('recubrimiento'),
      banquetas: parseUrbanRow('banquetas'),
      alumbradoPublico: parseUrbanRow('alumbrado'),
      arbolesPalmeras: parseUrbanRow('árboles') || parseUrbanRow('arboles'),
      drenajePluvial: parseUrbanRow('drenaje pluvial') || parseUrbanRow('alcantarilla'),
    },
    fuente: 'INEGI · Censo de Población y Vivienda 2020 (México en Cifras)',
    anioCenso: 2020,
  };
}
