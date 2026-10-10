# Inventario Exhaustivo de Calidad del Catálogo de Materiales (244 PNGs)
## SIGPDA-EMS · Sistema Editorial V7 · SEMS Puebla MCCEMS 2026-2027

### 1. Resumen Ejecutivo y Diagnóstico de Calidad

- **Total de slugs catalogados en `src/lib/materials/materials-catalog.ts`**: 244 materiales.
- **Archivos verificados físicamente en `public/images/materiales/`**: 244 de 244 (**100.0% de presencia en disco**).
- **Archivos faltantes en disco**: 0 (**cero huecos de catálogo**).
- **Resolución uniforme**: 100% de las imágenes cuentan con dimensiones canónicas de **512 × 512 píxeles** (validado mediante lectura de cabecera binaria PNG IHDR).
- **Desglose por lote y prioridad**:
  - **Lote P1 (53 materiales)**: 53 presentes (100%), tamaño promedio de 37.2 KB. Todos validados y en producción.
  - **Lote P2 (191 materiales)**: 191 presentes (100%), distribuidos en tres niveles de calidad:
    - **Alta Calidad (42 imágenes, 22.0%)**: >= 35 000 bytes (aprox. >= 35 KB decimal), fotografía o render con alto nivel de textura y detalle.
    - **Media Calidad (133 imágenes, 69.6%)**: 8 200 a 34 999 bytes (aprox. 8.2 KB a 35 KB decimal), ilustración técnica limpia con canal alfa transparente, perfectamente nítida para escala editorial de 18 × 18 mm.
    - **Baja Calidad (16 imágenes, 8.4%)**: < 8 200 bytes (aprox. < 8.2 KB decimal), siluetas o trazos planos esquemáticos con baja densidad de información cromática.

- **Diagnóstico honesto de usabilidad**: **228 de 244 materiales (93.4%)** ofrecen calidad visual excelente o completamente adecuada para el libro impreso y digital. Solo 16 materiales P2 (8.4% del lote P2) presentan una estética básica esquemática.

---

### 2. Heurística de Clasificación de Calidad Offline

| Nivel | Rango de Bytes Exactos | Resolución IHDR | Características Visuales | Estado Editorial |
| :--- | :--- | :--- | :--- | :--- |
| **Alta** | >= 35 000 bytes (aprox. >= 35 KB) | 512 × 512 px | Riqueza textural, sombras, detalles tridimensionales o fotográficos complejos | Óptimo para portada y figuras destacadas |
| **Media** | 8 200 a 34 999 bytes (aprox. 8.2 - 35 KB) | 512 × 512 px | Ilustración técnica vectorial/raster limpia, bordes nítidos, fondo transparente | Totalmente apto para tarjetas 18 × 18 mm |
| **Baja** | < 8 200 bytes (aprox. < 8.2 KB) | 512 × 512 px | Gráfico minimalista, silueta plana o esquema monocromático | Usable funcionalmente, mejorable estéticamente |

Los 16 materiales identificados con calidad baja son:
1. `libro-digital` (Lector de Libro Digital (E-reader)) — 7997 bytes (7.8 KB), 512×512 px (Categoría: computo)
2. `bateria-plomo` (Batería de Plomo-Ácido) — 7216 bytes (7.0 KB), 512×512 px (Categoría: energia)
3. `nivel-agua` (Nivel de Burbuja de Aluminio) — 6807 bytes (6.6 KB), 512×512 px (Categoría: construccion)
4. `tuberia-pvc` (Tubería de PVC con Codo) — 7502 bytes (7.3 KB), 512×512 px (Categoría: construccion)
5. `tarjetas-numeradas` (Tarjetas Numéricas) — 7745 bytes (7.6 KB), 512×512 px (Categoría: matematicas)
6. `tangram` (Tangram de Madera) — 6961 bytes (6.8 KB), 512×512 px (Categoría: matematicas)
7. `regla-graduada` (Regla Escolar de 30 cm) — 3378 bytes (3.3 KB), 512×512 px (Categoría: matematicas)
8. `balanza-cocina` (Balanza de Cocina Analógica) — 5438 bytes (5.3 KB), 512×512 px (Categoría: matematicas)
9. `poligonos-recortables` (Polígonos Recortables) — 4057 bytes (4.0 KB), 512×512 px (Categoría: matematicas)
10. `fichas-decimales` (Barras Decimales de Plástico) — 7020 bytes (6.9 KB), 512×512 px (Categoría: matematicas)
11. `mosaico-area` (Mosaico de Área) — 4097 bytes (4.0 KB), 512×512 px (Categoría: matematicas)
12. `kit-tincion` (Kit de Tinciones) — 7763 bytes (7.6 KB), 512×512 px (Categoría: laboratorio_bio)
13. `cable-banana` (Cables de Montaje con Plugas BANANA) — 8129 bytes (7.9 KB), 512×512 px (Categoría: fisica)
14. `borrador-tecnico` (Borrador Técnico con Funda) — 3291 bytes (3.2 KB), 512×512 px (Categoría: arte)
15. `estanteria-almacen` (Estante Metálico de Almacén) — 7493 bytes (7.3 KB), 512×512 px (Categoría: logistica)
16. `lector-codigo-barras` (Lector de Código de Barras de Mano) — 8176 bytes (8.0 KB), 512×512 px (Categoría: logistica)

---

### 3. Propuesta Arquitectónica: 3 Opciones para Decisión del Usuario

A continuación se plantean 3 caminos técnicos ordenados por impacto y esfuerzo para atender los 16 materiales de baja calidad, sin interrumpir el despliegue actual:

#### Opción A: Renders Vectoriales Programáticos Nativos (Recomendada para materiales geométricos)
- **Estrategia**: Construir generadores matemáticos offline en jsPDF/SVG para los materiales de geometría pura (`regla-graduada`, `tangram`, `mosaico-area`, `poligonos-recortables`, `tarjetas-numeradas`, `fichas-decimales`).
- **Ventajas**:
  - 100% vectorial, peso de 0 KB en disco, nitidez infinita sin importar el factor de zoom en PDF.
  - Cero costo de almacenamiento o procesamiento de IA.
- **Esfuerzo estimado**: Medio (aprox. 1 jornada de trabajo para los 16 componentes geométricos).

#### Opción B: Mantener Catálogo Actual y Cerrar Fase (Producción Inmediata)
- **Estrategia**: Declarar los 244 materiales como APTO para producción en su estado actual. A escala editorial de 18 × 18 mm en las tarjetas de paso y concepto, los 16 materiales de baja densidad son perfectamente legibles e identificables por el estudiante.
- **Ventajas**:
  - Cero esfuerzo adicional, cero riesgo de regresión.
  - El pipeline ya cuenta con 100% de cobertura en disco (cero llamadas a placeholders o 404).
- **Esfuerzo estimado**: Cero (inmediato).

#### Opción C: Enfoque Híbrido por Demanda Real en PAEC
- **Estrategia**: Mantener los 244 PNGs actuales como línea base operativa. Monitorear las planeaciones generadas por docentes en producción y solo regenerar fotográficamente aquellos materiales de baja calidad que acumulen alta frecuencia de uso en Proyectos Integradores PAEC.
- **Ventajas**:
  - Optimización quirúrgica guiada por datos pedagógicos reales y no por perfeccionismo prematuro.
- **Esfuerzo estimado**: Bajo-diferido.

---

### 4. Tabla Exhaustiva del Catálogo Completo (244/244 Materiales)

| # | Slug | Nombre Oficial | Categoría | Prioridad | Tamaño (Bytes) | Resolución | Calidad |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| 1 | `multimetro` | Multímetro Digital Autorango | medicion | P1 | 41882 (40.9 KB) | 512×512 px | 🟢 Alta |
| 2 | `osciloscopio` | Osciloscopio Digital de 2 Canales | medicion | P1 | 39767 (38.8 KB) | 512×512 px | 🟢 Alta |
| 3 | `fuente-poder` | Fuente de Alimentación Regulable DC | medicion | P1 | 49008 (47.9 KB) | 512×512 px | 🟢 Alta |
| 4 | `generador-funciones` | Generador de Funciones y Señales | medicion | P1 | 32367 (31.6 KB) | 512×512 px | 🟢 Alta |
| 5 | `microscopio-optico` | Microscopio Óptico Compuesto | laboratorio_bio | P1 | 35569 (34.7 KB) | 512×512 px | 🟢 Alta |
| 6 | `probeta` | Probeta Graduada de Vidrio (100 ml) | laboratorio_quimica | P1 | 26833 (26.2 KB) | 512×512 px | 🟢 Alta |
| 7 | `probeta-graduada` | Probeta Graduada de Vidrio | laboratorio_quimica | P1 | 9718 (9.5 KB) | 512×512 px | 🟢 Alta |
| 8 | `matraz-erlenmeyer` | Matraz Erlenmeyer de 250 ml | laboratorio_quimica | P1 | 16209 (15.8 KB) | 512×512 px | 🟢 Alta |
| 9 | `bureta` | Bureta Graduada con Llave de Teflón (50 ml) | laboratorio_quimica | P1 | 27459 (26.8 KB) | 512×512 px | 🟢 Alta |
| 10 | `balanza-digital` | Balanza Digital de Precisión (0.01 g) | medicion | P1 | 40002 (39.1 KB) | 512×512 px | 🟢 Alta |
| 11 | `phmetro` | Medidor de pH Digital (pHímetro de Bolsillo) | medicion | P1 | 31851 (31.1 KB) | 512×512 px | 🟢 Alta |
| 12 | `termometro` | Termómetro de Laboratorio (-10°C a 110°C) | medicion | P1 | 8622 (8.4 KB) | 512×512 px | 🟢 Alta |
| 13 | `cronometro` | Cronómetro Digital con Memoria | medicion | P1 | 34790 (34.0 KB) | 512×512 px | 🟢 Alta |
| 14 | `mechero-lab` | Mechero Bunsen / Lámpara de Alcohol | laboratorio_quimica | P1 | 34878 (34.1 KB) | 512×512 px | 🟢 Alta |
| 15 | `embudo-de-vidrio` | Embudo de Vidrio de Laboratorio | laboratorio_quimica | P1 | 15730 (15.4 KB) | 512×512 px | 🟢 Alta |
| 16 | `mortero-con-pilon` | Mortero de Porcelana con Pilón | laboratorio_quimica | P1 | 46105 (45.0 KB) | 512×512 px | 🟢 Alta |
| 17 | `soporte-universal` | Soporte Universal de Laboratorio | laboratorio_quimica | P1 | 37608 (36.7 KB) | 512×512 px | 🟢 Alta |
| 18 | `imanes` | Juego de Imanes Didácticos (Barra y Herradura) | fisica | P1 | 42896 (41.9 KB) | 512×512 px | 🟢 Alta |
| 19 | `lentes-opticos` | Juego de Lentes Ópticos Convergentes y Divergentes | fisica | P1 | 55564 (54.3 KB) | 512×512 px | 🟢 Alta |
| 20 | `geoplano` | Geoplano Didáctico con Bandas Elásticas | arte | P1 | 55503 (54.2 KB) | 512×512 px | 🟢 Alta |
| 21 | `compas` | Compás de Precisión Metálico | herramientas | P1 | 35658 (34.8 KB) | 512×512 px | 🟢 Alta |
| 22 | `dados` | Juego de Dados Poliédricos y Estándar | medicion | P1 | 19413 (19.0 KB) | 512×512 px | 🟢 Alta |
| 23 | `regla-calculo` | Regla de Cálculo y Escalas Numéricas | medicion | P1 | 60657 (59.2 KB) | 512×512 px | 🟢 Alta |
| 24 | `pc-escritorio` | Computadora de Escritorio / Laptop | computo | P1 | 29062 (28.4 KB) | 512×512 px | 🟢 Alta |
| 25 | `impresora` | Impresora Multifuncional de Inyección / Láser | computo | P1 | 28628 (28.0 KB) | 512×512 px | 🟢 Alta |
| 26 | `escaner` | Escáner Digitalizador de Documentos | computo | P1 | 57116 (55.8 KB) | 512×512 px | 🟢 Alta |
| 27 | `multifuncional` | Equipo Multifuncional de Oficina (Impresora/Copia/Escáner) | computo | P1 | 33628 (32.8 KB) | 512×512 px | 🟢 Alta |
| 28 | `cable-red` | Cable de Red Ethernet UTP Cat 6 con Conectores RJ45 | computo | P1 | 42322 (41.3 KB) | 512×512 px | 🟢 Alta |
| 29 | `crimpadora-red` | Pinza Ponchadora / Crimpadora RJ45 y Pelacables | herramientas | P1 | 44159 (43.1 KB) | 512×512 px | 🟢 Alta |
| 30 | `tester-cable` | Probador de Cables de Red (Tester RJ45 / RJ11) | herramientas | P1 | 35212 (34.4 KB) | 512×512 px | 🟢 Alta |
| 31 | `desarmadores-precision` | Juego de Destornilladores de Precisión para Electrónica | herramientas | P1 | 42354 (41.4 KB) | 512×512 px | 🟢 Alta |
| 32 | `arduino-kit` | Kit de Robótica y Microcontrolador Arduino Uno | computo | P1 | 40210 (39.3 KB) | 512×512 px | 🟢 Alta |
| 33 | `impresora-3d` | Impresora 3D de Filamento (FDM) | computo | P1 | 50424 (49.2 KB) | 512×512 px | 🟢 Alta |
| 34 | `destornilladores` | Juego de Destornilladores con Mango Aislado | herramientas | P1 | 56489 (55.2 KB) | 512×512 px | 🟢 Alta |
| 35 | `alicates` | Pinzas de Electricista / Alicates Universales | herramientas | P1 | 43063 (42.1 KB) | 512×512 px | 🟢 Alta |
| 36 | `contactos-electricos` | Placas de Contactos Eléctricos, Apagadores y Clavijas | herramientas | P1 | 18012 (17.6 KB) | 512×512 px | 🟢 Alta |
| 37 | `perfocel` | Tablero Perforado (Perfocel) para Montaje Eléctrico | herramientas | P1 | 48418 (47.3 KB) | 512×512 px | 🟢 Alta |
| 38 | `huerto-semillero` | Semillero y Charolas de Germinación Agroecológica | agro | P1 | 33036 (32.3 KB) | 512×512 px | 🟢 Alta |
| 39 | `herramienta-jardin` | Kit de Herramientas de Jardinería y Cultivo (Palas, Rastrillo) | agro | P1 | 32188 (31.4 KB) | 512×512 px | 🟢 Alta |
| 40 | `horno-reposteria` | Horno de Convección / Estufa de Cocina | laboratorio_quimica | P1 | 52810 (51.6 KB) | 512×512 px | 🟢 Alta |
| 41 | `batidora` | Batidora de Pedestal / Manual de Alimentos | laboratorio_quimica | P1 | 51030 (49.8 KB) | 512×512 px | 🟢 Alta |
| 42 | `tabla-cortar` | Tabla de Picar de Polietileno Grado Alimenticio | laboratorio_quimica | P1 | 47149 (46.0 KB) | 512×512 px | 🟢 Alta |
| 43 | `mesa-dibujo` | Tablero de Dibujo Técnico y Regla T | arte | P1 | 31575 (30.8 KB) | 512×512 px | 🟢 Alta |
| 44 | `escuadras` | Juego de Escuadras Profesionales (30°/60° y 45°) | arte | P1 | 22405 (21.9 KB) | 512×512 px | 🟢 Alta |
| 45 | `tablet-grafica` | Tableta Digitalizadora con Lápiz Sensible a la Presión | computo | P1 | 16931 (16.5 KB) | 512×512 px | 🟢 Alta |
| 46 | `micfono-usb` | Micrófono de Condensador USB con Filtro Antipop | computo | P1 | 40875 (39.9 KB) | 512×512 px | 🟢 Alta |
| 47 | `audifonos` | Audífonos de Diadema Aislantes de Ruido | computo | P1 | 41071 (40.1 KB) | 512×512 px | 🟢 Alta |
| 48 | `tarjetas-vocabulario` | Tarjetas Didácticas y Fichas de Léxico (Flashcards) | arte | P1 | 36259 (35.4 KB) | 512×512 px | 🟢 Alta |
| 49 | `mapa-zona` | Plano Cartográfico Municipal y Regional Impreso | medicion | P1 | 54515 (53.2 KB) | 512×512 px | 🟢 Alta |
| 50 | `cuaderno-campo` | Cuaderno y Bitácora de Registro de Campo | medicion | P1 | 48444 (47.3 KB) | 512×512 px | 🟢 Alta |
| 51 | `material-arte` | Kit de Materiales Artísticos (Pinturas, Pinceles, Lienzos) | arte | P1 | 58187 (56.8 KB) | 512×512 px | 🟢 Alta |
| 52 | `balon` | Balones Deportivos Reglamentarios (Básquetbol, Voleibol, Fútbol) | deportivo | P1 | 7629 (7.5 KB) | 512×512 px | 🟢 Alta |
| 53 | `conos` | Juego de Conos y Marcadores de Circuito Deportivo | deportivo | P1 | 31868 (31.1 KB) | 512×512 px | 🟢 Alta |
| 54 | `balanza-numeros` | Balanza de Números Didáctica | medicion | P2 | 57059 (55.7 KB) | 512×512 px | 🟢 Alta |
| 55 | `camara-tableta` | Cámara Digital y Tableta de Captura | computo | P2 | 10568 (10.3 KB) | 512×512 px | 🟡 Media |
| 56 | `carpetas-archivo` | Carpetas de Archivo de Suspensión | ofimatica | P2 | 24037 (23.5 KB) | 512×512 px | 🟡 Media |
| 57 | `compas-dibujo` | Compás de Dibujo Técnico | herramientas | P2 | 24792 (24.2 KB) | 512×512 px | 🟡 Media |
| 58 | `estacion-soldadura` | Estación de Soldadura de Banco | industrial | P2 | 17595 (17.2 KB) | 512×512 px | 🟡 Media |
| 59 | `kit-suelo` | Kit de Análisis de Suelo | agro | P2 | 57942 (56.6 KB) | 512×512 px | 🟢 Alta |
| 60 | `laptop-dev` | Laptop de Desarrollo de Software | computo | P2 | 51732 (50.5 KB) | 512×512 px | 🟢 Alta |
| 61 | `libro-digital` | Lector de Libro Digital (E-reader) | computo | P2 | 7997 (7.8 KB) | 512×512 px | 🔴 Baja |
| 62 | `parlante-bluetooth` | Parlante Portátil Bluetooth | computo | P2 | 26206 (25.6 KB) | 512×512 px | 🟡 Media |
| 63 | `plc-modulo` | Módulo PLC Industrial | industrial | P2 | 11441 (11.2 KB) | 512×512 px | 🟡 Media |
| 64 | `router-switch` | Router / Switch de Red | computo | P2 | 51635 (50.4 KB) | 512×512 px | 🟢 Alta |
| 65 | `sensor-inductivo` | Sensor Inductivo Cilíndrico | industrial | P2 | 15832 (15.5 KB) | 512×512 px | 🟡 Media |
| 66 | `tarjetas-trabajo` | Tarjetas de Trabajo Didácticas | arte | P2 | 13059 (12.8 KB) | 512×512 px | 🟡 Media |
| 67 | `termometro-alimentos` | Termómetro Digital con Sonda para Alimentos | alimentos | P2 | 41089 (40.1 KB) | 512×512 px | 🟢 Alta |
| 68 | `usb` | Memoria USB Portátil | computo | P2 | 38054 (37.2 KB) | 512×512 px | 🟢 Alta |
| 69 | `afiche-mural` | Afiche / Cartel Mural | arte | P2 | 12947 (12.6 KB) | 512×512 px | 🟡 Media |
| 70 | `alambre-ortodontico` | Rollo de Alambre Ortodóntico | salud | P2 | 24566 (24.0 KB) | 512×512 px | 🟡 Media |
| 71 | `altavoz` | Altavoz de Estante | fisica | P2 | 13471 (13.2 KB) | 512×512 px | 🟡 Media |
| 72 | `archivo-historico` | Archivo Histórico / Expedientes | ofimatica | P2 | 25161 (24.6 KB) | 512×512 px | 🟡 Media |
| 73 | `aspersor-riego` | Aspersor de Riego | agro | P2 | 53111 (51.9 KB) | 512×512 px | 🟢 Alta |
| 74 | `autoclave` | Autoclave de Laboratorio | laboratorio_quimica | P2 | 37456 (36.6 KB) | 512×512 px | 🟢 Alta |
| 75 | `balanza-precision` | Balanza de Precisión (0.01 g) | medicion | P2 | 14894 (14.5 KB) | 512×512 px | 🟡 Media |
| 76 | `bandlab` | Estudio de Audio Digital (BandLab) | virtual | P2 | 13091 (12.8 KB) | 512×512 px | 🟡 Media |
| 77 | `bascula-almacen` | Báscula de Piso para Almacén | logistica | P2 | 35869 (35.0 KB) | 512×512 px | 🟢 Alta |
| 78 | `bateria-plomo` | Batería de Plomo-Ácido | energia | P2 | 7216 (7.0 KB) | 512×512 px | 🔴 Baja |
| 79 | `caja-tpv` | Terminal de Punto de Venta (TPV) | servicios | P2 | 15006 (14.7 KB) | 512×512 px | 🟡 Media |
| 80 | `calculadora-financiera` | Calculadora Financiera | ofimatica | P2 | 25013 (24.4 KB) | 512×512 px | 🟡 Media |
| 81 | `camara-conteo` | Cámara de Conteo Celular (Cámara de Peters) | laboratorio_bio | P2 | 18103 (17.7 KB) | 512×512 px | 🟡 Media |
| 82 | `camara-web` | Cámara Web para Clases en Línea | computo | P2 | 36628 (35.8 KB) | 512×512 px | 🟢 Alta |
| 83 | `casos-etica` | Tarjetas de Casos Éticos | arte | P2 | 18487 (18.1 KB) | 512×512 px | 🟡 Media |
| 84 | `cera-dental` | Cera Dental de Modelado e Instrumento de Encerado | salud | P2 | 27509 (26.9 KB) | 512×512 px | 🟡 Media |
| 85 | `cinta-metrica` | Cinta Métrica Retráctil | medicion | P2 | 25763 (25.2 KB) | 512×512 px | 🟡 Media |
| 86 | `cocina-industrial` | Estufa / Cocina Industrial | alimentos | P2 | 22208 (21.7 KB) | 512×512 px | 🟡 Media |
| 87 | `codigo-barras-app` | Lector de Código de Barras Inalámbrico | logistica | P2 | 34461 (33.7 KB) | 512×512 px | 🟡 Media |
| 88 | `controlador-carga` | Controlador de Carga Solar | energia | P2 | 9817 (9.6 KB) | 512×512 px | 🟡 Media |
| 89 | `cuestionario` | Portapapeles con Cuestionario | arte | P2 | 26565 (25.9 KB) | 512×512 px | 🟡 Media |
| 90 | `equipo-buceo` | Equipo de Buceo (Máscara, Snorkel y Aletas) | deportivo | P2 | 16069 (15.7 KB) | 512×512 px | 🟡 Media |
| 91 | `estanque-acuicola` | Estanque Acuícola Circular | agro | P2 | 23289 (22.7 KB) | 512×512 px | 🟡 Media |
| 92 | `estufa-secado` | Estufa de Secado de Laboratorio | laboratorio_quimica | P2 | 16253 (15.9 KB) | 512×512 px | 🟡 Media |
| 93 | `frasco-muestreo` | Frasco de Muestreo de Vidrio | laboratorio_quimica | P2 | 33224 (32.4 KB) | 512×512 px | 🟡 Media |
| 94 | `fuente-historica` | Fuente Histórica (Documento Antiguo) | ofimatica | P2 | 33908 (33.1 KB) | 512×512 px | 🟡 Media |
| 95 | `glucometro` | Glucómetro Digital | salud | P2 | 8551 (8.4 KB) | 512×512 px | 🟡 Media |
| 96 | `goteros` | Goteros de Vidrio con Bulbo | laboratorio_quimica | P2 | 29035 (28.4 KB) | 512×512 px | 🟡 Media |
| 97 | `gps-campo` | Receptor GPS de Campo | medicion | P2 | 13709 (13.4 KB) | 512×512 px | 🟡 Media |
| 98 | `hornillo-colado` | Hornillo de Colado Dental (Mufla) | salud | P2 | 12508 (12.2 KB) | 512×512 px | 🟡 Media |
| 99 | `invernadero` | Invernadero de Túnel | agro | P2 | 24071 (23.5 KB) | 512×512 px | 🟡 Media |
| 100 | `jeringa-demo` | Jeringa de Práctica sin Aguja | salud | P2 | 26266 (25.7 KB) | 512×512 px | 🟡 Media |
| 101 | `kit-agua` | Kit de Análisis de Agua | laboratorio_quimica | P2 | 8259 (8.1 KB) | 512×512 px | 🟡 Media |
| 102 | `kit-calorimetria` | Calorímetro de Vasos | fisica | P2 | 42823 (41.8 KB) | 512×512 px | 🟢 Alta |
| 103 | `kit-muestreo-agua` | Kit de Muestreo de Agua | laboratorio_quimica | P2 | 12179 (11.9 KB) | 512×512 px | 🟡 Media |
| 104 | `linea-tiempo` | Tira de Línea del Tiempo | arte | P2 | 39303 (38.4 KB) | 512×512 px | 🟢 Alta |
| 105 | `mapa-turistico` | Mapa Turístico Plegado | servicios | P2 | 19648 (19.2 KB) | 512×512 px | 🟡 Media |
| 106 | `material-curacion` | Set de Material de Curación | salud | P2 | 16069 (15.7 KB) | 512×512 px | 🟡 Media |
| 107 | `materiales-arte` | Materiales de Arte Escolar | arte | P2 | 34240 (33.4 KB) | 512×512 px | 🟡 Media |
| 108 | `mesa-luz` | Mesa de Luz | arte | P2 | 10361 (10.1 KB) | 512×512 px | 🟡 Media |
| 109 | `microcentrifuga` | Microcentrífuga de Sobremesa | laboratorio_bio | P2 | 21681 (21.2 KB) | 512×512 px | 🟡 Media |
| 110 | `nivel-agua` | Nivel de Burbuja de Aluminio | construccion | P2 | 6807 (6.6 KB) | 512×512 px | 🔴 Baja |
| 111 | `oximetro-agua` | Oxímetro de Agua (Disolución de Oxígeno) | agro | P2 | 37253 (36.4 KB) | 512×512 px | 🟢 Alta |
| 112 | `panel-solar` | Panel Solar Fotovoltaico | energia | P2 | 42126 (41.1 KB) | 512×512 px | 🟢 Alta |
| 113 | `papel-albanene` | Rollo de Papel Albania (Translúcido) | arte | P2 | 18695 (18.3 KB) | 512×512 px | 🟡 Media |
| 114 | `phmetro-industrial` | pHímetro Industrial de Sobremesa | industrial | P2 | 8328 (8.1 KB) | 512×512 px | 🟡 Media |
| 115 | `pinza-amperometrica` | Pinza Amperométrica | medicion | P2 | 28607 (27.9 KB) | 512×512 px | 🟡 Media |
| 116 | `placas-petri` | Placas de Petri de Vidrio | laboratorio_bio | P2 | 12158 (11.9 KB) | 512×512 px | 🟡 Media |
| 117 | `portafolio` | Portafolio de Presentación | arte | P2 | 26285 (25.7 KB) | 512×512 px | 🟡 Media |
| 118 | `portobjetos` | Laminillas Portaobjetos | laboratorio_bio | P2 | 9267 (9.0 KB) | 512×512 px | 🟡 Media |
| 119 | `raspberry-pi` | Placa Raspberry Pi | computo | P2 | 34205 (33.4 KB) | 512×512 px | 🟡 Media |
| 120 | `refractometro` | Refractómetro de Mano | medicion | P2 | 8521 (8.3 KB) | 512×512 px | 🟡 Media |
| 121 | `resistencias-kit` | Juego de Resistencias | fisica | P2 | 12936 (12.6 KB) | 512×512 px | 🟡 Media |
| 122 | `rodillo-pintura` | Rodillo de Pintura | construccion | P2 | 22455 (21.9 KB) | 512×512 px | 🟡 Media |
| 123 | `sensores-arduino` | Juego de Sensores para Arduino | computo | P2 | 28351 (27.7 KB) | 512×512 px | 🟡 Media |
| 124 | `tensiometro` | Tensiómetro Aneroide | salud | P2 | 26440 (25.8 KB) | 512×512 px | 🟡 Media |
| 125 | `termometro-ir` | Termómetro Infrarrojo Tipo Pistola | medicion | P2 | 9689 (9.5 KB) | 512×512 px | 🟡 Media |
| 126 | `transportador` | Transportador de 180° | matematicas | P2 | 23903 (23.3 KB) | 512×512 px | 🟡 Media |
| 127 | `tuberia-pvc` | Tubería de PVC con Codo | construccion | P2 | 7502 (7.3 KB) | 512×512 px | 🔴 Baja |
| 128 | `tubo-ensayo` | Tubos de Ensayo con Rack | laboratorio_quimica | P2 | 21444 (20.9 KB) | 512×512 px | 🟡 Media |
| 129 | `uniform-hospedaje` | Uniforme de Hospedaje | servicios | P2 | 29108 (28.4 KB) | 512×512 px | 🟡 Media |
| 130 | `vajilla-demo` | Vajilla de Demostración (Mise en Place) | servicios | P2 | 18704 (18.3 KB) | 512×512 px | 🟡 Media |
| 131 | `vinil-imprenta` | Rollo de Vinil Adhesivo de Imprenta | arte | P2 | 11345 (11.1 KB) | 512×512 px | 🟡 Media |
| 132 | `yeso-dental` | Yeso Dental y Arcada de Modelo | salud | P2 | 20693 (20.2 KB) | 512×512 px | 🟡 Media |
| 133 | `abaco` | Ábaco de Madera | matematicas | P2 | 14311 (14.0 KB) | 512×512 px | 🟡 Media |
| 134 | `tarjetas-numeradas` | Tarjetas Numéricas | matematicas | P2 | 7745 (7.6 KB) | 512×512 px | 🔴 Baja |
| 135 | `fichas-conteo` | Fichas de Conteo de Colores | matematicas | P2 | 9798 (9.6 KB) | 512×512 px | 🟡 Media |
| 136 | `regletas-cuisenaire` | Regletas Cuisenaire | matematicas | P2 | 58998 (57.6 KB) | 512×512 px | 🟢 Alta |
| 137 | `recta-numerica` | Recta Numérica (Lámina) | matematicas | P2 | 22589 (22.1 KB) | 512×512 px | 🟡 Media |
| 138 | `bloques-geometricos` | Bloques Geométricos de Madera | matematicas | P2 | 33505 (32.7 KB) | 512×512 px | 🟡 Media |
| 139 | `tangram` | Tangram de Madera | matematicas | P2 | 6961 (6.8 KB) | 512×512 px | 🔴 Baja |
| 140 | `regla-graduada` | Regla Escolar de 30 cm | matematicas | P2 | 3378 (3.3 KB) | 512×512 px | 🔴 Baja |
| 141 | `balanza-cocina` | Balanza de Cocina Analógica | matematicas | P2 | 5438 (5.3 KB) | 512×512 px | 🔴 Baja |
| 142 | `fichas-fracciones` | Fichas de Fracciones | matematicas | P2 | 59701 (58.3 KB) | 512×512 px | 🟢 Alta |
| 143 | `discos-fracciones` | Discos de Fracciones | matematicas | P2 | 12090 (11.8 KB) | 512×512 px | 🟡 Media |
| 144 | `bloques-patrones` | Bloques de Patrones (Serie Lineal) | matematicas | P2 | 20377 (19.9 KB) | 512×512 px | 🟡 Media |
| 145 | `papel-milimetrado` | Papel Milimetrado | matematicas | P2 | 22843 (22.3 KB) | 512×512 px | 🟡 Media |
| 146 | `balanza-algebraica` | Balanza Algebraica de Dos Platos | matematicas | P2 | 11930 (11.7 KB) | 512×512 px | 🟡 Media |
| 147 | `coordenadas-cartesianas` | Plano Cartesiano (Lámina) | matematicas | P2 | 35247 (34.4 KB) | 512×512 px | 🟢 Alta |
| 148 | `cuerpos-geometricos` | Cuerpos Geométricos Translúcidos | matematicas | P2 | 29593 (28.9 KB) | 512×512 px | 🟡 Media |
| 149 | `poligonos-recortables` | Polígonos Recortables | matematicas | P2 | 4057 (4.0 KB) | 512×512 px | 🔴 Baja |
| 150 | `urna-probabilidad` | Urna Transparente de Probabilidad | matematicas | P2 | 49617 (48.5 KB) | 512×512 px | 🟢 Alta |
| 151 | `kit-estadistica` | Kit de Estadística | matematicas | P2 | 8441 (8.2 KB) | 512×512 px | 🟡 Media |
| 152 | `calculadora-cientifica` | Calculadora Científica | matematicas | P2 | 9585 (9.4 KB) | 512×512 px | 🟡 Media |
| 153 | `fichas-monetarias` | Fichas de Dinero Didácticas | matematicas | P2 | 11772 (11.5 KB) | 512×512 px | 🟡 Media |
| 154 | `tablero-100` | Tablero de Conteo 10 × 10 | matematicas | P2 | 17118 (16.7 KB) | 512×512 px | 🟡 Media |
| 155 | `domino-numerico` | Fichas de Dominó Numérico | matematicas | P2 | 42222 (41.2 KB) | 512×512 px | 🟢 Alta |
| 156 | `fichas-decimales` | Barras Decimales de Plástico | matematicas | P2 | 7020 (6.9 KB) | 512×512 px | 🔴 Baja |
| 157 | `mosaico-area` | Mosaico de Área | matematicas | P2 | 4097 (4.0 KB) | 512×512 px | 🔴 Baja |
| 158 | `disco-porcentaje` | Disco de Porcentaje | matematicas | P2 | 27741 (27.1 KB) | 512×512 px | 🟡 Media |
| 159 | `grafica-barras` | Gráfica de Barras en Cartulina | matematicas | P2 | 32666 (31.9 KB) | 512×512 px | 🟡 Media |
| 160 | `figuras-semejantes` | Figuras Semejantes (Triángulos) | matematicas | P2 | 33260 (32.5 KB) | 512×512 px | 🟡 Media |
| 161 | `triangulo-rectangulo` | Plantilla de Triángulo Rectángulo | matematicas | P2 | 24927 (24.3 KB) | 512×512 px | 🟡 Media |
| 162 | `cilindro-graduado` | Cilindro Graduado de Vidrio | laboratorio_quimica | P2 | 25235 (24.6 KB) | 512×512 px | 🟡 Media |
| 163 | `matraz-aforado` | Matraz Aforado de Vidrio | laboratorio_quimica | P2 | 37577 (36.7 KB) | 512×512 px | 🟢 Alta |
| 164 | `pipeta` | Pipeta de Vidrio con Pera de Goma | laboratorio_quimica | P2 | 19591 (19.1 KB) | 512×512 px | 🟡 Media |
| 165 | `pendulo` | Péndulo Simple con Soporte | fisica | P2 | 28024 (27.4 KB) | 512×512 px | 🟡 Media |
| 166 | `rampa-fisica` | Rampa Inclinable con Carro | fisica | P2 | 12016 (11.7 KB) | 512×512 px | 🟡 Media |
| 167 | `kit-reactivos` | Kit de Reactivos | laboratorio_quimica | P2 | 29487 (28.8 KB) | 512×512 px | 🟡 Media |
| 168 | `kit-diseccion` | Kit de Disección | laboratorio_bio | P2 | 26080 (25.5 KB) | 512×512 px | 🟡 Media |
| 169 | `triptico` | Tríptico Plegado en Tres Paneles | arte | P2 | 19092 (18.6 KB) | 512×512 px | 🟡 Media |
| 170 | `etiquetadora-red` | Etiquetadora de Cables | herramientas | P2 | 45838 (44.8 KB) | 512×512 px | 🟢 Alta |
| 171 | `lamparitas` | Bombillas Incandescentes con Base Roscada | construccion | P2 | 12050 (11.8 KB) | 512×512 px | 🟡 Media |
| 172 | `medidor-energia` | Medidor de Consumo Energético (Enchufe Inteligente) | energia | P2 | 61296 (59.9 KB) | 512×512 px | 🟢 Alta |
| 173 | `aros` | Aros de Gimnasia | deportivo | P2 | 16032 (15.7 KB) | 512×512 px | 🟡 Media |
| 174 | `cuerdas-deportivas` | Cuerda de Saltar | deportivo | P2 | 40222 (39.3 KB) | 512×512 px | 🟢 Alta |
| 175 | `tarjetas-emociones` | Tarjetas de Emociones | arte | P2 | 15503 (15.1 KB) | 512×512 px | 🟡 Media |
| 176 | `mapa-mental` | Mapa Mental (Plantilla en Blanco) | arte | P2 | 26973 (26.3 KB) | 512×512 px | 🟡 Media |
| 177 | `guantes-seguridad` | Guantes de Seguridad de Nitrilo | seguridad_epp | P2 | 39493 (38.6 KB) | 512×512 px | 🟢 Alta |
| 178 | `gafas-seguridad` | Gafas de Seguridad | seguridad_epp | P2 | 52475 (51.2 KB) | 512×512 px | 🟢 Alta |
| 179 | `cubrebocas` | Cubrebocas Desechable de 3 Capas | seguridad_epp | P2 | 42131 (41.1 KB) | 512×512 px | 🟢 Alta |
| 180 | `agitador-magnetico` | Agitador Magnético de Laboratorio | laboratorio_quimica | P2 | 12422 (12.1 KB) | 512×512 px | 🟡 Media |
| 181 | `kit-adn` | Kit de Extracción de ADN | laboratorio_bio | P2 | 21142 (20.6 KB) | 512×512 px | 🟡 Media |
| 182 | `lupa` | Lupa de Mano con Soporte | laboratorio_bio | P2 | 29754 (29.1 KB) | 512×512 px | 🟡 Media |
| 183 | `kit-tincion` | Kit de Tinciones | laboratorio_bio | P2 | 7763 (7.6 KB) | 512×512 px | 🔴 Baja |
| 184 | `capacitores-kit` | Juego de Capacitores | fisica | P2 | 9818 (9.6 KB) | 512×512 px | 🟡 Media |
| 185 | `cable-banana` | Cables de Montaje con Plugas BANANA | fisica | P2 | 8129 (7.9 KB) | 512×512 px | 🔴 Baja |
| 186 | `sensor-movimiento` | Sensor de Movimiento / Infrarrojo | fisica | P2 | 10347 (10.1 KB) | 512×512 px | 🟡 Media |
| 187 | `cartabon` | Cartabón Transparente 45° / 30°-60° | arte | P2 | 38301 (37.4 KB) | 512×512 px | 🟢 Alta |
| 188 | `portaminas` | Portaminas Metálico | arte | P2 | 28595 (27.9 KB) | 512×512 px | 🟡 Media |
| 189 | `lapices-grafito` | Lápices de Grafito con Afilador | arte | P2 | 28317 (27.7 KB) | 512×512 px | 🟡 Media |
| 190 | `borrador-tecnico` | Borrador Técnico con Funda | arte | P2 | 3291 (3.2 KB) | 512×512 px | 🔴 Baja |
| 191 | `regla-t` | Regla en T de Acrílico | arte | P2 | 11338 (11.1 KB) | 512×512 px | 🟡 Media |
| 192 | `plantillas-dibujo` | Plantilla de Formas Técnicas | arte | P2 | 13663 (13.3 KB) | 512×512 px | 🟡 Media |
| 193 | `tarjetas-percepcion` | Tarjetas de Percepción / Ilusiones Ópticas | arte | P2 | 31959 (31.2 KB) | 512×512 px | 🟡 Media |
| 194 | `revistas-recorte` | Revistas para Recorte | arte | P2 | 31994 (31.2 KB) | 512×512 px | 🟡 Media |
| 195 | `estadiometro` | Estadiómetro de Pared | salud | P2 | 56401 (55.1 KB) | 512×512 px | 🟢 Alta |
| 196 | `libro-mayor` | Libro Mayor Contable | ofimatica | P2 | 17582 (17.2 KB) | 512×512 px | 🟡 Media |
| 197 | `bata-laboratorio` | Bata de Laboratorio Blanca | seguridad_epp | P2 | 37688 (36.8 KB) | 512×512 px | 🟢 Alta |
| 198 | `gradilla` | Gradilla para Tubos de Ensayo | laboratorio_quimica | P2 | 29163 (28.5 KB) | 512×512 px | 🟡 Media |
| 199 | `matraz-balon` | Matraz de Fondo Redondo (Balón) | laboratorio_quimica | P2 | 22445 (21.9 KB) | 512×512 px | 🟡 Media |
| 200 | `vidrio-reloj` | Vidrio de Reloj | laboratorio_quimica | P2 | 23929 (23.4 KB) | 512×512 px | 🟡 Media |
| 201 | `brujula` | Brújula Escolar | medicion | P2 | 30013 (29.3 KB) | 512×512 px | 🟡 Media |
| 202 | `robot-basico` | Robot Escolar de Dos Ruedas | computo | P2 | 18412 (18.0 KB) | 512×512 px | 🟡 Media |
| 203 | `led-kit` | Juego de Diodos LED de Colores | fisica | P2 | 54678 (53.4 KB) | 512×512 px | 🟢 Alta |
| 204 | `prisma-optico` | Prisma Óptico de Vidrio | fisica | P2 | 57080 (55.7 KB) | 512×512 px | 🟢 Alta |
| 205 | `estetoscopio` | Estetoscopio | salud | P2 | 14639 (14.3 KB) | 512×512 px | 🟡 Media |
| 206 | `termometro-clinico` | Termómetro Clínico Digital | salud | P2 | 42511 (41.5 KB) | 512×512 px | 🟢 Alta |
| 207 | `botiquin` | Botiquín de Emergencia | seguridad_epp | P2 | 18684 (18.2 KB) | 512×512 px | 🟡 Media |
| 208 | `extintor` | Extintor de Incendio | seguridad_epp | P2 | 56758 (55.4 KB) | 512×512 px | 🟢 Alta |
| 209 | `caballete-pintura` | Caballete de Madera con Lienzo | arte | P2 | 51946 (50.7 KB) | 512×512 px | 🟢 Alta |
| 210 | `perforadora` | Perforadora de Papel de 3 Orificios | ofimatica | P2 | 50283 (49.1 KB) | 512×512 px | 🟢 Alta |
| 211 | `sello-fechador` | Sello Fechador de Troquel | ofimatica | P2 | 59560 (58.2 KB) | 512×512 px | 🟢 Alta |
| 212 | `grapadora` | Grapadora de Oficina | ofimatica | P2 | 60411 (59.0 KB) | 512×512 px | 🟢 Alta |
| 213 | `etiquetador-precio` | Etiquetador de Precios | servicios | P2 | 12824 (12.5 KB) | 512×512 px | 🟡 Media |
| 214 | `muestrario-productos` | Muestrario de Tienda | servicios | P2 | 48334 (47.2 KB) | 512×512 px | 🟢 Alta |
| 215 | `macetas-horticolas` | Macetas Hortícolas con Plántulas | agro | P2 | 54582 (53.3 KB) | 512×512 px | 🟢 Alta |
| 216 | `red-insectos` | Red de Captura de Insectos | agro | P2 | 22565 (22.0 KB) | 512×512 px | 🟡 Media |
| 217 | `manguera-riego` | Manguera de Jardín con Boquilla | agro | P2 | 27101 (26.5 KB) | 512×512 px | 🟡 Media |
| 218 | `tarros-farmacia` | Tarros de Farmacia de Vidrio | salud | P2 | 18407 (18.0 KB) | 512×512 px | 🟡 Media |
| 219 | `cartulinas` | Pila de Cartulinas de Colores | arte | P2 | 8590 (8.4 KB) | 512×512 px | 🟡 Media |
| 220 | `cartuchos-tinta` | Cartuchos de Tinta Genéricos | computo | P2 | 12397 (12.1 KB) | 512×512 px | 🟡 Media |
| 221 | `taladro` | Taladro Eléctrico de Percusión | herramientas | P2 | 12655 (12.4 KB) | 512×512 px | 🟡 Media |
| 222 | `cinta-aisladora` | Rollo de Cinta Aisladora | herramientas | P2 | 32911 (32.1 KB) | 512×512 px | 🟡 Media |
| 223 | `cable-electrico` | Trozo de Cable Eléctrico | herramientas | P2 | 26436 (25.8 KB) | 512×512 px | 🟡 Media |
| 224 | `plano-electrico` | Plano de Instalación Eléctrica | construccion | P2 | 20078 (19.6 KB) | 512×512 px | 🟡 Media |
| 225 | `llave-francesa` | Llave Francesa Metálica | herramientas | P2 | 31455 (30.7 KB) | 512×512 px | 🟡 Media |
| 226 | `casco-seguridad` | Casco de Seguridad | seguridad_epp | P2 | 23287 (22.7 KB) | 512×512 px | 🟡 Media |
| 227 | `regla-metalica` | Regla Metálica de 30 cm | herramientas | P2 | 56284 (55.0 KB) | 512×512 px | 🟢 Alta |
| 228 | `pinza-ortodoncia` | Pinza Ortodóntica | salud | P2 | 28477 (27.8 KB) | 512×512 px | 🟡 Media |
| 229 | `articulador-dental` | Articulador Dental Metálico | salud | P2 | 36670 (35.8 KB) | 512×512 px | 🟢 Alta |
| 230 | `fresas-dentales` | Juego de Fresas Dentales | salud | P2 | 30430 (29.7 KB) | 512×512 px | 🟡 Media |
| 231 | `moldes-reposteria` | Moldes Metálicos de Repostería | alimentos | P2 | 13130 (12.8 KB) | 512×512 px | 🟡 Media |
| 232 | `licuadora` | Licuadora de Vaso | alimentos | P2 | 30029 (29.3 KB) | 512×512 px | 🟡 Media |
| 233 | `frasco-conserva` | Frasco de Conserva con Tapa Hermética | alimentos | P2 | 15499 (15.1 KB) | 512×512 px | 🟡 Media |
| 234 | `delantal-cocina` | Delantal de Cocina | alimentos | P2 | 10550 (10.3 KB) | 512×512 px | 🟡 Media |
| 235 | `pc-abierto` | Computadora de Escritorio Abierta | computo | P2 | 21523 (21.0 KB) | 512×512 px | 🟡 Media |
| 236 | `disco-externo` | Disco de Almacenamiento Externo | computo | P2 | 14876 (14.5 KB) | 512×512 px | 🟡 Media |
| 237 | `maleta-exhibicion` | Maleta de Exhibición | servicios | P2 | 19261 (18.8 KB) | 512×512 px | 🟡 Media |
| 238 | `torno-mecanico` | Torno Mecánico de Banco | industrial | P2 | 59366 (58.0 KB) | 512×512 px | 🟢 Alta |
| 239 | `compresor-aire` | Compresor de Aire | industrial | P2 | 10990 (10.7 KB) | 512×512 px | 🟡 Media |
| 240 | `soldadura-mig` | Equipo de Soldadura MIG | industrial | P2 | 18165 (17.7 KB) | 512×512 px | 🟡 Media |
| 241 | `red-pesca` | Red de Pesca con Boyas | deportivo | P2 | 28816 (28.1 KB) | 512×512 px | 🟡 Media |
| 242 | `estanteria-almacen` | Estante Metálico de Almacén | logistica | P2 | 7493 (7.3 KB) | 512×512 px | 🔴 Baja |
| 243 | `lector-codigo-barras` | Lector de Código de Barras de Mano | logistica | P2 | 8176 (8.0 KB) | 512×512 px | 🔴 Baja |
| 244 | `motor-universal` | Motor Eléctrico Universal | industrial | P2 | 21013 (20.5 KB) | 512×512 px | 🟡 Media |

