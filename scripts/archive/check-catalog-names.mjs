import { CARRERAS_TECNICAS_BT } from '../src/lib/bt-carreras-catalog.ts';

console.log('Total Carreras Técnicas BT:', CARRERAS_TECNICAS_BT.length);
CARRERAS_TECNICAS_BT.forEach((c, i) => {
  console.log(`${i + 1}. [${c.id}] ${c.nombre} (${c.tipoPrograma}) - Modulos: ${c.modulos.length}`);
});
