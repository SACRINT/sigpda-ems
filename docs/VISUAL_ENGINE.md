# Motor de Gráficos Vectoriales Determinísticos (Visual Engine)
**SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027**

El **Visual Engine** es el subsistema de renderizado gráfico de la plataforma SIGPDA-EMS. Genera representaciones visuales de alta calidad pedagógica de forma determinística ($0.00 USD, 0 tokens consumidos), integradas nativamente en los Libros-Cuadernos de Aprendizaje Activo en formato PDF.

---

## 1. Diagrama de Arquitectura

```mermaid
flowchart TD
    A[Misión Didáctica\nConcepto Cero] --> B[visual-dispatcher.ts\nEnrutador Semántico]
    
    subgraph Generadores Vectoriales [Capa 0: Generación Determinística]
        C1[stem-generator.ts\n6 Generadores STEM]
        C2[humanities-generator.ts\n4 Generadores Humanidades]
        C3[laboral-generator.ts\nFuturo: Laboral / Técnico]
    end
    
    B -->|UAC STEM + Keywords| C1
    B -->|UAC Humanidades + Keywords| C2
    B -->|Sin coincidencia / Laboral| NULL[null / Sin Gráfico Seguro]
    
    C1 --> D[VisualResult]
    C2 --> D
    
    subgraph Contrato VisualResult [Regla de Oro: Cero Etiquetas text]
        D -->|svg: string\nSolo geometrías puras| E[svg-to-png.ts\nSharp / librsvg\n180 DPI / JPEG 85]
        D -->|annotations: VisualAnnotation[]\nCoordenadas + Estilos| F[pdf-workbook-renderer.ts\njsPDF: drawVisualAnnotations]
    end
    
    E -->|Buffer Imagen Optimizada\n25-35 KB| F
    F --> G[Libro-Cuaderno PDF\nFigura Misión Integrada\nTexto Nítido y Paginado]
```

---

## 2. Principio Clave de Arquitectura: Cero Etiquetas `<text>` en SVG

### El Problema
Los motores de rasterización basados en librsvg/sharp en entornos Linux y contenedores carecen de fuentes TrueType/OpenType del sistema operativo (Arial, Helvetica, Inter). Si un SVG incluye elementos `<text>`, el motor renderiza glifos ausentes como cajas vacías (`□□□□`) o corrompe las proporciones del texto.

### La Solución SIGPDA
1. **El SVG solo contiene formas y primitivas vectoriales**: `<rect>`, `<circle>`, `<line>`, `<path>`, `<polygon>`, `<g>`, `<defs>`.
2. **El texto se abstrae como metadatos**: Cada texto se define como una anotación con coordenadas relativas al viewBox (`500x350`):
   ```typescript
   export interface VisualAnnotation {
     text: string;
     svgX: number;
     svgY: number;
     fontSize: number;
     bold?: boolean;
     color?: string;
     align?: 'left' | 'center' | 'end';
   }
   ```
3. **jsPDF dibuja el texto sobre la imagen**: La función `drawVisualAnnotations` en `pdf-workbook-renderer.ts` mapea `(svgX, svgY)` a coordenadas milimétricas de la página del PDF usando fuentes vectoriales estándar de Adobe, garantizando nitidez perfecta, cero consumo de memoria adicional y compatibilidad 100% multiplataforma.

---

## 3. Catálogo de Generadores Disponibles (10 Generadores)

### A. Área STEM / Ciencias Exactas (`stem-generator.ts` — 6 Generadores)
| # | Generador | Descripción | Asignaturas Típicas |
|---|---|---|---|
| 1 | `generateCartesianPlane` | Plano cartesiano graduado con cuadrícula milimétrica para tabulación libre | Matemáticas, Física, Química |
| 2 | `generateLinearGraph` | Gráfica de función lineal $f(x) = mx + b$ con corte al eje Y y caja de pendiente | Pensamiento Matemático I/II, Física I |
| 3 | `generateQuadraticGraph` | Gráfica de función cuadrática $f(x) = ax^2 + bx + c$ (parábola) con vértice | Pensamiento Matemático III, Cálculo |
| 4 | `generateLinearSystemGraph` | Sistema de ecuaciones lineales $2 \times 2$ con rectas secantes y punto de intersección | Álgebra, Pensamiento Matemático |
| 5 | `generateTriangle` | Triángulo rectángulo con cotas de catetos, hipotenusa y recuadro de Teorema de Pitágoras | Geometría y Trigonometría |
| 6 | `generateRectangle` | Cuadrilátero con cotas de base, altura y fórmulas de perímetro y área | Geometría Aplicada, Dibujo Técnico |

### B. Área Humanidades y Ciencias Sociales (`humanities-generator.ts` — 4 Generadores)
| # | Generador | Descripción | Asignaturas Típicas |
|---|---|---|---|
| 7 | `generateTimeline` | Línea de tiempo horizontal con hitos circulares que alternan arriba y abajo para evitar solapamiento | Historia de México, Conciencia Histórica |
| 8 | `generateConceptMap` | Mapa conceptual jerárquico por niveles con píldoras semánticas intermedias (*"regula"*, *"integra"*) | Filosofía, Ética, Literatura, Sociología |
| 9 | `generateHistoricalFlow` | Diagrama de flujo horizontal causal de 4 fases: Antecedentes ➔ Detonante ➔ Consecuencias ➔ Conclusión | Historia, Estructura Socioeconómica |
| 10 | `generateSocialStatsChart` | Gráfica de barras horizontales con ejes graduados y etiquetas largas para indicadores sociodemográficos | Ciencias Sociales, Geografía, Demografía |

---

## 4. Guía Paso a Paso: Cómo Agregar un Nuevo Generador (ej. Laboral / Técnico)

Para crear un nuevo generador determinístico (por ejemplo, para Formación para el Trabajo: diagramas de bloques técnicos o protocolos de seguridad):

### Paso 1: Definir los tipos y el generador
Crear el generador en `src/lib/visual-engine/generators/laboral-generator.ts` importando `VisualAnnotation` y `VisualResult`:

```typescript
import type { VisualAnnotation, VisualResult } from './stem-generator';

export function generateTechnicalFlow(steps: string[], options = {}): VisualResult {
  const w = 500;
  const h = 350;
  const annotations: VisualAnnotation[] = [];

  // 1. Crear SVG sin ninguna etiqueta <text>
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#ffffff" rx="6" stroke="#cbd5e1"/>
    <!-- Formas vectoriales aquí -->
  </svg>`;

  // 2. Registrar textos como anotaciones jsPDF
  annotations.push({
    text: 'Diagrama de Proceso Técnico',
    svgX: w / 2,
    svgY: 20,
    fontSize: 11,
    bold: true,
    color: '#1f3864',
    align: 'center',
  });

  return { svg, annotations };
}
```

### Paso 2: Registrar en el Despachador (`visual-dispatcher.ts`)
1. Importar la nueva función generadora en `src/lib/visual-engine/visual-dispatcher.ts`.
2. Agregar la detección de la UAC o palabras clave:
   ```typescript
   export function isLaboralSubject(uacName: string): boolean {
     const norm = uacName.toLowerCase();
     return norm.includes('formación para el trabajo') || norm.includes('capacitación');
   }
   ```
3. Agregar la rama en `dispatchVisual(...)` para devolver el nuevo recurso gráfico.

### Paso 3: Verificar que librsvg no falle
Probar la rasterización con sharp ejecutando una prueba unitaria:
```bash
npx tsx -e "
import { generateTechnicalFlow } from './src/lib/visual-engine/generators/laboral-generator';
import { svgToPngBuffer } from './src/lib/visual-engine/svg-to-png';

const res = generateTechnicalFlow(['Paso 1', 'Paso 2']);
console.log('¿Tiene text?:', res.svg.includes('<text'));
svgToPngBuffer(res.svg).then(png => console.log('Buffer bytes:', png?.buffer.length));
"
```

---

## 5. Pruebas Locales y Validación

### Ejecutar pruebas de despacho y renderizado de gráficos
```bash
# Prueba de los generadores de Humanidades y generación de PDF de prueba
npx tsx scratch/test_humanities_visuals.ts

# Prueba End-to-End de las 5 áreas curriculares (STEM, Humanidades, Laboral)
npx tsx scratch/test_all_areas_e2e.ts

# Verificación de tipos TypeScript en todo el proyecto
npx tsc --noEmit
```

### Comprobación de peso de PDFs generados
Los libros de trabajo generados con el Visual Engine tienen un peso promedio de:
* Libro BGE (35-40 páginas completas): **~620 KB**
* Libro Humanidades (9 páginas condensadas): **~200 KB**
* Todos los documentos se mantienen muy por debajo del umbral objetivo de **1.0 MB**, permitiendo descargas instantáneas en conexiones de baja velocidad en planteles comunitarios.
