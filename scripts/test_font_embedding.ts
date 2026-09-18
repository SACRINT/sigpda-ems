import { jsPDF } from 'jspdf';
import {
  loadEditorialFonts,
  setFontHeading,
  setFontBody,
  areEditorialFontsLoaded,
} from '../src/lib/visual-engine/font-loader';

console.log('Testing font-loader with smart wrapping...');

const doc = new jsPDF();
loadEditorialFonts(doc);

// Test 1: explicit font calls
setFontHeading(doc);
doc.setFontSize(14);
console.log('Explicit heading font:', doc.getFont().fontName, doc.getFont().fontStyle);
doc.text('TÍTULO DE MISIÓN CON MONTSERRAT BOLD', 20, 20);

// Test 2: legacy helvetica call with normal style
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
console.log('Legacy normal font mapped to:', doc.getFont().fontName, doc.getFont().fontStyle);
doc.text('Párrafo de texto regular que debería ser Lato Regular', 20, 30);

// Test 3: legacy helvetica call with bold and size >= 10.5
doc.setFontSize(12);
doc.setFont('helvetica', 'bold');
console.log('Legacy bold (size 12) font mapped to:', doc.getFont().fontName, doc.getFont().fontStyle);
doc.text('Subtítulo grande que debería ser Montserrat Bold', 20, 40);

// Test 4: legacy helvetica call with bold and size < 10.5
doc.setFontSize(8);
doc.setFont('helvetica', 'bold');
console.log('Legacy bold (size 8) font mapped to:', doc.getFont().fontName, doc.getFont().fontStyle);
doc.text('Etiqueta o término que debería ser Lato Bold', 20, 50);

// Test 5: splitTextToSize
const longText = 'La electricidad y el magnetismo son dos aspectos fundamentales del electromagnetismo, una de las cuatro fuerzas fundamentales del universo. En esta misión exploraremos los circuitos.';
const lines = doc.splitTextToSize(longText, 100);
console.log('Lines split with active font:', lines.length);

const buf = Buffer.from(doc.output('arraybuffer'));
console.log('PDF total size:', Math.round(buf.length / 1024), 'KB');
