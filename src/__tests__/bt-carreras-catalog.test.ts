import { describe, it, expect } from 'vitest';
import {
  CARRERAS_TECNICAS_BT,
  CARRERAS_TECNOLOGICAS,
  loadCarrerasTecnicas,
  getCarreraPorId,
  getModulosPorSemestreBT,
  getModulosPorSemestre,
  getCarrerasNuevas,
  getCarrerasAnteriores,
  CATALOGO_PROPEDUTICAS_5TO,
} from '@/lib/bt-carreras-catalog';

describe('bt-carreras-catalog (Catálogo Oficial BT)', () => {
  it('contiene las 66 carreras oficiales COSFAC / DGETI', () => {
    expect(CARRERAS_TECNICAS_BT).toBeDefined();
    expect(CARRERAS_TECNICAS_BT.length).toBe(66);
    expect(CARRERAS_TECNOLOGICAS).toBe(CARRERAS_TECNICAS_BT);
  });

  it('loadCarrerasTecnicas carga asíncronamente el catálogo idéntico', async () => {
    const data = await loadCarrerasTecnicas();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(66);
    expect(data[0].id).toBe(CARRERAS_TECNICAS_BT[0].id);
    expect(data[data.length - 1].id).toBe(CARRERAS_TECNICAS_BT[CARRERAS_TECNICAS_BT.length - 1].id);
  });

  it('getCarreraPorId busca de forma exacta e insensible a mayúsculas', () => {
    const acuacultura = getCarreraPorId('acuacultura');
    expect(acuacultura).toBeDefined();
    expect(acuacultura?.nombre).toBe('Acuacultura');

    const byName = getCarreraPorId('Acuacultura');
    expect(byName?.id).toBe('acuacultura');

    const byUpper = getCarreraPorId('ACUACULTURA');
    expect(byUpper?.id).toBe('acuacultura');

    const nonExistent = getCarreraPorId('inexistente_123');
    expect(nonExistent).toBeUndefined();
  });

  it('getModulosPorSemestreBT y getModulosPorSemestre devuelven el módulo correspondiente', () => {
    const modSem2 = getModulosPorSemestreBT('acuacultura', 2);
    expect(modSem2).toBeDefined();
    expect(modSem2?.semestre).toBe(2);
    expect(modSem2?.horasSemanales).toBe(17);
    expect(modSem2?.submodulos.length).toBeGreaterThan(0);

    const modAlias = getModulosPorSemestre('acuacultura', 2);
    expect(modAlias).toEqual(modSem2);

    const modInvalido = getModulosPorSemestreBT('acuacultura', 1);
    expect(modInvalido).toBeUndefined();
  });

  it('separa adecuadamente carreras nuevas y anteriores', () => {
    const nuevas = getCarrerasNuevas();
    const anteriores = getCarrerasAnteriores();

    expect(nuevas.length + anteriores.length).toBe(66);
    expect(nuevas.every(c => c.tipoPrograma === 'nuevo')).toBe(true);
    expect(anteriores.every(c => c.tipoPrograma === 'anterior')).toBe(true);
  });

  it('CATALOGO_PROPEDUTICAS_5TO contiene 12 materias en 4 áreas', () => {
    expect(CATALOGO_PROPEDUTICAS_5TO.length).toBe(12);
    const areas = new Set(CATALOGO_PROPEDUTICAS_5TO.map(m => m.area));
    expect(areas.has('Económico-Administrativa')).toBe(true);
    expect(areas.has('Físico-Matemática')).toBe(true);
    expect(areas.has('Químico-Biológica')).toBe(true);
    expect(areas.has('Humanidades y Ciencias Sociales')).toBe(true);
  });
});
