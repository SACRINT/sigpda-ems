# Catálogo de imágenes contextuales 08/09 con Gemini Nano Banana

**Fecha:** 2026-11-23  
**Destino:** presentaciones `08` e infografías `09` de los 12 paquetes piloto.  
**Objetivo:** sustituir imágenes genéricas por escenas contextuales, reutilizables y sin texto incrustado.

## 1. Estado actual del inventario

| Dato | Valor |
|---|---:|
| PNG en `public/images/materiales` | 245 |
| Slugs en `materials-catalog.ts` | 244 |
| Categorías del catálogo | 20 |
| Archivos fuera de catálogo | 1 (`_placeholder.png`) |

Distribución actual por categoría:

| Categoría | Slugs |
|---|---:|
| matemáticas | 30 |
| arte | 28 |
| cómputo | 23 |
| laboratorio química | 23 |
| medición | 20 |
| salud | 15 |
| herramientas | 15 |
| física | 12 |
| agro | 10 |
| laboratorio biología | 9 |
| alimentos | 9 |
| industrial | 8 |
| ofimática | 8 |
| servicios | 7 |
| seguridad EPP | 7 |
| deportivo | 6 |
| construcción | 5 |
| energía | 4 |
| logística | 4 |
| virtual | 1 |

La mayoría son imágenes de instrumentos o materiales. Faltan **escenas de uso pedagógico**: un estudiante midiendo, un equipo de trabajo, un taller en operación, un caso comunitario. Ese es el hueco que cubre este catálogo.

## 2. Reglas de arte y seguridad

- **Modelo:** Gemini 3 Pro Image (Nano Banana) o el modelo de imagen Gemini vigente.
- **Formato `08`:** 16:9, 1600 × 900 px, PNG o WebP.
- **Formato `09`:** 4:5, 1200 × 1500 px, PNG o WebP.
- **Estilo:** ilustración editorial vectorial semi-realista, líneas limpias, sombras suaves, profundidad moderada.
- **Paleta:** azul marino `#123B5D`, verde `#1F7A5A`, naranja `#D9772A`, blanco cálido `#F7F4EE`, gris grafito `#2E3440`.
- **Composición:** sujeto claro, 25–35 % de espacio negativo, iluminación natural lateral.
- **Personas:** estudiantes y docentes genéricos, diversos, sin rasgos reconocibles ni estereotipos.
- **Prohibido:** texto, letras, números, fórmulas, logos, marcas, agua, firmas, rostros reconocibles, collage, estética infantil, saturación visual.
- **Regla anti-relleno:** si la escena no aporta al concepto o a la actividad, no se genera.

## 3. Prompt maestro

Copiar y sustituir únicamente `{{ESCENA}}`, `{{FORMATO}}` y `{{ALT}}`:

```text
Actúa como director de arte de materiales educativos de bachillerato.
Genera una sola ilustración editorial, no un collage.

ESCENA: {{ESCENA}}
FORMATO: {{FORMATO}}
ESTILO: ilustración vectorial editorial semi-realista, líneas limpias, sombras suaves,
profundidad moderada, iluminación natural lateral, acabado premium de libro de texto.
PALETA: azul marino #123B5D, verde #1F7A5A, naranja #D9772A, blanco cálido #F7F4EE,
gris grafito #2E3440; acentos medidos, sin neón.
COMPOSICIÓN: sujeto principal claro, 25–35 % de espacio negativo, jerarquía visual simple,
sin elementos decorativos innecesarios.
PERSONAS: estudiantes o docentes genéricos, diversos, sin rasgos reconocibles.
PROHIBIDO: texto, letras, números, fórmulas, logos, marcas, agua, firmas, rostros
reconocibles, collage, estética infantil, saturación visual, marcas de agua.
TEXTO ALTERNATIVO: {{ALT}}
```

## 4. Catálogo priorizado: 36 escenas

Cada paquete tiene tres piezas: portada, concepto y actividad. Se puede generar una variante por sesión cambiando solo la escena.

### AECAEF — Actualiza equipos de cómputo

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `aecaef-08-hero` | Portada `08` | Taller de cómputo ordenado, técnico con EPP junto a una PC abierta y herramientas de precisión | Técnico actualizando una computadora en un taller |
| `aecaef-08-concepto` | Concepto | Vista cercana de RAM, SSD y fuente de poder sobre una mesa antiestática, sin marcas | Componentes internos de una computadora |
| `aecaef-09-actividad` | Actividad `09` | Estudiante siguiendo una lista de verificación visual mientras instala un componente, pulsera antiestática | Estudiante realizando mantenimiento de hardware |

Prompt de portada:

```text
ESCENA: taller de cómputo escolar ordenado; un técnico joven con guantes y pulsera antiestática frente a una computadora abierta; destornilladores, módulos de memoria y una lámpara de trabajo; ambiente limpio, profesional, sin marcas.
FORMATO: 16:9, 1600x900.
ALT: Técnico actualizando una computadora en un taller.
```

### CECBV — Coloca elementos constructivos básicos

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `cecbv-08-hero` | Portada `08` | Vivienda en construcción con muro de block, andamio y casco de seguridad, luz de tarde | Vivienda en construcción con elementos básicos |
| `cecbv-08-concepto` | Concepto | Corte isométrico limpio de cimentación, muro, castillo y dala, sin texto | Elementos constructivos de una vivienda |
| `cecbv-09-actividad` | Actividad `09` | Técnico colocando block con nivel y plomada, EPP completo | Colocación de block con nivel y plomada |

### CNET1 — Ciencias Naturales, Experimentales y Tecnología I

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `cnet1-08-hero` | Portada `08` | Laboratorio escolar con balanza, probeta, cuaderno de campo y luz natural | Laboratorio escolar de ciencias naturales |
| `cnet1-08-concepto` | Concepto | Composición isométrica de masa y volumen: balanza, probeta con líquido y bloques de distinto tamaño | Relación entre masa y volumen |
| `cnet1-09-actividad` | Actividad `09` | Estudiante con guantes midiendo masa y volumen de una muestra de suelo, bitácora abierta | Estudiante midiendo masa y volumen de suelo |

### CS1 — Ciencias Sociales I

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `cs1-08-hero` | Portada `08` | Espacio público comunitario con asamblea vecinal, mural y diversidad de participantes | Asamblea comunitaria en un espacio público |
| `cs1-08-concepto` | Concepto | Personas dialogando alrededor de una mesa con documentos no legibles y símbolos abstractos de participación | Diálogo sobre derechos y participación |
| `cs1-09-actividad` | Actividad `09` | Debate en aula sobre un caso comunitario, estudiante con la mano alzada, público atento | Debate escolar sobre un caso comunitario |

### DT1 — Dibujo Técnico I

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `dt1-08-hero` | Portada `08` | Mesa de dibujo técnico con escuadras, compás, regla T y planos enrollados | Mesa de dibujo técnico |
| `dt1-08-concepto` | Concepto | Plano isométrico de un objeto simple con líneas de cota abstractas, sin texto | Plano isométrico con líneas de cota |
| `dt1-09-actividad` | Actividad `09` | Estudiante dibujando a escala con regla T y escuadras, luz de estudio | Estudiante dibujando a escala |

### I1 — Inglés I

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `i1-08-hero` | Portada `08` | Aula de idiomas con estudiantes conversando y un mapa urbano al fondo | Aula de inglés con estudiantes conversando |
| `i1-08-concepto` | Concepto | Escena de ciudad o parque con objetos y espacios claramente separados, composición visual limpia | Objetos y espacios para describir en inglés |
| `i1-09-actividad` | Actividad `09` | Pareja de estudiantes describiendo una habitación con tarjetas visuales sin texto | Estudiantes describiendo una habitación |

### ICDIBV — Interpreta croquis de instalaciones

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `icdibv-08-hero` | Portada `08` | Casa en corte con instalaciones hidráulicas y eléctricas visibles, estilo editorial | Casa en corte con instalaciones básicas |
| `icdibv-08-concepto` | Concepto | Corte isométrico de instalación hidráulica, eléctrica y drenaje, conexiones limpias | Corte isométrico de instalaciones |
| `icdibv-09-actividad` | Actividad `09` | Técnico con croquis y cinta métrica revisando una instalación, EPP | Técnico revisando instalaciones con croquis |

### LC1 — Lenguaje y Comunicación I

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `lc1-08-hero` | Portada `08` | Biblioteca o aula con estudiante leyendo junto a una ventana, luz natural | Estudiante leyendo en una biblioteca |
| `lc1-08-concepto` | Concepto | Círculo de diálogo con cuaderno abierto y micrófono, sin texto | Comunicación oral y escrita |
| `lc1-09-actividad` | Actividad `09` | Debate en aula con estudiante argumentando y público atento | Estudiante argumentando en un debate |

### LMTCLCDIV — Limpia muebles, tuberías y conexiones

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `lmtclcdiv-08-hero` | Portada `08` | Instalación doméstica limpia con tuberías, herramientas y guantes de trabajo | Instalación doméstica y herramientas de limpieza |
| `lmtclcdiv-08-concepto` | Concepto | Sección transparente de tubería con flujo y cepillo de limpieza, sin texto | Limpieza interna de una tubería |
| `lmtclcdiv-09-actividad` | Actividad `09` | Técnico limpiando e inspeccionando una conexión con EPP y lista de verificación visual | Técnico limpiando una conexión |

### PM3 — Pensamiento Matemático III

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `pm3-08-hero` | Portada `08` | Mesa con balanza algebraica, bloques y gráficas abstractas | Materiales para pensar algebraicamente |
| `pm3-08-concepto` | Concepto | Balanza equilibrada con bloques y variables abstractas, sin números ni texto | Igualdad algebraica representada con balanza |
| `pm3-09-actividad` | Actividad `09` | Estudiantes resolviendo ecuaciones con manipulables y cuaderno, sin texto | Estudiantes resolviendo ecuaciones |

### PMCCELCDTM — Prepara materiales y mezclas

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `pmcc-08-hero` | Portada `08` | Taller de mezclas con cubetas, palas y EPP, textura de materiales | Taller de preparación de mezclas |
| `pmcc-08-concepto` | Concepto | Composición cenital de arena, grava, cemento y agua en contenedores separados | Materiales para dosificación de mezcla |
| `pmcc-09-actividad` | Actividad `09` | Técnico preparando mezcla con guantes, mascarilla y recipiente graduado | Preparación de mezcla con EPP |

### TPV1 — Taller de Pensamiento Variacional I

| ID | Uso | Escena | Alt |
|---|---|---|---|
| `tpv1-08-hero` | Portada `08` | Rampa, pelota y cronómetro junto a una curva abstracta en pizarrón | Movimiento y razón de cambio |
| `tpv1-08-concepto` | Concepto | Rampa con trayectoria y líneas abstractas de cambio, sin texto | Representación visual de razón de cambio |
| `tpv1-09-actividad` | Actividad `09` | Estudiantes midiendo tiempo y distancia en una rampa con cronómetro | Estudiantes midiendo movimiento en una rampa |

## 5. Convención de archivos y uso

- Nombre: `{{paquete}}-{{08|09}}-{{tipo}}-{{slug}}.webp`.
- Ejemplo: `pmcc-08-concepto-dosificacion.webp`.
- Almacenar en `public/images/materiales/contextuales/`.
- Declarar el slug en `materials-catalog.ts` solo cuando la imagen esté validada.
- Alt text obligatorio, en español, sin describir texto inexistente.
- No reutilizar una imagen de instrumento como escena de actividad.

## 6. Criterios de aceptación

Una imagen se acepta solo si cumple todo:

1. No contiene texto, letras, números, fórmulas ni logos.
2. La escena se entiende sin explicación adicional.
3. Respeta la paleta y el estilo editorial.
4. Tiene espacio negativo suficiente para el diseño.
5. No reproduce marcas, personas reales ni estereotipos.
6. Aporta al concepto o a la actividad; no es relleno.
7. Pesa menos de 500 KB después de optimizar.

## 7. Orden de producción recomendado

1. **Lote piloto:** PMCCELCDTM, CNET1 y DT1, porque concentran títulos defectuosos y alto uso de imágenes técnicas.
2. **Lote de legitimación:** I1, CS1 y LC1, para escenas humanas y comunicativas.
3. **Lote técnico:** AECAEF, CECBV, ICDIBV y LMTCLCDIV.
4. **Lote matemático:** PM3 y TPV1.
5. Auditar duplicados y huérfanos antes de generar el siguiente lote.
