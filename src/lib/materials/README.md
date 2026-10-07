# Repositorio y Catálogo de Materiales para Prácticas Didácticas (v1.0)
**SIGPDA-EMS · Ciclo Escolar 2026-2027 · SEMS Puebla / MCCEMS**

Este módulo proporciona el catálogo normativo tipado, el sistema de resolución de tokens y la gestión de assets ilustrativos para prácticas experimentales, talleres y laboratorios en los libros de texto y planeaciones didácticas de Educación Media Superior.

---

## 1. Sintaxis de Tokens para Textos Didácticos

Para referenciar un material en el cuerpo de una práctica, sesión de laboratorio o proyecto formativo:

```text
[[material:slug]]
[[material:slug|etiqueta visible personalizada]]
```

### Ejemplos:
- Simple: `Para iniciar, encender el [[material:multimetro]] en la escala de 20V.`
- Con etiqueta visible: `Conectar el [[material:multimetro|multímetro digital de 3 dígitos]] a los bornes del circuito.`
- En listas de insumos:
  ```text
  - [ ] [[material:osciloscopio|Osciloscopio digital calibrado]]
  - [ ] [[material:cable-red]]
  - [ ] [[material:contactos-electricos]]
  ```

---

## 2. Decisiones de Arquitectura (D1–D10)

- **D1 — Catálogo en Código**: Implementado en `src/lib/materials/materials-catalog.ts` en TypeScript puro, sin migraciones de base de datos ni endpoints lentos. Versionable con git.
- **D2 — Token Único de Referencia**: Regex normativo `[[material:slug(|etiqueta)?]]`. Sin URLs dispersas ni dependencias de imágenes externas en textos de planeación.
- **D3 — Rutas Derivadas**: Las rutas no se almacenan en disco; se calculan con `getMaterialImagePaths(slug)` apuntando a `/images/materiales/${slug}.png` y `/images/materiales/_placeholder.png`.
- **D4 — Placeholder Determinista Offline**:
  - En UI: componente React inline SVG (cero llamadas de red).
  - En PDF y DOCX: asset estático `public/images/materiales/_placeholder.png` (512×512 px) mediante `doc.addImage` e `ImageRun`.
- **D5 — Enganche en Puntos Existentes**:
  1. `material-extractor.ts`: columnas de inventario (Token, Imagen, EPP, Equivalente Virtual).
  2. `pdf-workbook-renderer.ts`: figuras con pie altText en sección de requerimientos.
  3. `docx-workbook-renderer.ts`: figuras tabulares con `ImageRun`.
  4. UI de planeación: `ExtraPreviewModal` y `MaterialFigure`.
- **D6 — Sin Dependencias Nuevas**: Ejecuta en Node.js puro y librerías preexistentes (`sharp`, `jspdf`, `docx`).
- **D7 — Offline-First**: Todo se resuelve localmente en `/public`; los equivalentes virtuales son informativos y no realizan fetch externo.
- **D8 — EPP Normativo**: `eppRequerido?: string[]` destaca el equipo de protección obligatorio según normas oficiales mexicanas.
- **D9 — Degradación Segura (3 Fallbacks)**:
  1. Slug desconocido: token permanece intacto en el texto literal sin romper el renderizado.
  2. Imagen PNG pendiente: se muestra el placeholder institucional automático.
  3. Texto sin tokens: procesamiento regular idéntico sin mutaciones.
- **D10 — Rendimiento**: Límite de asset 512×512 px / ≤ 60 KB.

---

## 3. Catálogo de los 53 Slugs Prioritarios P1

| # | Slug | Nombre Oficial | Categoría | EPP Requerido | Equivalente Virtual |
|---|---|---|---|---|---|
| 1 | `multimetro` | Multímetro Digital Autorango | medicion | Gafas, Calzado dieléctrico | Falstad CircuitJS |
| 2 | `osciloscopio` | Osciloscopio Digital de 2 Canales | medicion | Gafas de seguridad | Falstad / EveryCircuit |
| 3 | `fuente-poder` | Fuente de Alimentación Regulable DC | medicion | Gafas de seguridad | Tinkercad Circuits |
| 4 | `generador-funciones` | Generador de Funciones y Señales | medicion | Gafas de seguridad | Falstad Function Generator |
| 5 | `microscopio-optico` | Microscopio Óptico Compuesto | laboratorio_bio | Bata 100% algodón, Gafas | Virtual Microscope NCBioNetwork |
| 6 | `probeta` | Probeta Graduada de Vidrio (100 ml) | laboratorio_quimica | Bata, Gafas, Guantes nitrilo | PhET Densidad y Volumen |
| 7 | `matraz-erlenmeyer` | Matraz Erlenmeyer de 250 ml | laboratorio_quimica | Bata, Gafas de seguridad | PhET Concentración |
| 8 | `bureta` | Bureta Graduada con Llave de Teflón | laboratorio_quimica | Bata, Gafas, Guantes nitrilo | PhET Escala de pH |
| 9 | `balanza-digital` | Balanza Digital de Precisión (0.01 g) | medicion | — | PhET Balanza y Masas |
| 10 | `phmetro` | Medidor de pH Digital | medicion | Gafas, Guantes nitrilo | PhET Escala de pH |
| 11 | `termometro` | Termómetro de Laboratorio (-10° a 110°C) | medicion | Gafas de seguridad | PhET Estados de la Materia |
| 12 | `cronometro` | Cronómetro Digital con Memoria | medicion | — | Tracker Video Analysis |
| 13 | `mechero-lab` | Mechero Bunsen / Lámpara de Alcohol | laboratorio_quimica | Bata, Gafas, Cabello recogido | PhET Calorimetría |
| 14 | `imanes` | Juego de Imanes Didácticos | fisica | — | PhET Faraday |
| 15 | `lentes-opticos` | Juego de Lentes Ópticos | fisica | — | PhET Óptica Geométrica |
| 16 | `geoplano` | Geoplano Didáctico con Bandas Elásticas | arte | — | Polypad Geoboard |
| 17 | `compas` | Compás de Precisión Metálico | herramientas | — | GeoGebra Geometría |
| 18 | `dados` | Juego de Dados Poliédricos y Estándar | medicion | — | PhET Probabilidad |
| 19 | `regla-calculo` | Regla de Cálculo y Escalas Numéricas | medicion | — | Desmos Calculadora |
| 20 | `pc-escritorio` | Computadora de Escritorio / Laptop | computo | — | VS Code Web / Colab |
| 21 | `impresora` | Impresora Multifuncional | computo | — | — |
| 22 | `escaner` | Escáner Digitalizador de Documentos | computo | — | — |
| 23 | `multifuncional` | Equipo Multifuncional de Oficina | computo | — | — |
| 24 | `cable-red` | Cable de Red Ethernet UTP Cat 6 | computo | — | Cisco Packet Tracer |
| 25 | `crimpadora-red` | Pinza Ponchadora / Crimpadora RJ45 | herramientas | Gafas de seguridad | — |
| 26 | `tester-cable` | Probador de Cables de Red (Tester RJ45) | herramientas | — | — |
| 27 | `desarmadores-precision` | Destornilladores de Precisión Electrónica | herramientas | Gafas de seguridad | — |
| 28 | `arduino-kit` | Kit de Robótica Arduino Uno | computo | — | Tinkercad Arduino Simulator |
| 29 | `impresora-3d` | Impresora 3D de Filamento (FDM) | computo | Gafas, Ventilación | Tinkercad 3D Design |
| 30 | `destornilladores` | Destornilladores con Mango Aislado 1000V | herramientas | Gafas, Guantes dieléctricos | — |
| 31 | `alicates` | Pinzas de Electricista Universales | herramientas | Gafas, Guantes mecánicos | — |
| 32 | `contactos-electricos` | Placas de Contactos y Apagadores | herramientas | Gafas, Desenergización | Tinkercad Circuits |
| 33 | `perfocel` | Tablero Perforado (Perfocel) | herramientas | Gafas de seguridad | — |
| 34 | `huerto-semillero` | Semillero y Charolas de Germinación | agro | Guantes de jardinería | — |
| 35 | `herramienta-jardin` | Kit de Herramientas de Jardinería | agro | Guantes, Calzado cerrado | — |
| 36 | `horno-reposteria` | Horno de Convección / Estufa de Cocina | laboratorio_quimica | Mandil, Guantes térmicos, Cofia | — |
| 37 | `batidora` | Batidora de Pedestal / Manual | laboratorio_quimica | Cofia, Mandil | — |
| 38 | `tabla-cortar` | Tabla de Picar de Polietileno Grado Alim. | laboratorio_quimica | Mandil, Guantes higiénicos | — |
| 39 | `mesa-dibujo` | Tablero de Dibujo Técnico y Regla T | arte | — | LibreCAD / QCAD |
| 40 | `escuadras` | Juego de Escuadras Profesionales (30/60/45) | arte | — | GeoGebra Suite |
| 41 | `tablet-grafica` | Tableta Digitalizadora con Lápiz | computo | — | Photopea / Krita |
| 42 | `micfono-usb` | Micrófono de Condensador USB | computo | — | BandLab / Audacity |
| 43 | `audifonos` | Audífonos de Diadema Aislantes de Ruido | computo | — | — |
| 44 | `tarjetas-vocabulario` | Tarjetas Didácticas (Flashcards) | arte | — | Quizlet / Anki Web |
| 45 | `mapa-zona` | Plano Cartográfico Municipal y Regional | medicion | — | INEGI Mapa Digital |
| 46 | `cuaderno-campo` | Cuaderno y Bitácora de Registro de Campo | medicion | — | — |
| 47 | `material-arte` | Kit de Materiales Artísticos (Pinturas) | arte | — | Sketchpad / AutoDraw |
| 48 | `balon` | Balones Deportivos Reglamentarios | deportivo | — | — |
| 49 | `conos` | Juego de Conos y Marcadores Deportivos | deportivo | — | — |
| 50 | `probeta-graduada` | Probeta Graduada de Vidrio | laboratorio_quimica | Bata, Gafas, Guantes nitrilo | — |
| 51 | `embudo-de-vidrio` | Embudo de Vidrio de Laboratorio | laboratorio_quimica | Bata, Gafas de seguridad | — |
| 52 | `mortero-con-pilon` | Mortero de Porcelana con Pilón | laboratorio_quimica | Gafas de seguridad | — |
| 53 | `soporte-universal` | Soporte Universal de Laboratorio | laboratorio_quimica | Gafas de seguridad | — |

> Filas 50–53: ampliación P1 del 2026-10-06 (imágenes `<slug>.png` añadidas al mismo lote).

---

## 4. Guía para Nuevos Assets de Imagen

Para crear o reemplazar los PNG de los materiales:
1. **Ruta**: `public/images/materiales/<slug>.png`.
2. **Dimensiones**: 512×512 píxeles (relación 1:1).
3. **Formato**: PNG de 24 o 32 bits con transparencia o fondo institucional claro (#F8FAFC).
4. **Peso máximo**: ≤ 60 KB por archivo (con compresión PNG nivel 9 en Sharp o TinyPNG).
5. **Estilo visual**: Fotografía técnica aislada o ilustración vectorial de alta fidelidad sin marcas de agua ni elementos publicitarios.
