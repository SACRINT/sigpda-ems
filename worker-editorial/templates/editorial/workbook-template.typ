// workbook-template.typ — Plantilla Editorial de Alta Gama para Libros de Texto Escolares
// SIGPDA-EMS · DBEPA Puebla · Modelo MCCEMS 2026-2027
//
// Estilo visual: Santillana / Pearson / McGraw-Hill
// - Retícula asimétrica a 2 columnas (columna principal + columna marginal de notas/spot)
// - Encabezados corrientes dinámicos con UAC y Bloque
// - Cajas pedagógicas diferenciadas (Objetivo, Motivación, Ejemplo Resuelto, Práctica, Autoevaluación)
// - Portada institucional oficial (Puebla / SEMS / DBEPA / Zona 004)
// - Spot de materiales didácticos limitado estrictamente a <= 4.2 cm (>= 300 DPI)

// ============================================================================
// Paleta Cromática Institucional & Editorial (Valores Hex sin almohadilla interna)
// ============================================================================
#let c-primary = rgb("0f294a")      // Azul Marino Profundo Institucional
#let c-secondary = rgb("801124")    // Guinda / Granate SEP Puebla
#let c-accent = rgb("c98a2c")       // Oro / Ámbar Curricular
#let c-teal = rgb("0d766e")         // Verde Azulado Matemático
#let c-slate-dark = rgb("1e293b")   // Texto Principal (Slate 800)
#let c-slate-muted = rgb("475569")  // Texto Secundario (Slate 600)
#let c-bg-card = rgb("f8fafc")      // Fondo de cajas didácticas (Slate 50)
#let c-border = rgb("e2e8f0")       // Borde tenue de separación
#let c-gold-bg = rgb("fefce8")      // Fondo para motivación / reto situado
#let c-teal-bg = rgb("f0fdfa")      // Fondo para ejemplo resuelto
#let c-purple-bg = rgb("faf5ff")    // Fondo para práctica autónoma

// ============================================================================
// Cajas Pedagógicas y Componentes de Retícula (En modo Markup)
// ============================================================================

  #let callout-box(
  title: none,
  // icon: reservado por compatibilidad; NO se imprime: Liberation Sans carece de
  // glifos emoji y Typst dibuja un "tofu" □ antes de cada título de caja.
  icon: "",
  bg-color: c-bg-card,
  border-color: c-primary,
  text-color: c-slate-dark,
  body
) = [
  #block(
    fill: bg-color,
    stroke: (left: 3.5pt + border-color, rest: 0.5pt + border-color.lighten(70%)),
    radius: (right: 4pt),
    inset: 5pt,
    width: 100%,
    outset: 0pt,
    spacing: 2pt,
    [
      #if title != none [
        #text(fill: border-color, weight: "bold", size: 9.3pt)[#title]
        #v(1.5pt)
      ]
      #text(fill: text-color, size: 8.8pt)[#body]
    ]
  )
]

#let marginal-spot-figure(img-path, caption-text, ancho-cm: 3.8) = [
  #let safe-ancho = calc.min(ancho-cm, 4.2) * 1cm
  #block(
    width: 100%,
    stroke: 0.5pt + c-border,
    radius: 4pt,
    fill: white,
    inset: 5pt,
    spacing: 5pt,
    [
      #align(center)[
        // Restricción dimensional estricta conectada al modelo: ancho <= min(anchoCm, 4.2 cm) (>= 300 DPI)
        #image(img-path, width: safe-ancho)
      ]
      #if caption-text != none and caption-text != "" [
        #v(1.5pt)
        #text(fill: c-slate-muted, size: 8.3pt, style: "italic")[
          #align(center)[#caption-text]
        ]
      ]
    ]
  )
]

#let marginal-sidenote(title: "Glosario Clave", body) = [
  #block(
    width: 100%,
    fill: c-bg-card,
    stroke: (top: 2pt + c-accent, rest: 0.5pt + c-border),
    radius: 3pt,
    inset: 6pt,
    spacing: 5pt,
    [
      #text(fill: c-accent.darken(20%), weight: "bold", size: 9.3pt)[#title]
      #v(1.5pt)
      #text(fill: c-slate-dark, size: 8.8pt)[#body]
    ]
  )
]

#let marginal-resource(recursos) = [
  #if recursos != none and recursos.len() > 0 [
    #block(
      width: 100%,
      fill: rgb("eff6ff"),
      stroke: (top: 2pt + rgb("2563eb"), rest: 0.5pt + c-border),
      radius: 3pt,
      inset: 6pt,
      spacing: 5pt,
      [
        #text(fill: rgb("1d4ed8"), weight: "bold", size: 9.3pt)[Enlaces de Ampliación]
        #v(1.5pt)
        #for r in recursos [
          #text(size: 8.8pt)[
            *#r.titulo* (#r.tipo)\
            #text(fill: rgb("2563eb"), size: 7.8pt)[#r.url]\
          ]
          #v(1.5pt)
        ]
      ]
    )
  ]
]

// ============================================================================
// Portada Escolar Institucional
// ============================================================================
#let render-institutional-cover(chapter) = [
  #page(
    header: none,
    footer: none,
    margin: (x: 2.2cm, top: 2.5cm, bottom: 2.5cm),
    [
      // Franja superior institucional
      #grid(
        columns: (1fr, auto),
        align(left)[
          #text(fill: c-secondary, weight: "bold", size: 8.5pt)[
            GOBIERNO DEL ESTADO DE PUEBLA · SECRETARÍA DE EDUCACIÓN PÚBLICA
          ]\
          #text(fill: c-slate-muted, size: 7.5pt)[
            SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR · DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA
          ]\
          #text(fill: c-primary, weight: "bold", size: 7.5pt)[
            #chapter.zonaEscolar
          ]
        ],
        align(right)[
          #rect(
            fill: c-secondary,
            radius: 3pt,
            inset: (x: 8pt, y: 5pt),
            [#text(fill: white, weight: "bold", size: 8pt)[MCCEMS 2026–2027]]
          )
        ]
      )

      #v(2.5cm)

      // Barra decorativa tricolor
      #grid(
        columns: (3fr, 2fr, 1fr),
        rect(fill: c-primary, height: 4pt, width: 100%),
        rect(fill: c-secondary, height: 4pt, width: 100%),
        rect(fill: c-accent, height: 4pt, width: 100%)
      )

      #v(1.2cm)

      // Identificación de la Materia
      #text(fill: c-accent.darken(10%), weight: "bold", size: 12pt, tracking: 1.5pt)[
        LIBRO DE TEXTO PARA EL ESTUDIANTE · CUADERNO DE APRENDIZAJE AUTÓNOMO
      ]
      #v(0.4cm)
      #text(fill: c-primary, weight: "bold", size: 26pt)[
        #chapter.uac
      ]
      #v(0.4cm)
      #if "editorialSubtitle" in chapter and chapter.editorialSubtitle != none [
        #text(fill: c-secondary, weight: "medium", size: 14pt)[
          #chapter.editorialSubtitle
        ]\
      ]
      #v(0.2cm)
      #text(fill: c-slate-dark, weight: "bold", size: 13pt)[
        #chapter.bloque
      ]

      #v(2.0cm)

      // Ficha Técnica Escolar
      #rect(
        fill: rgb("f1f5f9"),
        stroke: (left: 4pt + c-primary, rest: 0.5pt + c-border),
        radius: (right: 4pt),
        inset: 12pt,
        width: 100%,
        [
          #grid(
            columns: (1fr, 1fr),
            gutter: 10pt,
            [
              #text(fill: c-slate-muted, size: 8pt)[Plantel Educativo:]\
              #text(fill: c-primary, weight: "bold", size: 10pt)[#chapter.plantel]\
              #v(1.5pt)
              #text(fill: c-slate-muted, size: 8pt)[Clave de Centro de Trabajo (CCT):]\
              #text(fill: c-slate-dark, weight: "bold", size: 9pt)[#chapter.cct]
            ],
            [
              #text(fill: c-slate-muted, size: 8pt)[Semestre:]\
              #text(fill: c-primary, weight: "bold", size: 10pt)[Semestre #chapter.semestre]\
              #v(1.5pt)
              #text(fill: c-slate-muted, size: 8pt)[Ciclo Escolar:]\
              #text(fill: c-slate-dark, weight: "bold", size: 9pt)[#chapter.cicloEscolar]
            ]
          )
        ]
      )

      #v(1.5cm)

      #align(bottom)[
        #line(length: 100%, stroke: 0.5pt + c-border)
        #v(1.5pt)
        #grid(
          columns: (1fr, auto),
          align(left)[
            #text(fill: c-slate-muted, size: 7.5pt)[
              Edición de Imprenta Comercial Escolar · Generado por SIGPDA-EMS Motor Editorial N1
            ]
          ],
          align(right)[
            #text(fill: c-secondary, weight: "bold", size: 7.5pt)[
              PROHIBIDA SU REPRODUCCIÓN CON FINES DE LUCRO
            ]
          ]
        )
      ]
    ]
  )
]

// ============================================================================
// Renderizado de Sesión Individual
// ============================================================================
#let render-session-item(s, chapter) = [
  #metadata((sessionNum: s.numero, title: s.titulo)) <rendered-session>
  // Encabezado de Sesión (Full Width)
  #block(
    fill: c-primary,
    radius: 4pt,
    inset: (x: 12pt, y: 5pt),
    width: 100%,
    [
      #grid(
        columns: (auto, 1fr),
        gutter: 10pt,
        align(horizon)[
          #rect(
            fill: c-accent,
            radius: 3pt,
            inset: (x: 6pt, y: 3pt),
            [#text(fill: c-primary, weight: "bold", size: 10.9pt)[SESIÓN #s.numero]]
          )
        ],
        align(horizon)[
          #text(fill: white, weight: "bold", size: 11.4pt)[#s.titulo]
        ]
      )
    ]
  )
  #v(1.5pt)

  // Caja de Objetivo y Saberes Previos
  #grid(
    columns: (3fr, 2fr),
    gutter: 6pt,
    callout-box(
      title: "Lo que vas a aprender hoy (Objetivo)",
      bg-color: rgb("f0fdf4"),
      border-color: rgb("16a34a"),
      [#s.objetivo]
    ),
    callout-box(
      title: "Saberes que ya tienes",
      bg-color: rgb("f8fafc"),
      border-color: c-slate-muted,
      [#s.saberesPrevios]
    )
  )

  #v(1.5pt)

  // Retícula Asimétrica: Columna Principal + Columna Marginal
  #grid(
    columns: (1fr, 4.2cm),
    gutter: 12pt,
    [
      // 1. Motivación y Contexto Situado
      #callout-box(
        title: "Punto de Partida: ¿Por qué importa esto en tu comunidad?",
        bg-color: c-gold-bg,
        border-color: c-accent.darken(10%),
        [#s.motivacion]
      )

      #v(4pt)

      // 2. Fundamentación Teórica / Contenido Real
      #text(fill: c-primary, weight: "bold", size: 9.3pt)[
        Conceptos Fundamentales y Modelado Matemático
      ]
      #v(1.5pt)

      #for bloque in s.contenido [
        #if bloque.tipo == "parrafo" [
          #text(fill: c-slate-dark, size: 8.8pt)[#bloque.texto]
          #v(1.5pt)
        ] else if bloque.tipo == "formula" [
          #rect(
            fill: rgb("f1f5f9"),
            stroke: 0.5pt + c-border,
            radius: 3pt,
            width: 100%,
            inset: 4pt,
            [
              #align(center)[
                #text(fill: c-primary, weight: "bold", size: 9.8pt)[
                  #if "titulo" in bloque and bloque.titulo != none [#bloque.titulo: ]
                  #bloque.texto
                ]
              ]
            ]
          )
          #v(1.5pt)
        ] else if bloque.tipo == "definicion" [
          #callout-box(
            title: if "titulo" in bloque and bloque.titulo != none { bloque.titulo } else { "Definición Formal" },
            bg-color: rgb("f8fafc"),
            border-color: c-teal,
            [#bloque.texto]
          )
          #v(1.5pt)
        ] else if bloque.tipo == "tabla" [
          #if "columnas" in bloque and bloque.columnas != none and "filas" in bloque and bloque.filas != none [
            #table(
              columns: bloque.columnas.len(),
              fill: (col, row) => if row == 0 { c-primary.lighten(90%) } else if calc.odd(row) { rgb("f8fafc") } else { white },
              stroke: 0.5pt + c-border,
              inset: 4pt,
              ..bloque.columnas.map(c => text(weight: "bold", size: 8.8pt, fill: c-primary)[#c]),
              ..bloque.filas.flatten().map(cell => text(size: 8.8pt, fill: c-slate-dark)[#cell])
            )
            #v(1.5pt)
          ] else if "texto" in bloque and bloque.texto != none [
            #text(size: 9.8pt)[#bloque.texto]
            #v(1.5pt)
          ]
        ]
      ]
    ],
    [
      // Barra Marginal: Spot Didáctico + Glosario + Recursos
      #if "materialSpot" in s and s.materialSpot != none [
        #marginal-spot-figure(
          (if "assetsRoot" in chapter and chapter.assetsRoot != none { chapter.assetsRoot } else { "/public" }) + "/images/materiales/" + s.materialSpot.archivo,
          if "pie" in s.materialSpot and s.materialSpot.pie != none { s.materialSpot.pie } else { s.materialSpot.nombre },
          ancho-cm: if "anchoCm" in s.materialSpot and s.materialSpot.anchoCm != none { s.materialSpot.anchoCm } else { 3.8 }
        )
      ]

      #if "sidenote" in s and s.sidenote != none and s.sidenote != "" [
        #marginal-sidenote(s.sidenote)
      ]

      #if "recursos" in s and s.recursos != none and s.recursos.len() > 0 [
        #marginal-resource(s.recursos)
      ]
    ]
  )

  #v(1.5pt)

  // 3. Ejemplo Resuelto Paso a Paso (Callout Ancho)
  #callout-box(
    title: "Ejemplo Resuelto con Números: Paso a Paso",
    bg-color: c-teal-bg,
    border-color: c-teal,
    [
      #text(weight: "bold", size: 9.3pt)[#s.ejemploResuelto.enunciado]
      #v(1.5pt)
      #set list(spacing: 2pt)
      #list(
        ..s.ejemploResuelto.pasos.map(paso => text(size: 8.8pt)[#paso])
      )
    ]
  )

  #v(1.5pt)

  // 4. Práctica Autónoma Guiada (Ponte a Prueba)
  #callout-box(
    title: "Ponte a Prueba: Actividad Individual de Práctica",
    bg-color: c-purple-bg,
    border-color: rgb("9333ea"),
    [
      #set par(spacing: 1.2pt, leading: 0.5em)
      #for (idx, item) in s.practica.enumerate() [
        #text(weight: "bold", size: 8.8pt)[Ejercicio #(idx + 1):] #text(size: 8.8pt)[#item.enunciado]\
        #text(fill: rgb("7e22ce"), size: 7.8pt, style: "italic")[Pista para comenzar: #item.pista]
        #v(1.5pt)
      ]
    ]
  )

  #v(1.5pt)

  // 5. Aplicación Comunitaria y Autoevaluación
  #grid(
    columns: (1fr, 1fr),
    gutter: 6pt,
    callout-box(
      title: "Conexión con tu Comunidad (PAEC)",
      bg-color: rgb("fff7ed"),
      border-color: rgb("ea580c"),
      [
        #s.aplicacion
        #if "productoIntegrador" in s and s.productoIntegrador != none and s.productoIntegrador != "" [
          #metadata((sessionNum: s.numero, avance: s.productoIntegrador)) <rendered-producto-integrador>
          #v(1.5pt)
          #text(fill: rgb("15803d"), weight: "bold", size: 8.3pt)[Avance del Producto Integrador:]
          #h(3pt)
          #text(fill: c-slate-dark, size: 8.3pt)[#s.productoIntegrador]
        ]
      ]
    ),
    callout-box(
      title: "Lista de Autoverificación",
      bg-color: rgb("f8fafc"),
      border-color: rgb("0284c7"),
      [
        #set par(spacing: 1pt, leading: 0.5em)
        #for check in s.autoevaluacion [
          #text(size: 8.3pt)[\[ \] #check]\
        ]
      ]
    )
  )
]

// ============================================================================
// Función Maestra: Renderizado del Capítulo Completo
// ============================================================================
#let render-student-chapter(chapter) = [
  // Configuración de Página Editorial
  #set page(
    paper: "us-letter",
    margin: (inside: 2.0cm, outside: 1.6cm, top: 1.65cm, bottom: 1.6cm),
    header: context {
      let page-num = counter(page).get().first()
      if page-num > 1 [
        #grid(
          columns: (1fr, auto),
          align(left)[
            #text(fill: c-primary, weight: "bold", size: 8pt)[#chapter.uac]
            #text(fill: c-slate-muted, size: 8pt)[ · #chapter.bloque]
          ],
          align(right)[
            #text(fill: c-secondary, weight: "bold", size: 8pt)[SIGPDA-EMS]
          ]
        )
        #v(1.5pt)
        #line(length: 100%, stroke: 0.5pt + c-primary)
      ]
    },
    footer: context {
      let page-num = counter(page).get().first()
      if page-num > 1 [
        #line(length: 100%, stroke: 0.5pt + c-border)
        #v(1.5pt)
        #grid(
          columns: (1fr, auto),
          align(left)[
            #text(fill: c-slate-muted, size: 7.5pt)[
              Secretaría de Educación Pública de Puebla · DBEPA · Modelo MCCEMS
            ]
          ],
          align(right)[
            #text(fill: c-primary, weight: "bold", size: 8pt)[
              Página #page-num
            ]
          ]
        )
      ]
    }
  )

  // Tipografía editorial institucional
  // Nota H-04: Liberation Sans (SIL OFL) métricamente compatible con Arial, libre de licencias
  // propietarias y embebida en el contenedor del worker vía --font-path (/app/fonts).
  #set text(
    font: "Liberation Sans",
    size: 9.3pt,
    fill: c-slate-dark,
    lang: "es"
  )

  #set par(
    justify: true,
    leading: 0.45em
  )

  // 1. Portada Institucional
  #render-institutional-cover(chapter)

  // 2. Página Preliminar / Índice y Metodología
  #page[
    #v(0.5cm)
    #text(fill: c-primary, weight: "bold", size: 16pt)[
      Contenido del Bloque y Metodología Autodidacta
    ]
    #v(0.2cm)
    #text(fill: c-secondary, size: 10pt)[
      #chapter.bloque
    ]
    #v(0.4cm)
    #line(length: 100%, stroke: 1pt + c-accent)

    #v(0.6cm)

    #callout-box(
      title: "¿Cómo aprender con este libro de texto?",
      bg-color: rgb("eff6ff"),
      border-color: rgb("2563eb"),
      [
        Este cuaderno de trabajo ha sido diseñado para que tú construyas tu conocimiento de forma autónoma. Cada sesión contiene:
        - *Objetivo*: La meta concreta de aprendizaje que alcanzarás.
        - *Punto de partida*: Un reto real de tu comunidad en el estado de Puebla (PAEC) para conectar la teoría con tu realidad.
        - *Teoría clara*: Fórmulas, definiciones rigurosas y explicaciones sin tecnicismos innecesarios.
        - *Ejemplo resuelto paso a paso*: Procedimientos numéricos explícitos para que veas exactamente cómo se aplican las fórmulas.
        - *Ponte a prueba*: Ejercicios con pistas estratégicas para que desarrolles tu razonamiento sin frustrarte.
        - *Conexión con tu vida y autoevaluación*: Preguntas de reflexión para verificar lo aprendido antes de avanzar.
      ]
    )

    #v(0.8cm)

    #text(fill: c-primary, weight: "bold", size: 12pt)[
      Mapa de Sesiones de Aprendizaje:
    ]
    #v(0.4cm)

    #for s in chapter.sesiones [
      #grid(
        columns: (40pt, 1fr),
        gutter: 8pt,
        align(top)[
          #rect(
            fill: c-primary.lighten(90%),
            stroke: 0.5pt + c-primary,
            radius: 2pt,
            inset: (x: 4pt, y: 2pt),
            [#text(fill: c-primary, weight: "bold", size: 8pt)[S-#s.numero]]
          )
        ],
        align(top)[
          #text(weight: "bold", size: 8.8pt)[#s.titulo]\
          #text(fill: c-slate-muted, size: 7.8pt)[#s.objetivo]
          #v(1.5pt)
        ]
      )
    ]
  ]

  #pagebreak()

  // 3. Renderizado de las Sesiones (salto de página SOLO entre sesiones; sin
  // página en blanco al final del capítulo)
  #let session-list = chapter.sesiones
  #for (session-idx, s) in session-list.enumerate() [
    #render-session-item(s, chapter)
    #if session-idx < session-list.len() - 1 [
      #pagebreak()
    ]
  ]
]
