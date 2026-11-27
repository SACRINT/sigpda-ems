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
// Componentes Modulares Fase 3 (PUBLISHING_ENGINE_V2)
// ============================================================================
#import "components/active-workbook.typ": writing-lines, empty-data-table, code-workspace, embedded-svg-diagram, digital-tool-qr-card
#import "components/mission-banner.typ": render-mission-banner
#import "components/project-section.typ": render-project-section
#import "components/evaluation-section.typ": render-evaluation-section

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

// Helpers disciplinares dinámicos (Fase 1: elimina textos matemáticos hardcodeados)
#let resolve-ui-label(chapter, key, fallback) = {
  if "disciplinaUi" in chapter and chapter.disciplinaUi != none and "labels" in chapter.disciplinaUi and key in chapter.disciplinaUi.labels and chapter.disciplinaUi.labels.at(key) != none {
    chapter.disciplinaUi.labels.at(key)
  } else {
    fallback
  }
}

#let resolve-ui-color(chapter, key, fallback) = {
  if "disciplinaUi" in chapter and chapter.disciplinaUi != none and "palette" in chapter.disciplinaUi and key in chapter.disciplinaUi.palette and chapter.disciplinaUi.palette.at(key) != none {
    rgb(chapter.disciplinaUi.palette.at(key))
  } else {
    fallback
  }
}

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
  #let has-cover-scene = "coverScene" in chapter and chapter.coverScene != none
  #let cover-primary = resolve-ui-color(chapter, "primary", c-primary)
  #let cover-accent = resolve-ui-color(chapter, "accent", c-accent)
  #let cover-assets-root = if "assetsRoot" in chapter and chapter.assetsRoot != none { chapter.assetsRoot } else { "/public" }
  #page(
    header: none,
    footer: none,
    margin: (x: 2.2cm, top: 2.2cm, bottom: 2.2cm),
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
          #text(fill: cover-primary, weight: "bold", size: 7.5pt)[
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

      #v(if has-cover-scene { 1.0cm } else { 2.5cm })

      // Barra decorativa tricolor
      #grid(
        columns: (3fr, 2fr, 1fr),
        rect(fill: cover-primary, height: 4pt, width: 100%),
        rect(fill: c-secondary, height: 4pt, width: 100%),
        rect(fill: cover-accent, height: 4pt, width: 100%)
      )

      #v(if has-cover-scene { 0.8cm } else { 1.2cm })

      // Identificación de la Materia
      #text(fill: cover-accent.darken(10%), weight: "bold", size: 12pt, tracking: 1.5pt)[
        LIBRO DE TEXTO PARA EL ESTUDIANTE · CUADERNO DE APRENDIZAJE AUTÓNOMO
      ]
      #v(0.35cm)
      #text(fill: cover-primary, weight: "bold", size: 25pt)[
        #chapter.uac
      ]
      #v(0.35cm)
      #if "editorialSubtitle" in chapter and chapter.editorialSubtitle != none [
        #text(fill: c-secondary, weight: "medium", size: 13.5pt)[
          #chapter.editorialSubtitle
        ]\
      ]
      #v(0.2cm)
      #text(fill: c-slate-dark, weight: "bold", size: 12.5pt)[
        #chapter.bloque
      ]

      #if has-cover-scene [
        #v(0.7cm)
        #block(
          width: 100%,
          radius: 6pt,
          clip: true,
          stroke: 0.75pt + c-border,
          [#image(cover-assets-root + chapter.coverScene.relativePath, width: 100%, height: 5.8cm, fit: "cover")]
        )
        #v(0.7cm)
      ] else [
        #v(2.0cm)
      ]

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
#let render-session-item(s, chapter) = {
  let content = [
  #let ui-primary = resolve-ui-color(chapter, "primary", c-primary)
  #let ui-accent = resolve-ui-color(chapter, "accent", c-accent)
  #let ui-teal = resolve-ui-color(chapter, "teal", c-teal)
  #let ui-teal-bg = resolve-ui-color(chapter, "tealBg", c-teal-bg)
  #let lbl-concept = resolve-ui-label(chapter, "conceptHeading", "Conceptos Fundamentales y Desarrollo Teórico")
  #let lbl-example = resolve-ui-label(chapter, "exampleHeading", "Ejemplo Resuelto Paso a Paso")
  #let lbl-sidenote = resolve-ui-label(chapter, "sidenoteTitle", "Glosario Clave")

  #metadata((sessionNum: s.numero, title: s.titulo)) <rendered-session>
  // Encabezado de Sesión (Full Width)
  #block(
    fill: ui-primary,
    radius: 4pt,
    inset: (x: 12pt, y: 5pt),
    width: 100%,
    [
      #grid(
        columns: (auto, 1fr),
        gutter: 10pt,
        align(horizon)[
          #rect(
            fill: ui-accent,
            radius: 3pt,
            inset: (x: 6pt, y: 3pt),
            [#text(fill: ui-primary, weight: "bold", size: 10.9pt)[SESIÓN #s.numero]]
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
      #text(fill: ui-primary, weight: "bold", size: 9.3pt)[
        #lbl-concept
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

      #if "embeddedDiagram" in s and s.embeddedDiagram != none [
        #v(3pt)
        #embedded-svg-diagram(
          s.embeddedDiagram.svg,
          title: s.embeddedDiagram.title,
          caption: if "caption" in s.embeddedDiagram { s.embeddedDiagram.caption } else { none },
          accent-color: ui-primary,
        )
      ]
    ],
    [
      // Barra Marginal: Spot Didáctico + Glosario + Recursos + QR Herramienta Digital
      #if "materialSpot" in s and s.materialSpot != none [
        #marginal-spot-figure(
          (if "assetsRoot" in chapter and chapter.assetsRoot != none { chapter.assetsRoot } else { "/public" }) + "/images/materiales/" + s.materialSpot.archivo,
          if "pie" in s.materialSpot and s.materialSpot.pie != none { s.materialSpot.pie } else { s.materialSpot.nombre },
          ancho-cm: if "anchoCm" in s.materialSpot and s.materialSpot.anchoCm != none { s.materialSpot.anchoCm } else { 3.8 }
        )
      ]

      #if "sidenote" in s and s.sidenote != none and s.sidenote != "" [
        #marginal-sidenote(title: lbl-sidenote, s.sidenote)
      ]

      #if "recursos" in s and s.recursos != none and s.recursos.len() > 0 [
        #marginal-resource(s.recursos)
      ]

      #if "digitalToolQr" in s and s.digitalToolQr != none [
        #digital-tool-qr-card(s.digitalToolQr, accent-color: ui-primary)
      ]
    ]
  )

  #v(1.5pt)

  // 3. Ejemplo Resuelto Paso a Paso (Callout Ancho)
  #callout-box(
    title: lbl-example,
    bg-color: ui-teal-bg,
    border-color: ui-teal,
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

  #if "activeSpaces" in s and s.activeSpaces != none and s.activeSpaces.len() > 0 [
    #v(2pt)
    #for sp in s.activeSpaces [
      #if sp.kind == "writing_lines" [
        #writing-lines(
          title: sp.title,
          count: if "lines" in sp and sp.lines != none { sp.lines } else { 4 },
          accent-color: ui-primary,
        )
      ] else if sp.kind == "data_table" [
        #empty-data-table(
          title: sp.title,
          headers: if "headers" in sp and sp.headers != none { sp.headers } else { ("Variable", "Dato", "Conclusión") },
          rows: if "rows" in sp and sp.rows != none { sp.rows } else { 3 },
          header-color: ui-primary,
        )
      ] else if sp.kind == "code_box" [
        #code-workspace(
          title: sp.title,
          lang: if "language" in sp and sp.language != none { sp.language } else { "pseudocodigo" },
          starter: if "starterCode" in sp { sp.starterCode } else { "" },
          accent-color: ui-teal,
        )
      ]
    ]
  ]

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
  ];
  // Auto-escalado: ajusta la sesión para llenar la página disponible.
  // `measure` envuelve el contenido en un box de ancho fijo para no
  // sobre-reportar la altura (los bloques width:100% medidos sin ancho fijo se
  // disponen estrechos y devuelven una altura inflada).
  // CLAVE: para escalar sin CORTAR el texto a izquierda/derecha, el contenido
  // se compone a un ancho REDUCIDO (size.width / f) de modo que tras `scale(f)`
  // el ancho visual sea exactamente `size.width`. Si se compone a size.width y
  // se escala f>1, el contenido se ensancha y `clip` cortaría los bordes.
  // `origin: top + left` ancla la escala a la esquina superior izquierda (por
  // defecto Typst escala desde el centro y desbordaría el borde izquierdo).
  // El escalado se envuelve en block(height:)+clip para RESERVAR exactamente el
  // alto escalado (si no, `scale` reserva el alto original y deja página vacía).
  // - Sesiones cortas (natural <= objetivo): escalan hacia arriba y llenan.
  // - Sesiones muy altas (natural > objetivo/0.88): NO se escalan; fluyen
  //   naturalmente a 1+ páginas (comprimirlas fuerte con `scale` solapa contenido).
  layout(size => {
    let natural-full = measure(box(width: size.width, content)).height
    let avail = size.height - 4pt
    let target = avail - 12pt
    let floor-h = target / 0.88
    if natural-full > 0pt and natural-full <= floor-h {
      // f estimada; el alto natural crece al reducir el ancho de composición,
      // así que se re-mide a un ancho reducido y se recalcula f.
      let f-est = calc.min(calc.max(target / natural-full, 0.88), 1.3)
      let reduced-w = size.width / f-est
      let natural-reduced = measure(box(width: reduced-w, content)).height
      let f = calc.min(calc.max(target / natural-reduced, 0.88), 1.3)
      let final-w = size.width / f
      let natural-final = measure(box(width: final-w, content)).height
      block(
        width: size.width,
        height: calc.min(natural-final * f, target),
        clip: true,
        scale(x: f * 100%, y: f * 100%, origin: top + left, box(width: final-w, content)),
      )
    } else {
      content
    }
  })
}

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
        - *Teoría clara*: #resolve-ui-label(chapter, "methodologyTheoryBullet", "Conceptos clave, definiciones rigurosas y explicaciones claras sin tecnicismos innecesarios.")
        - *Ejemplo resuelto paso a paso*: #resolve-ui-label(chapter, "methodologyExampleBullet", "Casos y procedimientos aplicados paso a paso para observar el criterio en contexto.")
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

  // 3. Renderizado de Misiones, Sesiones y Cierres de Bloque (Proyecto + Evaluación NEM)
  #let ch-primary = resolve-ui-color(chapter, "primary", c-primary)
  #let ch-accent = resolve-ui-color(chapter, "accent", c-accent)
  #let ch-teal = resolve-ui-color(chapter, "teal", c-teal)
  #let chapter-missions = if "missions" in chapter and chapter.missions != none { chapter.missions } else { () }
  #let chapter-projects = if "projectSections" in chapter and chapter.projectSections != none { chapter.projectSections } else { () }
  #let chapter-evals = if "evaluationSections" in chapter and chapter.evaluationSections != none { chapter.evaluationSections } else { () }
  #let session-list = chapter.sesiones
  #for (session-idx, s) in session-list.enumerate() [
    #for m in chapter-missions [
      #if m.startSession == s.numero [
        #render-mission-banner(m, chapter, primary-color: ch-primary, accent-color: ch-accent)
      ]
    ]
    #render-session-item(s, chapter)
    #for proj in chapter-projects [
      #if "afterSession" in proj and proj.afterSession == s.numero [
        #pagebreak()
        #render-project-section(proj, primary-color: ch-primary, accent-color: ch-accent)
      ]
    ]
    #for ev in chapter-evals [
      #if "afterSession" in ev and ev.afterSession == s.numero [
        #pagebreak()
        #render-evaluation-section(ev, primary-color: ch-primary, accent-color: ch-accent, teal-color: ch-teal)
      ]
    ]
    #if session-idx < session-list.len() - 1 [
      #pagebreak()
    ]
  ]
  #for proj in chapter-projects [
    #if not ("afterSession" in proj) or proj.afterSession == none [
      #pagebreak()
      #render-project-section(proj, primary-color: ch-primary, accent-color: ch-accent)
    ]
  ]
  #for ev in chapter-evals [
    #if not ("afterSession" in ev) or ev.afterSession == none [
      #pagebreak()
      #render-evaluation-section(ev, primary-color: ch-primary, accent-color: ch-accent, teal-color: ch-teal)
    ]
  ]
]
