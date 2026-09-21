# Bitácora: Sistema de Imágenes Contextuales V7 — Chat 2026-09-17

## Resumen Ejecutivo

Se construyó desde cero un sistema de inserción inteligente de imágenes en libros educativos SIGPDA-EMS V7. El sistema detecta instrumentos/herramientas técnicas en el texto de las misiones pedagógicas, busca fotos reales en Openverse con validación bilingüe, genera SVGs blueprint como fallback, y los integra en sidebar o hero sin sacrificar espacio de trabajo del alumno.

## Estado Final del Sistema

| Componente | Archivo | Líneas | Estado |
|---|---|---|---|
| Design Tokens | `design-tokens.ts` | 184 | ✅ Single source of truth |
| Tipografía | `font-loader.ts` | 116 | ✅ Lato + Montserrat embebidas |
| Componentes | `pdf-components-core.ts` | 421 | ✅ Core estructural |
| Widgets | `pdf-components-widgets.ts` | 674 | ✅ +drawEquipmentCardWidget |
| Layout Engine | `column-flow-manager.ts` | 468 | ✅ Sidebar rotativo + equipment |
| Cover Pipeline | `cover-generator.ts` + `thematic-backgrounds.ts` | 754 + 433 | ✅ 3-tier pipeline |
| Extractor de Instrumentos | `object-extractor.ts` | 272 | ✅ Guardián Anti-Relleno |
| SVGs Blueprint | `object-svg-generator.ts` | 430 | ✅ 25+ esquemas |
| Gestor de Assets | `visual-asset-manager.ts` | 344 | ✅ Cache + validación bilingüe |
| Catálogos (10 familias) | `catalogs/` | 12 archivos | ✅ 85 instrumentos únicos |
| Rúbricas por Misión | `mission-rubric-generator.ts` | 233 | ✅ 4 criterios MCCEMS |
| Renderer PDF | `pdf-workbook-renderer.ts` | 2,528 | ✅ Migrado a tokens V7 |
| Renderer DOCX | `docx-workbook-renderer.ts` | 3,119 | ✅ Paridad total |

## Arquitectura del Sistema de Imágenes

### Pipeline de Detección
```
Texto de la misión (Yo Hago / Nosotros Hacemos / Tú Haces)
       ↓
extractToolsAndEquipment(text)
  → Paso 1: Búsqueda en catálogo maestro (85 instrumentos, aliases, keyword matching)
  → Paso 2: Regex morfosintáctica (29 verbos × 3 flexiones = 87 patrones)
       ↓
evaluatePedagogicalRelevance()
  → Guardián Anti-Relleno (3 condiciones):
    1. Presencia Operativa (iDo > weDo > youDo > concept > hook)
    2. Utilidad Formativa (safetyRule/NOM/technicalRole ≥15 chars)
    3. Confianza Mínima (≥0.8 para regex)
  → Si no cumple: RETORNA NULL = Cero Relleno Visual
       ↓
resolveEquipmentVisualForMission()
  → Cache en memoria por instrumento
  → Intento 1: Openverse CC (validación bilingüe título/tags)
  → Intento 2: SVG Blueprint (tokens V7, 100% offline)
       ↓
Integración
  → 70% Ficha Técnica en Sidebar (drawEquipmentCardWidget)
  → 30% Hero en "Yo Hago" (imagen centrada con caption)
```

### Catálogo por Familias Tecnológicas (10 familias, 85 instrumentos)

| Familia | Archivo | Instrumentos |
|---|---|---|
| Electrónica/Mecatrónica | `electronica-mecatronica.ts` | 11 |
| Eléctrico/Industrial | `electricidad-energia.ts` | 10 |
| Agropecuaria | `agropecuaria.ts` | 8 |
| Biotecnología | `biotecnologia.ts` | 7 |
| Salud | `salud.ts` | 7 |
| Gastronomía/Turismo | `gastronomia.ts` | 11 |
| TICs/Ciberseguridad | `tics-ciberseguridad.ts` | 8 |
| Diseño Gráfico | `diseno-grafico.ts` | 6 |
| Ciencias Experimentales | `ciencias-experimentales.ts` | 11 |
| Mecánica/Soldadura | `mecanica-soldadura.ts` | 6 |

### Regex Morfosintáctica (29 verbos)

**Medición (10):** medir, calibrar, verificar, comprobar, diagnosticar, monitorear, inspeccionar, registrar, contrastar, examinar

**Manipulación (12):** emplear, utilizar, usar, operar, maniobrar, accionar, ajustar, apretar, aflojar, fijar, ensamblar, montar

**Conexión (7):** conectar, desconectar, cablear, enchufar, energizar, alimentar, vincular

Cada verbo tiene 4 flexiones: infinitivo, imperativo tú, imperativo ustedes, gerundio.

### Guardián Anti-Relleno (Relevance Gatekeeper)

Una imagen SOLO se renderiza si cumple 3 condiciones simultáneas:
1. **Presencia Operativa:** El instrumento está en el protocolo de la misión (iDo/weDo/youDo), no solo en el título o concepto teórico
2. **Utilidad Formativa:** Cuenta con norma NOM, regla de seguridad o rol técnico descriptivo (≥15 chars)
3. **Confianza Mínima:** Detecciones por regex requieren confianza ≥0.8

Si no hay herramienta que cumpla → `null` → 0 imágenes decorativas.

### Detección Desacoplada del Nombre de Asignatura

El parámetro `subjectName` se recibe pero NUNCA se usa en la detección. El sistema lee exclusivamente el texto de la misión. Si una materia cambia de nombre, mientras el texto mencione "multímetro", el sistema detecta el multímetro.

## Bugs Corregidos Durante el Chat

### V4 (anteriores)
- Emoji→text mapping (EMOJI_TO_TEXT)
- sanitizePdfText para WinAnsi safety
- Title overflow fix (layoutTitleForSvg)
- Semestre normalization (cleanSemesterString)
- stripMarkdown para ** literal removal

### V5-V7 (este chat)
- Headers/Footers con color por misión
- Credits page con CC attributions y SHA-256
- DOCX cover fit-inside 792×1056 px
- 2-column grid (68%/28%) con sidebar rotativo
- Diagnostic evaluation + metacognitive traffic light
- FLUX prompt revisado para covers documentales
- Design tokens como single source of truth
- Font embedding (Lato + Montserrat) con monkey-patch
- Color migration a COLOR.* tokens
- Font helpers semánticos (setFontHeading, setFontBody, setFontCaption)
- Split pdf-components.ts en core + widgets + barrel
- mission-rubric-generator.ts (4 criterios MCCEMS)
- Object extractor con catálogo de85 instrumentos
- Object SVG generator con 25+ blueprint templates
- Validación bilingüe Openverse
- Cache en memoria por instrumento
- Guardián Anti-Relleno (3 condiciones)
- Regex de 29 verbos con flexiones morfológicas
- 10 familias tecnológicas tipadas

## Métricas Finales

- `npx tsc --noEmit`: 0 errores
- `npm run build`: 0 errores (103 rutas)
- PDF piloto: 1,559 KB (1.52 MB) — dentro de presupuesto <2.5 MB
- DOCX piloto: 627 KB
- console.* en visual-engine: 0
- doc.setFont('helvetica') en renderer: 0
- Total visual-engine: ~5,500 líneas en 18 archivos
- Total instrumentos catálogo: 85 únicos
- Total verbos regex: 29 (87 flexiones)

## Próximo Paso: SISAT-ATP

El equipo de arquitectura SACRINT propone homologar el motor de evaluación entre SIGPDA-EMS y SISAT-ATP:
- Planeaciones: llevar lógica determinista de puntajes a SISAT
- PAEC-PEC: homologar matriz 8 dimensiones /23 criterios
- PMC: sincronizar 5 dimensiones y metas SMART
- Cartografía: alinear nomenclatura y 6 dimensiones normativas

Verificar antes de empezar:
1. La evaluación en SISAT (`pre-revision.ts`) es realmente por LLM o determinista
2. Si hay copias de los quality gates en SISAT o hay que crearlas
3. La BD de SISAT tiene las mismas tablas de evaluación
