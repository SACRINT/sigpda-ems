# Catálogo Maestro de Escenas Arquetipo (68 Escenas · 17 Dominios MCCEMS) — Gemini / Nano Banana

- **Fecha:** 2026-11-26
- **Fuente de verdad técnica:** Unión exacta `DisciplinaryDomainId` (17 dominios verificados) en `src/lib/prompts/disciplinary-adapters/index.ts:16-33` + paletas de acento en `src/lib/visual-engine/sacrint/discipline-packs.ts`.
- **Alcance:** Cubre las **400+ UACs** (Fundamental, Fundamental Extendida, Ampliado y Formación Laboral/BT) y alimenta de forma unificada:
  1. **Libros de Texto del Estudiante** (PDF Editorial Typst + Word DOCX),
  2. **Entregable `08`** (Presentaciones de Clase PPTX),
  3. **Entregable `09`** (Infografías Didácticas PDF).
- **Relación con `docs/CATALOGO_IMAGENES_08_09_GEMINI_NANOBANANA.md`:** Conserva al 100 % su excelente dirección de arte y criterios de calidad, pero **corrige la escalabilidad**: en lugar de crear 3 escenas por cada asignatura (lo que exigiría 1,200+ imágenes), organiza **68 escenas arquetipo** (`17 dominios × 4 arquetipos`). Las escenas piloto específicas que ya hayas generado o generes (p. ej. `CECBV`, `AECAEF`) se conservan intactas como *overrides* por sub-dominio en `public/images/escenas/overrides/`.

---

## 1. Arquitectura Visual de 4 Capas y Regla de No-Repetición

| Capa | Recurso | Dónde vive | Rol editorial |
|---|---|---|---|
| **Capa 1 (este catálogo)** | **68 escenas editoriales arquetipo** (WebP `< 500 KB`) | `public/images/escenas/<domain_id>/` | Portadas de bloque, aperturas de misión, láminas de `08` e infografías `09`. |
| **Capa 2 (existente)** | **244 PNGs de materiales/instrumentos** | `public/images/materiales/` | *Spots* marginales en sesiones (`materialSpot`) y fichas de insumos. |
| **Capa 3 (existente)** | **Diagramas SVG técnicos deterministas** | `src/lib/visual-engine/visual-dispatcher.ts` | Gráficas matemáticas, vectores, circuitos, ciclos, líneas de tiempo (vector puro en Typst). |
| **Capa 4 (respaldo)** | **Fotografía Openverse CC** | Descarga bajo demanda / caché | Solo cuando una UAC requiera fotografía documental hiperespecífica. |

### Estrategia realista de deduplicación (**por bloque**, no por libro de 72 sesiones)
- Un libro semestral tiene **72 sesiones** (3 bloques × 24 sesiones); con 68 escenas totales es matemáticamente imposible imponer deduplicación estricta por sesión en todo el semestre.
- **Regla implementada en `scene-allocator.ts` (Fase 2):**
  - **Deduplicación estricta por bloque/capítulo:** ningún bloque repite la misma escena hero entre su portada, sus 4 misiones y sus apoyos de `08`/`09`.
  - **Rotación entre Bloques 1, 2 y 3 del semestre:** Bloque 1 abre con `01-portada`, Bloque 2 con `02-concepto` y Bloque 3 con `04-comunidad` (reservando `03-practica` para la sección de taller/práctica e infografías `09`), logrando **0 repeticiones de portadas de bloque en todo el semestre**.

---

## 2. Estándar de Producción (Nano Banana / Gemini Image)

- **Modelo recomendado:** Gemini Image / Nano Banana vigente (mayor fidelidad editorial sin artefactos de texto).
- **Los 4 arquetipos por dominio y sus dimensiones exactas:**
  - `01-portada` — **16:9 · 1600 × 900 px** (WebP calidad 88, `< 500 KB`): portada de bloque / diapositiva hero `08`.
  - `02-concepto` — **16:9 · 1600 × 900 px** (WebP calidad 88, `< 500 KB`): apertura conceptual / indagación / portada Bloque 2.
  - `03-practica` — **4:5 · 1200 × 1500 px** (WebP calidad 88, `< 500 KB`): taller práctico, actividad guiada e infografía vertical `09`.
  - `04-comunidad` — **16:9 · 1600 × 900 px** (WebP calidad 88, `< 500 KB`): proyecto integrador PAEC / aplicación comunitaria / portada Bloque 3.
- **Paleta base obligatoria (armonizada con papel cálido de libro de texto):**
  - Fondo/soporte: blanco cálido `#F7F4EE`, gris grafito `#2E3440`.
  - Primarios institucionales: azul marino `#123B5D`, verde editorial `#1F7A5A`, naranja terracota `#D9772A`.
  - **Acento por dominio:** indicado en cada sección (usado con moderación, **sin neón ni fondos negros tipo cyberpunk** para mantener unidad con libros impresos y `08`/`09`).
- **Prohibiciones absolutas (criterio de rechazo inmediato):**
  - **CERO** texto, letras, números, fórmulas, etiquetas, símbolos escritos, logotipos, marcas comerciales o firmas.
  - **CERO** collages, marcos divididos, estética infantil/caricaturesca, rostros reconocibles o manos deformes.
  - **Espacio negativo obligatorio:** 25–35 % libre (preferentemente en tercio superior o izquierdo) para sobreponer títulos sin ruido visual.

### Plantilla de Prompt Maestro (copiar y pegar en Gemini / Nano Banana)

Reemplaza solo los campos `{{...}}` con los valores de cada fila del catálogo:

```text
Actúa como director de arte editorial para libros de texto comerciales de bachillerato en México (estándar Santillana / McGraw-Hill).
Genera UNA sola ilustración editorial limpia (NO collage, NO paneles divididos).

ESCENA: {{ESCENA}}
FORMATO Y PROPORCIÓN: {{FORMATO}}
ESTILO: ilustración vectorial editorial semi-realista, trazos nítidos y limpios, sombras suaves, profundidad moderada, iluminación natural lateral cálida, acabado limpio de libro de texto impreso de alta gama.
PALETA: base papel cálido #F7F4EE y grafito #2E3440; acentos editoriales equilibrados con #123B5D y {{ACENTO_DOMINIO}}; sin neón, sin fondo negro, sin saturación excesiva.
COMPOSICIÓN: sujeto principal claro y legible, 25–35 % de espacio negativo limpio en la zona superior o lateral izquierda para tipografía, jerarquía visual ordenada, sin objetos decorativos irrelevantes.
PERSONAS (si aplica): estudiantes de bachillerato (15–18 años) o docentes mexicanos diversos, genéricos, de perfil o tres cuartos, vestimenta escolar/taller sobria, sin rasgos faciales hiper-reconocibles ni estereotipos.
STRICT NEGATIVE / PROHIBIDO: absolutamente CERO texto, CERO letras, CERO números, CERO fórmulas matemáticas, CERO etiquetas, CERO logotipos, CERO marcas de agua, CERO firmas, CERO estilo infantil, CERO collage.
```

---

## 3. Plan de Producción en 3 Lotes (para generar en paralelo)

| Lote | Dominios incluidos | Escenas | Impacto inmediato |
|---|---|---:|---|
| **Lote 1 (Prioridad Máxima)** | Dominios 01, 02, 03, 04, 07, 08 (tronco común Fundamental) | **24** | Cubre ~75–80 % de tus planeaciones actuales de 1.° a 4.° semestre. |
| **Lote 2 (Prioridad Alta)** | Dominios 05, 09, 11, 12, 13, 17 (Inglés, Cultura Digital, Ampliado y General) | **24** | Completa 100 % del Currículum Fundamental + Currículum Ampliado. |
| **Lote 3 (Especializado y Laboral)** | Dominios 06, 10, 14, 15, 16 (Formación Laboral, Dibujo Técnico, Lenguas adicionales) | **20** | Cubre todas las capacitaciones laborales, BT y materias extendidas. |
| **Total** | **17 dominios `DisciplinaryDomainId`** | **68** | **100 % de las 400+ UACs MCCEMS sin escenas genéricas.** |

---

## 4. Catálogo Completo de las 68 Escenas (17 Dominios × 4 Arquetipos)

---

### Dominio 01 · `pensamiento_matematico` (Lote 1)
- **Nombre oficial:** Pensamiento Matemático, Variacional y Estadístico
- **Acento editorial:** dorado ocre `#B8860B` y azul técnico `#1D5B8C`
- **Carpeta:** `public/images/escenas/pensamiento_matematico/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `mat-01-portada.webp` | Portada · `16:9 (1600×900)` | Dos estudiantes de bachillerato midiendo el patio escolar con cinta métrica, escuadra de madera y cuaderno cuadriculado abierto junto a una maqueta arquitectónica simple; al fondo luz solar proyectando sombras geométricas limpias sobre el piso de concreto; tercio izquierdo despejado. | Estudiantes aplicando medición geométrica en el patio escolar |
| `mat-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Vista cenital en ángulo de tres cuartos de un escritorio luminoso de estudio con compás metálico, escuadra translúcida, dados poliédricos, bloques de madera proporcionales y una curva parabólica trazada suavemente en papel milimétrico sin ejes rotulados ni números; espacio negativo amplio arriba. | Instrumentos geométricos y curva matemática sobre mesa de estudio |
| `mat-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante de bachillerato en pupitre de madera resolviendo un problema práctico con calculadora científica sin pantalla legible, regla, compás y tarjetas de probabilidad ordenadas sobre la mesa; iluminación lateral suave de ventana y fondo despejado en la parte superior. | Estudiante trabajando con calculadora e instrumentos geométricos |
| `mat-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Equipo de tres jóvenes levantando datos en un huerto o mercado comunitario mexicano con tabla de registro sin texto, cinta métrica y tablet mostrando gráficas de barras abstractas sin números; arquitectura escolar y árboles al fondo, cielo claro en el tercio superior. | Equipo estudiantil recabando datos estadísticos en su comunidad |

---

### Dominio 02 · `ciencias_fisica_ingenieria` (Lote 1)
- **Nombre oficial:** Ciencias Naturales y Experimentales: Física, Energía y Mecánica
- **Acento editorial:** azul cian técnico `#1B7EA6` y cobre cálido `#C86D2D`
- **Carpeta:** `public/images/escenas/ciencias_fisica_ingenieria/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `fis-01-portada.webp` | Portada · `16:9 (1600×900)` | Laboratorio escolar de física iluminado por luz natural; dos estudiantes con bata blanca observando el desplazamiento de una esfera metálica sobre un plano inclinado de aluminio con polea, pesas calibradas y cronómetro analógico sin carátula legible; pared clara a la izquierda. | Estudiantes experimentando con un plano inclinado y poleas en laboratorio |
| `fis-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Mesa de laboratorio limpia con un prisma óptico de vidrio refractando un haz sutil de luz solar en espectro suave, un imán de herradura con limadura metálica formando líneas de campo limpias y una bobina de cobre; amplio espacio negativo superior en blanco cálido. | Prisma óptico, imán y bobina ilustrando fenómenos físicos |
| `fis-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante con gafas de seguridad probando un circuito eléctrico escolar simple con protoboard, cables de colores, interruptor, pequeño panel solar y multímetro con pantalla apagada sobre mesa de laboratorio ordenada; espacio superior libre para título. | Estudiante armando un circuito eléctrico con panel solar en mesa de pruebas |
| `fis-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Jóvenes de bachillerato y un docente inspeccionando un prototipo de calentador solar escolar y una pequeña turbina eólica demostrativa en la azotea segura del plantel con paisaje semirural de Puebla al fondo; cielo limpio en el tercio superior. | Estudiantes evaluando prototipos de energía solar y eólica en su plantel |

---

### Dominio 03 · `ciencias_quimica_biologia_ambiental` (Lote 1)
- **Nombre oficial:** Ciencias Naturales: Química, Biología, Ecología y Salud Ambiental
- **Acento editorial:** verde botánico `#1F7A5A` y turquesa laboratorio `#2A8C82`
- **Carpeta:** `public/images/escenas/ciencias_quimica_biologia_ambiental/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `bio-01-portada.webp` | Portada · `16:9 (1600×900)` | Laboratorio escolar luminoso de ciencias experimentales; dos estudiantes con bata blanca y lentes protectores observando muestras botánicas en microscopio óptico junto a matraces Erlenmeyer con líquidos traslúcidos verde y ámbar; fondo claro despejado a la izquierda. | Estudiantes analizando muestras en laboratorio de biología y química |
| `bio-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Composición editorial en mesa limpia con modelo molecular de esferas y varillas, placas de Petri con hojas verdes frescas, tubos de ensayo en gradilla de madera y lupa de campo; fondo papel cálido con 30 % de aire visual arriba. | Modelo molecular, placas de Petri y material de laboratorio |
| `bio-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante con bata y guantes de nitrilo utilizando una pipeta sobre un vaso de precipitados mientras observa un cambio suave de color en la disolución, junto a tiras reactivas y libreta abierta sin escritura; espacio libre en la franja superior. | Estudiante realizando una titulación química controlada |
| `bio-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Grupo de tres estudiantes tomando muestras de agua limpia en un arroyo local y registrando la flora nativa junto a un huerto escolar con composta y árboles jóvenes; atmósfera luminosa de mañana y tercio superior despejado. | Estudiantes realizando monitoreo ambiental de agua y flora comunitaria |

---

### Dominio 04 · `lengua_comunicacion_literatura` (Lote 1)
- **Nombre oficial:** Lengua y Comunicación, Lectura, Expresión Oral y Literatura
- **Acento editorial:** borgoña editorial `#8B2E3C` y azul tinta `#123B5D`
- **Carpeta:** `public/images/escenas/lengua_comunicacion_literatura/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `lit-01-portada.webp` | Portada · `16:9 (1600×900)` | Biblioteca escolar acogedora y luminosa con estanterías de madera clara; tres estudiantes de bachillerato sentados alrededor de una mesa redonda comentando libros abiertos y cuadernos de notas; luz natural desde ventanales y amplio espacio claro arriba a la izquierda. | Estudiantes dialogando en círculo de lectura en biblioteca escolar |
| `lit-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Escritorio de lectura con un libro empastado abierto de páginas en blanco cálido sin texto, pluma fuente estilizada, separadores de tela, tarjetas de notas de colores suaves y una taza de cerámica; composición equilibrada con 35 % de espacio libre. | Libro abierto, pluma y tarjetas de análisis textual sobre escritorio |
| `lit-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante de pie frente a un pequeño atril en aula de bachillerato exponiendo con seguridad y gesto comunicativo abierto hacia compañeros sentados en semicírculo; sin pizarrones con texto, parte superior despejada. | Estudiante realizando exposición oral argumentada ante su grupo |
| `lit-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Jóvenes entrevistando con micrófono de mano y libreta a una persona mayor de la comunidad en una plaza arbolada mexicana para recopilar memoria oral y crónicas locales; iluminación cálida de tarde y cielo despejado arriba. | Estudiantes entrevistando a un miembro de la comunidad para crónica local |

---

### Dominio 05 · `lengua_extranjera_ingles` (Lote 2)
- **Nombre oficial:** Lengua Extranjera (Inglés)
- **Acento editorial:** azul internacional `#1B5E9A` y ámbar suave `#D9772A`
- **Carpeta:** `public/images/escenas/lengua_extranjera_ingles/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `eng-01-portada.webp` | Portada · `16:9 (1600×900)` | Dos estudiantes de bachillerato conversando animadamente en una mesa escolar con audífonos sobre el cuello, una laptop abierta sin texto visible y un globo terráqueo minimalista de escritorio; ambiente moderno y cálido, tercio izquierdo limpio. | Estudiantes practicando conversación en lengua extranjera con apoyo multimedia |
| `eng-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Bodegón editorial con auriculares modernos, micrófono condensador compacto, tarjetas de vocabulario en blanco de colores suaves, un globo terráqueo estilizado y un mapa de rutas aéreas abstracto sin nombres; espacio libre arriba. | Equipo de audio y recursos visuales para práctica de idiomas |
| `eng-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante con audífonos escuchando audio en una tableta mientras toma notas en un cuaderno en aula luminosa, con tarjetas ilustradas simples de escenas cotidianas (sin letras) sobre el pupitre; zona superior libre. | Estudiante realizando práctica auditiva y toma de notas |
| `eng-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Estudiantes de bachillerato guiando con cordialidad a visitantes extranjeros en un patio cultural tradicional mexicano señalando elementos arquitectónicos y artesanías con un folleto ilustrado sin texto; cielo despejado arriba. | Estudiantes practicando comunicación intercultural en un espacio cultural local |

---

### Dominio 06 · `lengua_extranjera_general` (Lote 3)
- **Nombre oficial:** Lengua Extranjera Adicional (Enfoque Comunicativo MCER)
- **Acento editorial:** azul índigo `#2B4C7E` y terracota `#C96A3B`
- **Carpeta:** `public/images/escenas/lengua_extranjera_general/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `lex-01-portada.webp` | Portada · `16:9 (1600×900)` | Aula de idiomas moderna con mapa mundi estilizado sin texto en la pared, tres estudiantes interactuando en diálogo por pares alrededor de una mesa con cuadernos y tarjetas ilustradas de situaciones de viaje; amplio espacio claro arriba a la izquierda. | Estudiantes en práctica comunicativa intercultural en aula de idiomas |
| `lex-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Escritorio limpio con pasaporte genérico sin texto, brújula, audífonos, libreta de viaje encuadernada en tela y postales ilustradas de paisajes europeos y asiáticos sin letras; espacio negativo superior en tono crema. | Recursos visuales de viaje y comunicación plurilingüe |
| `lex-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Pareja de estudiantes representando una situación cotidiana de diálogo (como pedir orientación o describir una escena) usando tarjetas con pictogramas simples sin palabras en el salón; franja superior despejada. | Pareja de estudiantes realizando juego de rol comunicativo |
| `lex-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Muestra cultural escolar en patio abierto con mesas decoradas con artesanías, música e instrumentos de diversas culturas mientras estudiantes presentan intercambios culturales; sin banderas con texto ni letreros, cielo limpio arriba. | Muestra de intercambio cultural y diversidad lingüística en plantel |

---

### Dominio 07 · `conciencia_historica_ciencias_sociales` (Lote 1)
- **Nombre oficial:** Conciencia Histórica, Ciencias Sociales, Economía y Derecho
- **Acento editorial:** ámbar archivo `#C57B27` y rojo ladrillo `#9E3B33`
- **Carpeta:** `public/images/escenas/conciencia_historica_ciencias_sociales/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `his-01-portada.webp` | Portada · `16:9 (1600×900)` | Dos estudiantes examinando un mapa topográfico histórico estilizado sin texto y fotografías antiguas genéricas en sepia sobre una mesa de archivo luminosa con lupa de latón y carpetas de cartón kraft; pared cálida despejada a la izquierda. | Estudiantes analizando fuentes cartográficas y documentales |
| `his-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Composición limpia en escritorio con balanza clásica de justicia en latón mate, mapa geográfico antiguo sin nombres, cinta cronológica abstracta de madera y carpetas de archivo; 30 % de espacio negativo arriba. | Símbolos editoriales de historia, territorio, sociedad y derecho |
| `his-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiantes en mesa de debate escolar con tarjetas de argumentos en blanco y una línea de tiempo visual hecha con hilos y tarjetas ilustradas sin texto sobre un corcho; espacio superior libre para encabezado. | Estudiantes organizando evidencias históricas y argumentos sociales |
| `his-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Jóvenes y vecinos dialogando en una asamblea cívica comunitaria en un quiosco o plaza pública tradicional de pueblo mexicano, observando un plano del barrio sin texto; luz cálida y cielo despejado en el tercio superior. | Participación cívica y análisis territorial en la comunidad |

---

### Dominio 08 · `humanidades_filosofia_logica_etica` (Lote 1)
- **Nombre oficial:** Humanidades, Filosofía, Lógica, Ética y Estética
- **Acento editorial:** oro viejo `#A6842D` y azul pizarra `#355070`
- **Carpeta:** `public/images/escenas/humanidades_filosofia_logica_etica/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `fil-01-portada.webp` | Portada · `16:9 (1600×900)` | Grupo pequeño de cuatro estudiantes sentados en semicírculo bajo los árboles de un patio escolar dialogando reflexivamente en un círculo filosófico con libretas en mano; iluminación dorada suave y espacio claro amplio a la izquierda. | Círculo de diálogo filosófico entre estudiantes al aire libre |
| `fil-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Escena minimalista sobre mesa de madera clara con un reloj de arena de vidrio, un poliedro geométrico de cerámica, una balanza en equilibrio, cuaderno abierto en blanco y sombra arquitectónica serena; 35 % de aire visual arriba. | Objetos simbólicos de reflexión filosófica, ética y lógica |
| `fil-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Dos estudiantes frente a frente en pupitres escuchándose con atención durante un ejercicio de argumentación dialógica con fichas de madera de colores que representan premisas y conclusiones (sin texto); tercio superior limpio. | Estudiantes practicando escucha activa y análisis argumentativo |
| `fil-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Foro juvenil abierto en un centro cultural comunitario con estudiantes exponiendo dilemas éticos contemporáneos frente a familias y docentes en un ambiente respetuoso y luminoso; parte superior despejada. | Foro escolar y comunitario de reflexión ética |

---

### Dominio 09 · `cultura_digital_programacion_ti` (Lote 2)
- **Nombre oficial:** Cultura Digital, Pensamiento Algorítmico, Programación y TI
- **Acento editorial:** azul eléctrico sobrio `#1E6FB8` y verde menta `#1F8A70`
- **Carpeta:** `public/images/escenas/cultura_digital_programacion_ti/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `tic-01-portada.webp` | Portada · `16:9 (1600×900)` | Aula de cómputo luminosa y moderna; dos estudiantes colaborando frente a una laptop cuya pantalla muestra bloques geométricos abstractos de flujo de color azul y verde (sin texto ni código legible) junto a un pequeño microcontrolador sobre el escritorio; tercio izquierdo libre. | Estudiantes diseñando algoritmos y soluciones digitales en aula |
| `tic-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Vista isométrica limpia de una placa microcontroladora estilizada, cables de conexión ordenados, bloques lógicos geométricos encajados y un candado minimalista de ciberseguridad sobre superficie clara; sin letras ni marcas, amplio espacio superior. | Componentes de pensamiento computacional y ciudadanía digital |
| `tic-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante depurando un prototipo en laptop conectada por cable a un pequeño robot educativo de escritorio con sensores y LEDs suaves en mesa escolar ordenada; sin texto en pantalla, franja superior limpia. | Estudiante programando y probando un prototipo tecnológico |
| `tic-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Estudiantes de bachillerato impartiendo un taller de alfabetización digital segura a adultos mayores de su comunidad con tabletas y laptops en una sala comunitaria iluminada; zona superior despejada. | Taller comunitario de alfabetización y seguridad digital |

---

### Dominio 10 · `dibujo_tecnico_diseno_arquitectura` (Lote 3)
- **Nombre oficial:** Dibujo Técnico, Expresión Gráfica, Diseño y Planimetría
- **Acento editorial:** azul plano `#1B4965` y grafito `#3A4654`
- **Carpeta:** `public/images/escenas/dibujo_tecnico_diseno_arquitectura/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `dib-01-portada.webp` | Portada · `16:9 (1600×900)` | Taller de dibujo técnico bien iluminado; estudiante inclinado sobre restirador trazando líneas limpias con regla T, escuadra 30–60 y portaminas sobre papel albanene con una proyección isométrica arquitectónica sin cotas ni números; tercio izquierdo despejado. | Estudiante elaborando trazo geométrico en restirador técnico |
| `dib-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Vista cenital de un escalímetro sin números, compás técnico metálico, estilógrafos, plantillas geométricas y una pequeña maqueta blanca minimalista de vivienda sobre tapete de corte verde oliva; 30 % de espacio negativo arriba. | Herramientas de dibujo técnico y maqueta arquitectónica básica |
| `dib-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Manos de estudiante ensamblando con precisión una maqueta arquitectónica a escala de cartón batería blanco con escuadra metálica y pegamento de precisión sobre mesa limpia; zona superior despejada. | Construcción de maqueta a escala en taller de diseño |
| `dib-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Equipo de estudiantes presentando una maqueta de remodelación de un parque o espacio escolar accesible sobre una mesa en el patio del plantel frente a docentes y compañeros; fondo luminoso y cielo libre arriba. | Presentación de proyecto de diseño de espacio comunitario |

---

### Dominio 11 · `actividades_fisicas_deportivas_salud` (Lote 2)
- **Nombre oficial:** Actividades Físicas y Deportivas, Educación Física y Recreación
- **Acento editorial:** naranja dinámico `#D96528` y azul deportivo `#1B6CA8`
- **Carpeta:** `public/images/escenas/actividades_fisicas_deportivas_salud/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `efd-01-portada.webp` | Portada · `16:9 (1600×900)` | Cancha polideportiva escolar limpia al amanecer; grupo diverso de estudiantes con ropa deportiva sobria realizando estiramiento dinámico guiado con conos de entrenamiento y balones ordenados a un costado; cielo claro y amplio espacio libre a la izquierda. | Estudiantes realizando calentamiento guiado en cancha escolar |
| `efd-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Composición ordenada sobre superficie clara con cuerda de salto, cronómetro analógico sin números, botella reutilizable de hidratación, conos deportivos, tapete de ejercicio enrollado y silueta anatómica sutil de postura; 30 % de espacio negativo arriba. | Equipo básico de acondicionamiento físico e hidratación |
| `efd-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Dos estudiantes ejecutando un circuito de coordinación y equilibrio con aros y escalera de agilidad en el patio escolar mientras un compañero observa la técnica con tabla de registro sin texto; parte superior despejada. | Estudiantes realizando circuito de coordinación y control motriz |
| `efd-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Jornada deportiva y recreativa incluyente en el plantel con estudiantes y familias participando en caminata activa y juegos cooperativos al aire libre; ambiente saludable y cielo despejado arriba. | Jornada comunitaria de activación física y deporte cooperativo |

---

### Dominio 12 · `artes_educacion_artistica_cultural` (Lote 2)
- **Nombre oficial:** Educación Artística y Cultural, Artes Visuales, Música, Danza y Teatro
- **Acento editorial:** ciruela artístico `#7B3F8C` y ocre cálido `#D48A29`
- **Carpeta:** `public/images/escenas/artes_educacion_artistica_cultural/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `art-01-portada.webp` | Portada · `16:9 (1600×900)` | Taller escolar luminoso de artes con caballetes de madera; estudiantes pintando un mural colectivo de formas geométricas y botánicas coloridas mientras al fondo otro estudiante sostiene una guitarra acústica; espacio claro y amplio a la izquierda. | Estudiantes creando obra artística en taller escolar de artes |
| `art-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Mesa creativa con paleta de madera con manchas armoniosas de pintura acrílica, pinceles limpios, carboncillo, cuaderno de bocetos con trazo abstracto, pequeña máscara teatral neutra y un instrumento de percusión artesanal; 30 % de aire visual arriba. | Materiales de artes visuales, música y expresión escénica |
| `art-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante concentrado moldeando una pieza de barro o trazando un boceto sobre papel grueso en un caballete con luz natural de ventana lateral; sin textos ni firmas, franja superior limpia. | Estudiante desarrollando una pieza práctica en taller artístico |
| `art-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Festival cultural escolar en patio abierto con exposición de pinturas en mamparas de madera y un ensamble juvenil de música y danza folclórica estilizada frente a la comunidad; cielo cálido despejado en el tercio superior. | Muestra artística y cultural estudiantil abierta a la comunidad |

---

### Dominio 13 · `socioemocional_tutoria_educacion_integral` (Lote 2)
- **Nombre oficial:** Formación Socioemocional, Educación para la Salud, Sexualidad y Práctica Social
- **Acento editorial:** lavanda sereno `#6B5B95` y verde bienestar `#2A8C6E`
- **Carpeta:** `public/images/escenas/socioemocional_tutoria_educacion_integral/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `soc-01-portada.webp` | Portada · `16:9 (1600×900)` | Espacio escolar luminoso con plantas de interior; círculo de cinco estudiantes diversos y una tutora compartiendo una sesión de escucha empática en ambiente seguro y cálido; pared clara despejada en el tercio izquierdo. | Sesión de tutoría socioemocional y escucha empática en grupo |
| `soc-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Composición serena con piedras lisas en equilibrio, una planta suculenta en maceta de cerámica, diario personal cerrado con separador de tela, lápices de tonos cálidos y frutas frescas saludables sobre mesa clara; 35 % de espacio negativo arriba. | Elementos visuales de autocuidado, equilibrio emocional y salud integral |
| `soc-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Dos estudiantes colaborando en una mesa creando un mapa visual con notas adhesivas de colores pasteles (sin texto) y tarjetas de hábitos saludables mientras conversan con calma; tercio superior despejado. | Estudiantes elaborando un plan visual de bienestar y autocuidado |
| `soc-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Estudiantes de bachillerato organizando una jornada de servicio solidario sembrando árboles y pintando bancas comunitarias en un parque vecinal con cooperación e inclusión; cielo limpio arriba. | Jóvenes participando en jornada comunitaria solidaria |

---

### Dominio 14 · `formacion_laboral_servicios_gestion_turismo` (Lote 3)
- **Nombre oficial:** Formación Laboral y Tecnológica: Administración, Contabilidad, Turismo, Gastronomía, Estética, Confección y Servicios
- **Acento editorial:** azul corporativo `#123B5D` y terracota cálido `#C96A2B`
- **Carpeta:** `public/images/escenas/formacion_laboral_servicios_gestion_turismo/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `srv-01-portada.webp` | Portada · `16:9 (1600×900)` | Oficina escolar simulada moderna y ordenada; dos jóvenes con vestimenta formal escolar revisando hojas de cálculo abstractas en laptop (sin cifras legibles), carpetas de proyectos y un calendario de escritorio sin texto; pared clara a la izquierda. | Estudiantes gestionando procesos administrativos y de servicios |
| `srv-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Mesa limpia con calculadora financiera sin pantalla legible, carpeta ejecutiva, agenda abierta sin texto, organizador de documentos, taza de café artesanal y pequeño mapa turístico ilustrado sin nombres; 30 % de espacio negativo arriba. | Instrumentos de gestión administrativa, contable y turística |
| `srv-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante con mandil limpio de servicio preparando y emplatando ordenadamente un platillo saludable en cocina didáctica higiénica (o atendiendo estación de hospitalidad limpia), sin marcas comerciales; parte superior libre. | Estudiante aplicando estándares de calidad en taller de servicios |
| `srv-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Feria escolar de microemprendimiento local donde estudiantes presentan productos artesanales y servicios turísticos comunitarios en módulos ordenados de madera ante visitantes; sin letreros con texto, cielo claro arriba. | Feria estudiantil de emprendimiento y servicios comunitarios |

---

### Dominio 15 · `formacion_laboral_salud_clinica` (Lote 3)
- **Nombre oficial:** Formación Laboral y Ciencias de la Salud: Enfermería, Atención Clínica, Farmacia, Nutrición y Mecánica Dental
- **Acento editorial:** verde clínico `#1F7A5A` y rojo señal sobrio `#B83B3B`
- **Carpeta:** `public/images/escenas/formacion_laboral_salud_clinica/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `sal-01-portada.webp` | Portada · `16:9 (1600×900)` | Aula clínica escolar higiénica y luminosa; estudiante con filipina clínica blanca limpia, guantes y estetoscopio practicando toma de presión arterial con baumanómetro sobre un modelo anatómico de práctica bajo supervisión docente; fondo claro a la izquierda. | Práctica supervisada de signos vitales en aula clínica escolar |
| `sal-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Bandeja clínica ordenada de acero inoxidable sobre mesa blanca cálida con estetoscopio, termómetro digital apagado, gasas estériles selladas sin etiquetas, guantes de látex y botella de gel antiséptico sin texto; 30 % de espacio libre arriba. | Instrumental básico de bioseguridad y valoración clínica |
| `sal-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante con cubrebocas y guantes realizando correctamente la técnica de lavado clínico o preparando un botiquín de primeros auxilios ordenado sobre una mesa de trabajo; franja superior despejada. | Estudiante aplicando protocolo de bioseguridad y primeros auxilios |
| `sal-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Brigada escolar de promoción de la salud en una carpa limpia al aire libre orientando a familias sobre hidratación, nutrición con modelos de frutas y prevención comunitaria sin carteles con texto; cielo despejado arriba. | Brigada estudiantil de prevención y educación para la salud comunitaria |

---

### Dominio 16 · `formacion_laboral_industrial_agro_salud` (Lote 3)
- **Nombre oficial:** Formación Laboral y Tecnológica: Industrial, Eléctrica, Domótica, Construcción y Agropecuaria
- **Acento editorial:** azul acero `#1F4E79` y amarillo seguridad ocre `#C98A1C`
- **Carpeta:** `public/images/escenas/formacion_laboral_industrial_agro_salud/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `ind-01-portada.webp` | Portada · `16:9 (1600×900)` | Taller técnico escolar seguro y ordenado; dos jóvenes con casco ligero, lentes de protección y guantes revisando un tablero didáctico de instalaciones eléctricas y tubería hidráulica de práctica con nivel de burbuja; tercio izquierdo despejado. | Estudiantes con equipo de protección trabajando en taller técnico |
| `ind-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Banco de trabajo limpio de madera con casco de seguridad, gafas protectoras, calibrador Vernier sin escala numérica, juego de llaves, nivel de burbuja y plano técnico enrollado sin texto; 30 % de espacio negativo arriba. | Herramientas de precisión y equipo de protección personal en taller |
| `ind-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Estudiante con lentes y guantes midiendo con precisión una pieza metálica o ensamblando una conexión de riego por goteo sobre banco de trabajo limpio; iluminación lateral cálida y zona superior libre. | Estudiante ejecutando medición y ensamble en práctica de taller |
| `ind-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Estudiantes con equipo de protección instalando un sistema escolar de captación de agua pluvial y camas de cultivo agroecológico con riego por goteo en el terreno del plantel; cielo despejado arriba. | Proyecto técnico comunitario de captación pluvial y cultivo sostenible |

---

### Dominio 17 · `indagacion_interdisciplinaria_general` (Lote 2)
- **Nombre oficial:** Formación Curricular General e Indagación Interdisciplinaria (MCCEMS)
- **Acento editorial:** azul institucional `#123B5D` y verde NEM `#1F7A5A`
- **Carpeta:** `public/images/escenas/indagacion_interdisciplinaria_general/`

| Archivo | Arquetipo y formato | Escena lista para `{{ESCENA}}` | ALT accesible |
|---|---|---|---|
| `gen-01-portada.webp` | Portada · `16:9 (1600×900)` | Mesa colaborativa en un espacio maker escolar luminoso donde cuatro estudiantes integran saberes con una libreta de campo, una maqueta sencilla, una laptop sin texto y una lupa observando muestras naturales; amplio espacio claro a la izquierda. | Equipo interdisciplinario colaborando en proyecto integrador escolar |
| `gen-02-concepto.webp` | Concepto · `16:9 (1600×900)` | Composición limpia sobre escritorio cálido con brújula, lupa, cuaderno de bitácora abierto sin escritura, piezas de rompecabezas de madera encajadas y bloques de notas de colores suaves; 35 % de aire visual arriba. | Símbolos editoriales de indagación y pensamiento interdisciplinario |
| `gen-03-practica.webp` | Práctica · `4:5 (1200×1500)` | Pareja de estudiantes construyendo un mapa conceptual físico con tarjetas de colores y conectores de hilo sobre un tablero limpio (sin texto ni letras) durante un taller de investigación escolar; parte superior libre. | Estudiantes estructurando un proyecto de investigación colaborativa |
| `gen-04-comunidad.webp` | Comunidad · `16:9 (1600×900)` | Exposición escolar PAEC en patio arbolado donde equipos de estudiantes comparten prototipos y proyectos comunitarios en mesas ordenadas frente a padres, docentes y autoridades escolares; cielo limpio arriba. | Feria escolar comunitaria de proyectos integradores PAEC |

---

## 5. Lista de Verificación antes de Subir cada Imagen al Repositorio

Antes de guardar cualquier archivo en `public/images/escenas/<domain_id>/<slug>.webp`, confirmar:
1. **Cero texto / números / letras / marcas** (ni siquiera texto borroso en pantallas, portadas de libros, cronómetros o carteles de fondo).
2. **Proporción y peso:** `1600×900` (`01`, `02`, `04`) o `1200×1500` (`03`), formato `.webp`, peso `< 500 KB`.
3. **Espacio negativo 25–35 %** respetado para sobreponer títulos en portadas `08`, infografías `09` y encabezados Typst.
4. **Coherencia visual con la serie:** iluminación natural cálida y paleta sin neón (que las 68 imágenes parezcan ilustradas por la **misma casa editorial**).
