// components/project-section.typ — Proyecto Integrador PAEC al Cierre de cada Bloque
// SIGPDA-EMS · Fase 3 Motor Editorial Unificado (PUBLISHING_ENGINE_V2)

#let render-project-section(
  proj,
  primary-color: rgb("0f294a"),
  accent-color: rgb("c98a2c"),
) = [
  #metadata((blockNumber: proj.blockNumber, artifactName: proj.artifactName)) <rendered-project-section>
  #block(
    width: 100%,
    fill: primary-color,
    radius: 4pt,
    inset: (x: 10pt, y: 6pt),
    [
      #text(fill: accent-color.lighten(40%), weight: "bold", size: 8pt)[
        CIERRE DE BLOQUE #proj.blockNumber · PROYECTO INTEGRADOR COMUNITARIO (PAEC)
      ]\
      #text(fill: white, weight: "bold", size: 13pt)[#proj.artifactName]
    ]
  )
  #v(5pt)

  #block(
    width: 100%,
    fill: rgb("fefce8"),
    stroke: (left: 3.5pt + accent-color, rest: 0.5pt + rgb("fde68a")),
    radius: (right: 4pt),
    inset: 6pt,
    [
      #text(fill: accent-color.darken(15%), weight: "bold", size: 8.8pt)[Utilidad Comunitaria y Propósito del Producto]\
      #text(fill: rgb("1e293b"), size: 8.6pt)[#proj.communityUtility]
    ]
  )
  #v(5pt)

  #if "requiredMaterials" in proj and proj.requiredMaterials != none and proj.requiredMaterials.len() > 0 [
    #text(fill: primary-color, weight: "bold", size: 9pt)[Materiales e Insumos Requeridos]
    #v(2pt)
    #block(
      width: 100%,
      fill: rgb("f8fafc"),
      stroke: 0.5pt + rgb("cbd5e1"),
      radius: 3pt,
      inset: 5pt,
      [
        #text(fill: rgb("1e293b"), size: 8.3pt)[#proj.requiredMaterials.join(" · ")]
      ]
    )
    #v(5pt)
  ]

  #if "phases" in proj and proj.phases != none and proj.phases.len() > 0 [
    #text(fill: primary-color, weight: "bold", size: 9pt)[Fases de Ejecución del Proyecto]
    #v(2pt)
    #table(
      columns: (38pt, 1.1fr, 1.5fr, 1.1fr),
      stroke: 0.5pt + rgb("cbd5e1"),
      inset: 4.5pt,
      fill: (_, row) => if row == 0 { primary-color.lighten(88%) } else if calc.odd(row) { rgb("f8fafc") } else { white },
      text(fill: primary-color, weight: "bold", size: 8pt)[Fase],
      text(fill: primary-color, weight: "bold", size: 8pt)[Etapa y Tiempo],
      text(fill: primary-color, weight: "bold", size: 8pt)[Instrucciones para el Equipo],
      text(fill: primary-color, weight: "bold", size: 8pt)[Entregables],
      ..proj.phases.map(ph => (
        text(fill: primary-color, weight: "bold", size: 8pt)[F-#ph.phaseNum],
        text(fill: rgb("1e293b"), size: 8pt)[*#ph.title* (#ph.allocatedHours h)],
        text(fill: rgb("1e293b"), size: 8pt)[#ph.instructions],
        text(fill: rgb("334155"), size: 7.8pt)[#ph.deliverables.join("; ")],
      )).flatten()
    )
    #v(5pt)
  ]

  #grid(
    columns: (1fr, 1fr),
    gutter: 8pt,
    [
      #if "technicalSpecs" in proj and proj.technicalSpecs != none and proj.technicalSpecs.len() > 0 [
        #block(
          width: 100%,
          fill: rgb("f8fafc"),
          stroke: 0.5pt + rgb("cbd5e1"),
          radius: 4pt,
          inset: 6pt,
          [
            #text(fill: primary-color, weight: "bold", size: 8.5pt)[Especificaciones de Calidad]
            #v(2pt)
            #list(..proj.technicalSpecs.map(sp => text(size: 8pt, fill: rgb("1e293b"))[#sp]))
          ]
        )
      ]
    ],
    [
      #if "acceptanceCriteria" in proj and proj.acceptanceCriteria != none and proj.acceptanceCriteria.len() > 0 [
        #block(
          width: 100%,
          fill: rgb("f0fdf4"),
          stroke: 0.5pt + rgb("bbf7d0"),
          radius: 4pt,
          inset: 6pt,
          [
            #text(fill: rgb("166534"), weight: "bold", size: 8.5pt)[Criterios de Aceptación]
            #v(2pt)
            #list(..proj.acceptanceCriteria.map(ac => text(size: 8pt, fill: rgb("1e293b"))[#ac]))
          ]
        )
      ]
    ]
  )

  #v(6pt)
  #text(fill: primary-color, weight: "bold", size: 8.8pt)[Bitácora de Avance del Estudiante]
  #v(2pt)
  #table(
    columns: (60pt, 1.5fr, 1fr, 70pt),
    stroke: 0.5pt + rgb("cbd5e1"),
    inset: (x: 5pt, y: 6pt),
    fill: (_, row) => if row == 0 { primary-color.lighten(90%) } else { white },
    text(fill: primary-color, weight: "bold", size: 7.8pt)[Fecha],
    text(fill: primary-color, weight: "bold", size: 7.8pt)[Actividad Realizada / Evidencia],
    text(fill: primary-color, weight: "bold", size: 7.8pt)[Observación / Ajuste],
    text(fill: primary-color, weight: "bold", size: 7.8pt)[Vo.Bo.],
    ..range(12).map(_ => [#v(9pt)])
  )
]
