// components/active-workbook.typ — Primitivas de Cuaderno de Trabajo Activo + SVG STEM + QR
// SIGPDA-EMS · Fase 3 Motor Editorial Unificado (PUBLISHING_ENGINE_V2)

#let writing-lines(
  title: "Espacio de Trabajo del Estudiante",
  count: 4,
  border-color: rgb("cbd5e1"),
  accent-color: rgb("0f294a"),
) = [
  #let safe-count = calc.max(2, calc.min(count, 8))
  #block(
    width: 100%,
    fill: rgb("ffffff"),
    stroke: 0.6pt + border-color,
    radius: 4pt,
    inset: (x: 8pt, y: 6pt),
    spacing: 4pt,
    breakable: false,
    [
      #text(fill: accent-color, weight: "bold", size: 8.5pt)[#title]
      #v(4pt)
      #for i in range(safe-count) [
        #v(10pt)
        #line(length: 100%, stroke: (paint: rgb("cbd5e1"), thickness: 0.5pt, dash: "dotted"))
      ]
      #v(2pt)
    ]
  )
]

#let empty-data-table(
  title: "Tabla de Registro de Evidencias y Datos",
  headers: ("Elemento / Variable", "Observación / Dato", "Interpretación"),
  rows: 4,
  header-color: rgb("0f294a"),
) = [
  #let safe-rows = calc.max(2, calc.min(rows, 7))
  #let cols = headers.len()
  #block(
    width: 100%,
    spacing: 4pt,
    breakable: false,
    [
      #text(fill: header-color, weight: "bold", size: 8.5pt)[#title]
      #v(2pt)
      #table(
        columns: (1fr,) * cols,
        stroke: 0.5pt + rgb("cbd5e1"),
        inset: (x: 5pt, y: 6pt),
        fill: (_, row) => if row == 0 { header-color.lighten(88%) } else if calc.odd(row) { rgb("f8fafc") } else { white },
        ..headers.map(h => text(fill: header-color, weight: "bold", size: 8pt)[#h]),
        ..range(safe-rows * cols).map(_ => [#v(9pt)])
      )
    ]
  )
]

#let code-workspace(
  title: "Espacio de Código / Algoritmo",
  lang: "pseudocodigo",
  starter: "",
  accent-color: rgb("1e6fb8"),
) = [
  #block(
    width: 100%,
    fill: rgb("f8fafc"),
    stroke: (left: 3pt + accent-color, rest: 0.6pt + rgb("cbd5e1")),
    radius: (right: 4pt),
    inset: (x: 8pt, y: 6pt),
    spacing: 4pt,
    breakable: false,
    [
      #grid(
        columns: (1fr, auto),
        [#text(fill: accent-color, weight: "bold", size: 8.5pt)[#title]],
        [#rect(fill: accent-color.lighten(86%), radius: 2pt, inset: (x: 4pt, y: 1.5pt), [#text(fill: accent-color, size: 7.2pt, weight: "bold")[#upper(lang)]])]
      )
      #v(3pt)
      #if starter != none and starter != "" [
        #rect(
          width: 100%,
          fill: rgb("f1f5f9"),
          stroke: 0.4pt + rgb("cbd5e1"),
          radius: 2pt,
          inset: 5pt,
          [#text(font: "Liberation Sans", size: 8pt, fill: rgb("1e293b"))[#starter]]
        )
        #v(3pt)
      ]
      #for i in range(4) [
        #v(9pt)
        #line(length: 100%, stroke: (paint: rgb("cbd5e1"), thickness: 0.5pt, dash: "dashed"))
      ]
    ]
  )
]

#let embedded-svg-diagram(
  svg-str,
  title: none,
  caption: none,
  accent-color: rgb("0f294a"),
) = [
  #block(
    width: 100%,
    fill: white,
    stroke: 0.6pt + rgb("cbd5e1"),
    radius: 4pt,
    inset: 6pt,
    spacing: 4pt,
    breakable: false,
    [
      #if title != none and title != "" [
        #text(fill: accent-color, weight: "bold", size: 8.5pt)[#title]
        #v(2pt)
      ]
      #align(center)[
        #image(bytes(svg-str), format: "svg", width: 100%, height: 4.5cm, fit: "contain")
      ]
      #if caption != none and caption != "" [
        #v(2pt)
        #align(center)[
          #text(fill: rgb("475569"), size: 7.8pt, style: "italic")[#caption]
        ]
      ]
    ]
  )
]

#let digital-tool-qr-card(
  qr,
  accent-color: rgb("0f294a"),
) = [
  #block(
    width: 100%,
    fill: rgb("f8fafc"),
    stroke: (top: 2pt + accent-color, rest: 0.5pt + rgb("cbd5e1")),
    radius: 3pt,
    inset: 5pt,
    spacing: 5pt,
    breakable: false,
    [
      #text(fill: accent-color, weight: "bold", size: 8.5pt)[Herramienta Digital]
      #v(2pt)
      #align(center)[
        #image(bytes(qr.svg), format: "svg", width: 1.75cm, height: 1.75cm)
      ]
      #v(2pt)
      #text(fill: rgb("1e293b"), weight: "bold", size: 8pt)[#qr.name]\
      #text(fill: rgb("475569"), size: 7.4pt)[#qr.description]\
      #text(fill: rgb("1d4ed8"), size: 6.8pt)[#qr.url]
    ]
  )
]
