# Catálogo Ampliado de Materiales, Instrumentos y Escenas de Aplicación Real — Gemini / Nano Banana

- **Fecha:** 2026-11-26
- **Proyecto:** SIGPDA-EMS · MCCEMS 2026-2027 (400+ UACs y 66 carreras BT)
- **Objetivo:** Ampliar el inventario visual de la plataforma siguiendo exactamente lo que funciona mejor en libros de texto reales de bachillerato:
  1. **72 nuevos instrumentos, materiales y objetos didácticos aplicados** (Lote P7, `512 × 512 px`, PNG) en el mismo estilo técnico limpio que tus 244 materiales actuales (`microscopio-optico.png`, `panel-solar.png`, `alicates.png`), cubriendo las áreas que hoy tienen pocos o cero objetos (Humanidades, Historia, Ciencias Sociales, Lengua/Inglés, Deportes/Salud, Artes/Música, Física/Matemáticas avanzadas, Metrología/Construcción/HVAC, Agro/Apicultura/Biotecnología y Administración/Logística/TI).
  2. **Renovación opcional de los 16 materiales existentes de baja densidad (`< 8.2 KB`)** detectados en `docs/inventario-calidad-materiales.md`.
  3. **Actualización opcional en caliente (sin tocar código)** de las escenas con personas del catálogo de 68 escenas que se ven caricaturescas, cambiándolas a **fotografía editorial / montaje técnico real en acción** (mostrando la aplicación del conocimiento en el entorno real del estudiante, cero trazo de cómic).

> **Nota importante para integración:** Cuando termines de generar los PNGs de la Parte A y los guardes en `public/images/materiales/` con el nombre exacto de la columna `Archivo`, avísame para registrarlos en `src/lib/materials/materials-catalog.ts` (con sus alias para `auto-tokenize.ts` y pruebas en verde). No hace falta modificar nada más.

---

## PARTE A — 72 Nuevos Materiales e Instrumentos Aplicados (Lote P7 · `512 × 512 px` PNG)

### Estándar técnico obligatorio (idéntico al catálogo existente de 244 PNGs)
- **Resolución:** `512 × 512 px` (si Gemini genera `1024 × 1024 px`, redimensionar a `512 × 512 px` en PNG).
- **Carpeta destino:** `public/images/materiales/<slug>.png`.
- **Estilo visual:** Ilustración técnica editorial limpia, vista tres cuartos o isométrica ligera, sobre **fondo blanco puro `#FFFFFF`**, con sombra suave de apoyo en la base.
- **Paleta armonizada con los 244 PNGs existentes:** Contornos gris azulado oscuro `#1E2F47`, superficies acero/gris claro `#D8E0EA`, azul técnico `#2B4C7E`, acentos sobrios en latón/dorado `#C9A24D`, verde laboratorio `#1F7A5A` o terracota `#C86D2D` solo cuando el objeto real lo requiera.
- **Prohibiciones absolutas:** CERO texto, CERO letras, CERO números, CERO marcas comerciales, CERO personas o manos caricaturescas, CERO fondos grises/cuadriculados, CERO estilo infantil o kawaii.

### Prompt Maestro — Parte A (copiar y sustituir solo `{{OBJETO}}`)

```text
Actúa como ilustrador técnico de enciclopedias y libros de texto comerciales de bachillerato.
Genera UNA sola ilustración técnica aislada de un objeto didáctico real.

OBJETO: {{OBJETO}}
FORMATO: cuadrado 1:1 (512x512 px), objeto centrado con margen blanco del 12% alrededor.
ESTILO: ilustración técnica vectorial limpia de precisión (acabado tipo manual científico/industrial), vista de tres cuartos ligeramente elevada, líneas nítidas en azul grafito oscuro #1E2F47, sombreado suave y sutil con volumen realista, pequeña sombra elíptica gris clara en la base.
PALETA: fondo blanco puro uniforme #FFFFFF; cuerpo en tonos acero, blanco roto, azul marino técnico #2B4C7E y acentos discretos en latón #C9A24D o color real sobrio del instrumento; sin neón ni saturación excesiva.
PROHIBIDO: absolutamente CERO texto, CERO letras, CERO números, CERO marcas, CERO logotipos, CERO personas, CERO manos, CERO estética infantil o caricaturesca, CERO collage, CERO fondo decorado.
```

---

### Lote A1 — Conciencia Histórica, Ciencias Sociales, Filosofía y Humanidades (9)
*Cubre el mayor hueco del catálogo actual (hoy solo existen 4 ítems para todo el bloque histórico-filosófico).*

| # | Archivo (`public/images/materiales/`) | Categoría sugerida | Descripción lista para `{{OBJETO}}` |
|---:|---|---|---|
| 1 | `codice-prehispanico.png` | `ofimatica` / humanidades | Códice mesoamericano doblado en biombo (acordeón) de papel amate desplegado parcialmente mostrando franjas geométricas abstractas en ocre y rojo sin texto ni glifos legibles |
| 2 | `constitucion-mexicana.png` | `ofimatica` / sociales | Volumen jurídico empastado en tela azul marino y cantos dorados con separador de listón rojo, ligeramente entreabierto en perspectiva tres cuartos, portada lisa sin texto ni escudos legibles |
| 3 | `balanza-justicia.png` | `ofimatica` / sociales | Balanza clásica de dos platillos en latón y base de acero azulado en perfecto equilibrio, diseño limpio y geométrico de escritorio académico |
| 4 | `urna-electoral.png` | `ofimatica` / sociales | Urna transparente escolar de acrílico con marco azul marino y una boleta de papel doblada en blanco entrando por la ranura superior, sin leyendas ni siglas |
| 5 | `globo-terraqueo.png` | `medicion` | Globo terráqueo escolar de escritorio sobre base metálica curva y meridiano graduado, continentes en verde salvia y océanos en azul claro, sin nombres ni texto |
| 6 | `mapa-historico-mexico.png` | `medicion` | Mapa desplegado en pergamino grueso con contornos cartográficos suaves, rosa de los vientos minimalista y pesas metálicas en las esquinas, sin palabras ni fechas |
| 7 | `piramide-poblacion-maqueta.png` | `matematicas` | Maqueta didáctica tridimensional de barras horizontales escalonadas en dos colores sobrios (azul acero y ocre) sobre base de madera clara representando estructura demográfica, sin ejes rotulados |
| 8 | `busto-filosofico.png` | `arte` | Escultura didáctica en yeso mate blanco-gris de un busto clásico estilizado sobre pedestal pequeño sobrio, referencia de filosofía y estética clásica |
| 9 | `pergamino-documental.png` | `ofimatica` | Rollo de documento histórico en papel algodón envejecido sujeto con listón sobrio junto a una lupa metálica pequeña, sin escritura legible |

---

### Lote A2 — Lengua, Comunicación, Literatura, Inglés y Producción de Medios (9)

| # | Archivo (`public/images/materiales/`) | Categoría sugerida | Descripción lista para `{{OBJETO}}` |
|---:|---|---|---|
| 10 | `libro-anotado.png` | `arte` | Libro abierto de pasta dura con páginas limpias, marcadores adhesivos de pestaña en colores sobrios (azul, verde, ocre) sobresaliendo del borde y un lápiz técnico apoyado encima, sin texto |
| 11 | `diccionario-bilingue.png` | `arte` | Diccionario grueso empastado con muescas laterales en el canto de las hojas y separador de tela, diseño editorial sobrio sin título ni letras en la portada |
| 12 | `atril-exposicion.png` | `servicios` | Atril escolar de mesa o pie en madera clara y metal gris grafito con hojas en blanco ordenadas sobre la bandeja inclinada |
| 13 | `grabadora-voz.png` | `computo` | Grabadora digital portátil de audio para entrevistas con doble micrófono superior metálico, pantalla oscura apagada y botones geométricos sin etiquetas |
| 14 | `storyboard-guion.png` | `arte` | Carpeta abierta tipo guion gráfico (storyboard) con seis recuadros geométricos vacíos ordenados en cuadrícula y un estilógrafo negro apoyado al costado, sin texto |
| 15 | `camara-video-estudio.png` | `computo` | Videocámara compacta de producción educativa montada sobre tripié pequeño con lente cristalino y pantalla abatible apagada |
| 16 | `claqueta-cine.png` | `arte` | Claqueta de producción audiovisual en acrílico oscuro y madera con barra superior de franjas diagonales blanco y grafito, panel inferior completamente liso sin palabras |
| 17 | `pizarron-esquema.png` | `arte` | Pizarrón blanco magnético de aula con marco de aluminio, borrador y dos plumones en la bandeja, con un diagrama abstracto de tres nodos conectados por flechas sin texto |
| 18 | `revista-editorial.png` | `arte` | Revista o gaceta escolar abierta en doble página con retícula limpia de columnas grises abstractas y recuadros de imagen geométricos, cero letras legibles |

---

### Lote A3 — Educación Física, Deportes, Anatomía y Salud Integral (9)
*Amplía `deportivo` (hoy solo 6 ítems) y `salud` general para Currículum Ampliado y Vida Saludable.*

| # | Archivo (`public/images/materiales/`) | Categoría sugerida | Descripción lista para `{{OBJETO}}` |
|---:|---|---|---|
| 19 | `colchoneta-ejercicio.png` | `deportivo` | Tapete/colchoneta deportiva de espuma de alta densidad en azul marino parcialmente enrollada con correa de sujeción |
| 20 | `bandas-resistencia.png` | `deportivo` | Juego de tres bandas elásticas de resistencia física (verde, azul acero y ocre) enrolladas ordenadamente con manijas ergonómicas |
| 21 | `mancuernas-didacticas.png` | `deportivo` | Par de mancuernas hexagonales recubiertas de neopreno gris grafito y azul marino dispuestas en ángulo limpio, sin números de peso |
| 22 | `silbato-arbitro.png` | `deportivo` | Silbato metálico deportivo cromado con cordón trenzado azul marino enrollado ordenadamente al lado |
| 23 | `oximetro-pulso.png` | `salud` | Oxímetro de pulso digital de pinza para dedo en color blanco y azul técnico con pantalla oscura limpia sin números |
| 24 | `bascula-antropometrica.png` | `salud` | Báscula clínica mecánica de plataforma metálica con columna vertical y barra de contrapeso calibrada (sin números legibles) |
| 25 | `cinta-antropometrica.png` | `salud` | Cinta métrica flexible retráctil de uso clínico/nutricional en carcasa ergonómica blanca y azul con extremo parcialmente extendido sin números |
| 26 | `modelo-anatomico-torso.png` | `salud` | Modelo anatómico escolar didáctico de torso humano desmontable en colores científicos sobrios sobre base blanca limpia (estándar laboratorio escolar) |
| 27 | `plato-buen-comer.png` | `salud` | Maqueta didáctica circular dividida en tres sectores de colores suaves (verde, ocre, terracota) con iconos geométricos minimalistas de verduras, cereales y leguminosas, sin texto |

---

### Lote A4 — Artes, Música, Teatro, Fotografía y Oficios Culturales (9)

| # | Archivo (`public/images/materiales/`) | Categoría sugerida | Descripción lista para `{{OBJETO}}` |
|---:|---|---|---|
| 28 | `guitarra-acustica.png` | `arte` | Guitarra acústica clásica de madera natural clara con diapasón oscuro, seis cuerdas tensas y roseta geométrica sobria, apoyada ligeramente en diagonal |
| 29 | `teclado-musical.png` | `arte` | Teclado electrónico portátil didáctico de 4 octavas con teclas blancas y negras nítidas y panel superior gris minimalista sin etiquetas |
| 30 | `flauta-dulce.png` | `arte` | Flauta dulce soprano escolar de tres piezas en tono marfil y detalles azul grafito, dispuesta en diagonal limpia |
| 31 | `paleta-pinceles.png` | `arte` | Paleta de madera ovalada de pintor con cinco gotas limpias de pigmento (azul, verde, ocre, terracota, blanco) y tres pinceles de distinto grosor cruzados |
| 32 | `arcilla-escultura.png` | `arte` | Bloque de arcilla terracota moldeable sobre base giratoria pequeña acompañado de tres estecas de madera y un cortador de alambre |
| 33 | `mascara-teatro.png` | `arte` | Máscara teatral neutra de estudio en yeso blanco mate con rasgos sobrios clásicos sobre soporte de madera, estilo taller de actuación |
| 34 | `telar-artesanal.png` | `arte` | Telar escolar de bastidor en madera natural con hilos de urdimbre beige y franjas tejidas en azul marino y terracota con lanzadera de madera |
| 35 | `camara-fotografica-reflex.png` | `arte` | Cámara fotográfica réflex digital en negro grafito con lente estándar de vidrio con reflejo azulado, sin marcas ni diales con letras |
| 36 | `metronomo-acustico.png` | `arte` | Metrónomo mecánico piramidal de madera y metal con péndulo central y pesa deslizable, escala frontal con líneas finas sin números |

---

### Lote A5 — Física Avanzada, Electrónica, Robótica y Matemáticas 3.º–6.º Semestre (9)

| # | Archivo (`public/images/materiales/`) | Categoría sugerida | Descripción lista para `{{OBJETO}}` |
|---:|---|---|---|
| 37 | `clinometro-escolar.png` | `matematicas` | Clinómetro didáctico de trigonometría formado por transportador semicircular acrílico, tubo visor metálico y plomada colgante con hilo tenso, sin números |
| 38 | `modelo-conicas-3d.png` | `matematicas` | Cono geométrico didáctico desmontable en acrílico translúcido y madera mostrando cortes planos de círculo, elipse, parábola e hipérbola |
| 39 | `dinamometro-resorte.png` | `fisica` | Dinamómetro tubular transparente de laboratorio con resorte metálico visible, gancho inferior de acero y marcas finas de escala sin números |
| 40 | `polea-doble.png` | `fisica` | Sistema didáctico de polea fija y polea móvil en marco metálico azul acero con cuerda trenzada y pequeña masa cilíndrica suspendida |
| 41 | `juego-pesas-calibradas.png` | `fisica` | Estuche de madera abierto con juego escalonado de pesas cilíndricas calibradas de latón pulido y pinza metálica, sin números grabados |
| 42 | `diapason-acustico.png` | `fisica` | Diapasón metálico de acero montado sobre caja de resonancia rectangular de madera clara junto a un mazo pequeño con punta de goma |
| 43 | `protoboard-electronica.png` | `fisica` | Tablilla de pruebas (protoboard) blanca con líneas de alimentación azul y roja, tres cables puente curvos, dos resistencias y un LED insertados ordenadamente |
| 44 | `servomotor-robotica.png` | `computo` | Micro servomotor de robótica educativa en carcasa azul marino con brazo cruceta blanco, engranes visibles y cable plano de tres hilos |
| 45 | `electroscopio.png` | `fisica` | Electroscopio didáctico de matraz de vidrio con esfera colectora metálica superior, varilla conductora y dos laminillas doradas internas |

---

### Lote A6 — Metrología, Construcción, Carpintería, HVAC y Energías Renovables (9)
*Cubre carreras BT con menos cobertura hoy (`energia`: 4, `construccion`: 5, `industrial`: 8).*

| # | Archivo (`public/images/materiales/`) | Categoría sugerida | Descripción lista para `{{OBJETO}}` |
|---:|---|---|---|
| 46 | `calibrador-vernier.png` | `medicion` | Calibrador pie de rey (Vernier) de acero inoxidable con mordazas de exteriores/interiores y varilla de profundidad, marcas graduadas finas sin números |
| 47 | `micrometro-exterior.png` | `medicion` | Micrómetro de exteriores en arco azul acero con husillo cromado, tambor moleteado y trinquete de precisión, sin dígitos |
| 48 | `flexometro-metalico.png` | `herramientas` | Flexómetro profesional de carcasa grafito y ocre con cinta metálica amarilla parcialmente extendida con rayas de graduación sin números |
| 49 | `plomada-construccion.png` | `construccion` | Plomada cónica metálica de latón para albañilería enrollada con hilo blanco en su carrete separador de madera |
| 50 | `cuchara-albanil.png` | `construccion` | Cuchara de albañil de hoja triangular de acero templado con cuello curvo y mango torneado de madera natural |
| 51 | `prensa-carpintero.png` | `herramientas` | Prensa tipo sargento (prensa C o de barra) en acero azulado con husillo roscado y mango de madera para carpintería |
| 52 | `manometro-refrigeracion.png` | `industrial` | Juego de manómetros (manifold) para refrigeración y aire acondicionado con dos carátulas (azul baja / rojo alta) sin números, válvulas metálicas y mangueras técnicas |
| 53 | `aerogenerador-didactico.png` | `energia` | Maqueta funcional de aerogenerador escolar de tres aspas aerodinámicas blancas sobre torre metálica con base de bornes eléctricos |
| 54 | `calentador-solar.png` | `energia` | Modelo a escala de calentador solar de agua con tubos evacuados de vidrio azul oscuro inclinados y termotanque cilíndrico de acero inoxidable |

---

### Lote A7 — Agropecuario, Apicultura, Recursos Hídricos, Forestal y Biotecnología (9)

| # | Archivo (`public/images/materiales/`) | Categoría sugerida | Descripción lista para `{{OBJETO}}` |
|---:|---|---|---|
| 55 | `colmena-apicola.png` | `agro` | Colmena didáctica tipo Langstroth de madera natural con techo metálico inclinado y un bastidor con panal geométrico parcialmente levantado |
| 56 | `ahumador-apicola.png` | `agro` | Ahumador apícola de acero inoxidable con boquilla cónica y fuelle lateral de madera y cuero azulado |
| 57 | `pluviometro.png` | `agro` | Pluviómetro escolar transparente cilíndrico con embudo colector superior, soporte de montaje y graduación de líneas sin números |
| 58 | `anemometro.png` | `medicion` | Anemómetro meteorológico de tres cazoletas semiesféricas sobre mástil metálico compacto con base estable |
| 59 | `estacion-meteorologica.png` | `agro` | Estación meteorológica escolar compacta en trípode con veleta, sensor de radiación, pluviómetro y pequeño panel fotovoltaico integrado |
| 60 | `micropipeta-automatica.png` | `laboratorio_bio` | Micropipeta automática de laboratorio en cuerpo blanco y azul técnico con punta desechable translúcida y émbolo superior, sin números |
| 61 | `espectrofotometro.png` | `laboratorio_quimica` | Espectrofotómetro compacto de mesa para laboratorio escolar con compartimento para cubetas, pantalla apagada y teclado geométrico sin letras |
| 62 | `termociclador-pcr.png` | `laboratorio_bio` | Termociclador compacto de laboratorio de biotecnología con tapa térmica abatible y bloque interno con matriz de microtubos |
| 63 | `compostero-escolar.png` | `agro` | Compostero doméstico/escolar de madera ventilada con compuerta inferior abierta mostrando tierra fértil oscura y capas de materia orgánica |

---

### Lote A8 — Administración, Contabilidad, Logística, Topografía, Turismo y TI/Redes (9)

| # | Archivo (`public/images/materiales/`) | Categoría sugerida | Descripción lista para `{{OBJETO}}` |
|---:|---|---|---|
| 64 | `poliza-contable.png` | `ofimatica` | Carpeta contable de archivo con hojas de rayado tabular verde-azul (columnas verticales limpias sin cifras ni palabras) y clip metálico |
| 65 | `tablero-kanban.png` | `ofimatica` | Tablero organizador de proyectos dividido en tres columnas verticales con tarjetas rectangulares de colores suaves (azul, ocre, verde) sin texto |
| 66 | `montacargas-escala.png` | `logistica` | Montacargas logístico compacto en vista tres cuartos con mástil de elevación y horquillas frontales, acabado ocre y gris grafito sin logos |
| 67 | `pallet-logistico.png` | `logistica` | Tarima (pallet) estándar de madera con cuatro cajas de cartón corrugado flejadas ordenadamente encima, sin códigos ni texto |
| 68 | `firewall-red.png` | `computo` | Equipo físico appliance de seguridad de red (firewall) montable en rack de 1U en gris grafito con puertos Ethernet frontales y luces indicadoras discretas |
| 69 | `servidor-rack.png` | `computo` | Gabinete compacto de comunicaciones y servidor con ventilación frontal perforada, bahías de discos y cables de parcheo ordenados en azul |
| 70 | `dron-cartografia.png` | `computo` | Cuadricóptero didáctico de fotogrametría y mapeo en gris grafito y blanco con cámara estabilizada inferior y cuatro hélices plegables |
| 71 | `estacion-total-topografia.png` | `medicion` | Estación total topográfica profesional en tono ocre y grafito montada sobre cabeza de tripié metálico con anteojo óptico central |
| 72 | `kit-barista.png` | `servicios` | Juego de prácticas de cafetería y turismo: jarra de acero inoxidable para espumar, tamper de madera y metal, taza cerámica blanca y termómetro de carátula sin números |

---

## PARTE B — Mejora Opcional de los 16 Materiales Existentes de Baja Densidad (`< 8.2 KB`)

Estos 16 archivos ya existen en `public/images/materiales/`, pero en `docs/inventario-calidad-materiales.md` salieron con peso muy bajo (siluetas planas). Si quieres regenerarlos con el **mismo Prompt Maestro de la Parte A** y sobrescribir el archivo exacto, suben de calidad inmediatamente con **0 cambios de código**:

1. `regla-graduada.png` — Regla técnica escolar transparente de 30 cm en acrílico biselado con marcas milimétricas finas sin números.
2. `borrador-tecnico.png` — Goma de borrar blanca de vinilo técnico para dibujo arquitectónico con funda protectora azul marino sin texto.
3. `poligonos-recortables.png` — Juego ordenado de polígonos geométricos didácticos en acrílico translúcido (triángulo, cuadrado, pentágono, hexágono, octágono).
4. `mosaico-area.png` — Tablero modular de mosaicos cuadrados unitarios en madera y azul acero demostrando área rectangular.
5. `balanza-cocina.png` — Balanza de cocina/laboratorio de platillo superior en acero inoxidable con carátula analógica limpia sin números.
6. `nivel-agua.png` — Nivel de burbuja profesional de aluminio cepillado con tres ampollas verdes fluorescentes suaves (horizontal, vertical y 45°).
7. `tangram.png` — Tangram geométrico didáctico de madera fina en siete piezas ligeramente separadas sobre marco cuadrado en tonos sobrios.
8. `fichas-decimales.png` — Bloques base diez (cubo, placa, barra y unidad) de madera natural y azul técnico dispuestos en escala proporcional.
9. `bateria-plomo.png` — Batería recargable de 12V de ciclo profundo en carcasa gris grafito con bornes metálicos positivo (rojo) y negativo (negro) sin etiquetas.
10. `estanteria-almacen.png` — Anaquel industrial metálico de tres niveles con cajas organizadoras grises y azules dispuestas ordenadamente.
11. `tuberia-pvc.png` — Ensamble didáctico de tubería hidráulica de PVC blanca con codo de 90°, conector T y llave de paso azul.
12. `kit-tincion.png` — Gradilla compacta de laboratorio con cuatro frascos gotero ámbar de reactivos de tinción, portaobjetos y pinza metálica, sin etiquetas.
13. `tarjetas-numeradas.png` — Mazo ordenado de tarjetas didácticas en abanico con puntos geométricos proporcionales estilo dominó sobre cartulina cálida, sin cifras escritas.
14. `libro-digital.png` — Lector electrónico (e-reader) de tinta electrónica en marco grafito delgado con retícula abstracta de párrafos grises, sin letras legibles.
15. `cable-banana.png` — Par de cables de prueba de laboratorio (rojo y negro) enrollados ordenadamente con conectores tipo banana apilables de latón.
16. `lector-codigo-barras.png` — Escáner ergonómico de mano para logística en gris grafito sobre base de carga, emitiendo una delgada línea luminosa roja sin etiquetas.

---

## PARTE C — Actualización Opcional de Escenas con Personas → "Aplicación Real del Conocimiento" (Estilo Editorial Realista SIN Caricatura)

Si en las 68 escenas `.webp` actuales (`public/images/escenas/<domain_id>/`) deseas sustituir aquellas donde los personajes se ven tipo cómic escolar (por ejemplo `mat-01-portada.webp`, `lit-01-portada.webp`, `his-01-portada.webp`, `fil-01-portada.webp`, `soc-01-portada.webp`), **NO necesitas cambiar ningún nombre de archivo ni tocar código**.

Usa este **Prompt Maestro V2 (Fotografía Editorial Realista / Enfoque en Aplicación y Herramientas)** — elimina completamente los contornos negros tipo historieta y enfoca la imagen en **la aplicación tangible del conocimiento** (mesas de trabajo reales, instrumentos en uso, manos reales en primer plano opcional o espacios reales sin rostros caricaturescos):

### Prompt Maestro V2 — Escenas Realistas de Aplicación (copiar y sustituir `{{ESCENA}}` y `{{FORMATO}}`)

```text
Fotografía editorial documental de alta gama para libro de texto universitario y de bachillerato moderno (estándar National Geographic Education / Pearson / Oxford University Press).

ESCENA: {{ESCENA}}
FORMATO Y PROPORCIÓN: {{FORMATO}}
ESTILO VISUAL: fotografía real con cámara full-frame (lente 50mm f/2.8), iluminación natural lateral suave, texturas auténticas (madera, acero, papel algodón, vidrio, cerámica, concreto), profundidad de campo editorial limpia, colorimetría sobria y realista (tonos cálidos naturales, azul marino, verde bosque, grafito).
COMPOSICIÓN: sujeto principal nítido mostrando aplicación práctica del conocimiento en un entorno real de aula, laboratorio, taller o comunidad mexicana contemporánea; 25–35% de espacio negativo despejado (pared clara, mesa limpia o cielo suave) en la zona superior o izquierda para tipografía editorial.
ENFOQUE HUMANO (si aplica): solo manos reales trabajando con instrumentos o planos abiertos, o personas vistas a media distancia/de espaldas trabajando con naturalidad; NUNCA ilustraciones caricaturescas ni poses artificiales de stock.
PROHIBIDO: absolutamente CERO estilo cómic, CERO contornos negros dibujados, CERO dibujos animados, CERO texto legible, CERO letras, CERO números, CERO fórmulas escritas, CERO logotipos o marcas comerciales, CERO marcas de agua, CERO filtros neón o futuristas.
```

### Ejemplos listos de reemplazo directo (prioritarios donde el cómic se nota más)

| Archivo exacto a reemplazar (misma ruta) | Formato | `{{ESCENA}}` orientada a aplicación real |
|---|---|---|
| `pensamiento_matematico/mat-01-portada.webp` | `16:9 (1600×900)` | Primer plano editorial sobre mesa de arquitectura con maqueta estructural de madera a escala, cinta métrica metálica desplegada, escuadra acrílica, compás de precisión y papel milimétrico limpio bajo luz solar lateral proyectando sombras geométricas reales |
| `lengua_comunicacion_literatura/lit-01-portada.webp` | `16:9 (1600×900)` | Mesa de madera en biblioteca moderna luminosa con libros abiertos de páginas en papel algodón, libreta de notas con pluma fuente metálica, marcadores de tela y estanterías desenfocadas suavemente al fondo; tercio izquierdo despejado |
| `conciencia_historica_ciencias_sociales/his-01-portada.webp` | `16:9 (1600×900)` | Mesa de archivo documental con mapas topográficos antiguos desplegados sin texto legible, lupa de latón, guantes blancos de conservación, brújula clásica y expedientes de papel kraft bajo luz natural de ventana |
| `humanidades_filosofia_logica_etica/fil-01-portada.webp` | `16:9 (1600×900)` | Sala de lectura sobria en piedra clara y madera con un volumen empastado abierto, reloj de arena de vidrio sobre escritorio limpio y luz natural de tarde proyectada en diagonal sobre muro claro |
| `cultura_digital_programacion_ti/tic-01-portada.webp` | `16:9 (1600×900)` | Estación de trabajo de ingeniería real con placa microcontroladora conectada a sensores en protoboard, laptop metálica abierta en ángulo mostrando bloques de interfaz abstractos sin texto legible, cables ordenados y luz natural lateral |
| `ciencias_fisica_ingenieria/fis-01-portada.webp` | `16:9 (1600×900)` | Banco real de laboratorio de física con plano inclinado de aluminio cepillado, esfera de acero, polea metálica con pesas de latón calibradas y cronómetro analógico sobre cubierta oscura limpia frente a muro blanco luminoso |
| `lengua_extranjera_ingles/eng-01-portada.webp` | `16:9 (1600×900)` | Escritorio editorial contemporáneo con audífonos profesionales de estudio, micrófono de condensador compacto sobre base metálica, globo terráqueo minimalista en tonos neutros y cuaderno abierto en blanco |
| `socioemocional_tutoria_educacion_integral/soc-01-portada.webp` | `16:9 (1600×900)` | Patio escolar contemporáneo mexicano luminoso con banca de madera y jardineras verdes en calma, libreta de proyecto comunitario abierta junto a una brújula y taza de cerámica artesanal bajo luz suave de mañana |

> **Consejo práctico:** No necesitas rehacer las 68 escenas de golpe. Empieza generando los lotes de **Parte A** que correspondan a las materias que más estás produciendo ahora (por ejemplo A1 Humanidades/Historia, A2 Lengua, A3 Salud/Deportes y A5 Matemáticas/Física), y reemplaza solo las portadas de **Parte C** que al ver el PDF real te parezcan demasiado caricaturescas.
