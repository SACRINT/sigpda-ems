import { describe, it, expect } from 'vitest';
import {
  mapParsedCommunityToState,
  getMissingStep1Fields,
  type MappedCommunityState,
  type PaecPreviousExtractDTO,
} from '@/lib/prompts/paec-extraction';

describe('H-10: Mapeo tipado de comunidad y validación de campos obligatorios en extracción PAEC', () => {
  const initialCommunity: MappedCommunityState = {
    location: '',
    demographics: '',
    economy: '',
    traditions: '',
    security: '',
    environment: '',
  };

  it('mapea correctamente context -> demographics, economicActivities -> economy y culturalAspects -> traditions', () => {
    const extractedCommunity: PaecPreviousExtractDTO['community'] = {
      context: 'Comunidad rural de 300 habitantes de origen totonaco',
      location: 'El Tecomate, Francisco Z. Mena, Puebla',
      economicActivities: 'Agricultura de temporal, siembra de maíz y cítricos',
      culturalAspects: 'Fiestas patronales tradicionales y danzas autóctonas',
    };

    const mapped = mapParsedCommunityToState(extractedCommunity, initialCommunity);

    expect(mapped.location).toBe('El Tecomate, Francisco Z. Mena, Puebla');
    expect(mapped.demographics).toBe('Comunidad rural de 300 habitantes de origen totonaco');
    expect(mapped.economy).toBe('Agricultura de temporal, siembra de maíz y cítricos');
    expect(mapped.traditions).toBe('Fiestas patronales tradicionales y danzas autóctonas');
  });

  it('prioriza demographics y economy directos si vienen en el esquema de extracción', () => {
    const extractedCommunity: PaecPreviousExtractDTO['community'] = {
      location: 'Puebla Centro',
      demographics: 'Población urbana de 10,000 habitantes',
      context: 'Contexto alternativo ignorado si demographics existe',
      economy: 'Comercio y servicios',
      economicActivities: 'Actividades secundarias ignoradas si economy existe',
    };

    const mapped = mapParsedCommunityToState(extractedCommunity, initialCommunity);

    expect(mapped.demographics).toBe('Población urbana de 10,000 habitantes');
    expect(mapped.economy).toBe('Comercio y servicios');
  });

  it('preserva valores previos cuando las claves extraídas vienen vacías o nulas', () => {
    const current: MappedCommunityState = {
      location: 'Ubicación previa',
      demographics: 'Demografía previa',
      economy: 'Economía previa',
      traditions: 'Tradición previa',
      security: 'Segura',
      environment: 'Templado',
    };

    const mapped = mapParsedCommunityToState({}, current);
    expect(mapped).toEqual(current);
  });

  it('getMissingStep1Fields identifica exactamente los campos obligatorios pendientes', () => {
    const incompleteCommunity: MappedCommunityState = {
      location: 'Tecomate',
      demographics: '',
      economy: '',
      traditions: '',
      security: '',
      environment: '',
    };

    const missing = getMissingStep1Fields({
      projectName: 'Viaje de Estudios',
      problemStatement: 'Baja motivación y adicciones',
      community: incompleteCommunity,
      school: { enrollment: '85', teacherCount: '5' },
    });

    expect(missing).toContain('Situación Demográfica');
    expect(missing).toContain('Actividades Socioeconómicas');
    expect(missing).not.toContain('Nombre del Proyecto');
    expect(missing).not.toContain('Matrícula Estudiantil');
  });

  it('valida que la extracción tipo Tecomate con context y economicActivities satisface los requisitos de comunidad', () => {
    const tecomateExtracted: PaecPreviousExtractDTO['community'] = {
      location: 'El Tecomate, Puebla',
      context: '300 habitantes en hogares indígenas',
      economicActivities: 'Ganadería y agricultura',
    };

    const mapped = mapParsedCommunityToState(tecomateExtracted, initialCommunity);

    const missing = getMissingStep1Fields({
      projectName: 'VIAJE DE ESTUDIOS',
      problemStatement: 'Falta de proyecto de vida en 75% de alumnos',
      community: mapped,
      school: { enrollment: '85', teacherCount: '5' },
    });

    expect(missing).toEqual([]);
  });
});
