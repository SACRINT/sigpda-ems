import { describe, it, expect } from 'vitest';
import type { PaecOperationalActivity } from '@/types/planning';
import {
  matchPaecSubject,
  normalizePaecSubjectKey,
  isActivityAnotherSubjectName,
  selectPaecOperationalActivity,
} from '@/lib/paec-subject-matching';

const row = (
  asignatura: string,
  actividad: string,
  extra: Partial<PaecOperationalActivity> = {}
): PaecOperationalActivity => ({
  asignatura,
  actividad,
  isPrescheduled: true,
  ...extra,
});

const UAC_LABORAL =
  'Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto';

describe('paec-subject-matching', () => {
  it('normaliza acentos, stopwords y numeración romana', () => {
    expect(normalizePaecSubjectKey('Ciencias Naturales, Experimentales y Tecnología I')).toBe(
      normalizePaecSubjectKey('ciencias naturales experimentales tecnologia 1')
    );
    expect(normalizePaecSubjectKey('Dibujo Técnico II')).toBe('dibujo tecnico 2');
  });

  it('empareja la UAC laboral con su asignatura del PAEC', () => {
    expect(matchPaecSubject(UAC_LABORAL, UAC_LABORAL)).toBe(true);
    expect(
      matchPaecSubject(UAC_LABORAL, 'Prepara materiales en cantidad y calidad especificada')
    ).toBe(true);
  });

  it('detecta cuando la actividad es el nombre de otra asignatura', () => {
    const subjects = [
      UAC_LABORAL,
      'Ciencias Naturales, Experimentales y Tecnología I',
    ];
    expect(
      isActivityAnotherSubjectName(
        'Ciencias Naturales, Experimentales y Tecnología I',
        subjects
      )
    ).toBe(true);
    expect(
      isActivityAnotherSubjectName(
        'Dosificación y preparación de mezclas y materiales pétreos para la cimentación del circuito',
        subjects
      )
    ).toBe(false);
  });

  it('selecciona la actividad correcta de la UAC laboral', () => {
    const plan = [
      row(
        'Ciencias Naturales, Experimentales y Tecnología I',
        'Indagación sobre mezclas y cambios de la materia'
      ),
      row(UAC_LABORAL, 'Dosificación y preparación de mezclas y materiales pétreos'),
    ];

    expect(selectPaecOperationalActivity(UAC_LABORAL, plan)?.actividad).toBe(
      'Dosificación y preparación de mezclas y materiales pétreos'
    );
  });

  it('rechaza una fila laboral cuya actividad es en realidad otra asignatura', () => {
    const plan = [
      row(
        'Ciencias Naturales, Experimentales y Tecnología I',
        'Indagación sobre mezclas y cambios de la materia'
      ),
      row(UAC_LABORAL, 'Ciencias Naturales, Experimentales y Tecnología I'),
    ];

    expect(selectPaecOperationalActivity(UAC_LABORAL, plan)).toBeNull();
  });

  it('rechaza actividad vacía o idéntica a su propia asignatura', () => {
    const plan = [
      row(UAC_LABORAL, ''),
      row(UAC_LABORAL, UAC_LABORAL),
    ];

    expect(selectPaecOperationalActivity(UAC_LABORAL, plan)).toBeNull();
  });

  it('no selecciona filas de otra UAC', () => {
    const plan = [
      row('Historia de México', 'Línea del tiempo comunitaria'),
      row('Física I', 'Medición de caudal del río'),
    ];

    expect(selectPaecOperationalActivity(UAC_LABORAL, plan)).toBeNull();
  });
});
