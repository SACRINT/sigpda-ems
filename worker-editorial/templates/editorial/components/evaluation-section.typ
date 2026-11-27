// components/evaluation-section.typ — Evaluación Formativa NEM (Rúbrica 4 Niveles + Cotejo + Metacognición)
// SIGPDA-EMS · Fase 3 Motor Editorial Unificado (PUBLISHING_ENGINE_V2)

#let render-evaluation-section(
  ev,
  primary-color: rgb("0f294a"),
  accent-color: rgb("c98a2c"),
  teal-color: rgb("0d766e"),
) = [
  #metadata((blockNumber: ev.blockNumber, rubricCount: ev.rubric.len())) <rendered-evaluation-section>
  #block(
    width: 100%,
    fill: teal-color,
    radius: 4pt,
    inset: (x: 10pt, y: 6pt),
    [
      #text(fill: white.darken(10%), weight: "bold", size: 8pt)[
        EVALUACIÓN FORMATIVA INTEGRAL NEM · BLOQUE #ev.blockNumber
      ]\
      #text(fill: white, weight: "bold", size: 12.5pt)[Rúbrica Analítica, Lista de Cotejo y Reflexión Metacognitiva]
    ]
  )
  #v(5pt)

  #if "rubric" in ev and ev.rubric != none and ev.rubric.len() > 0 [
    #text(fill: primary-color, weight: "bold", size: 9pt)[1. Rúbrica Analítica de Desempeño (4 Niveles)]
    #v(2pt)
    #table(
      columns: (1.05fr, 1fr, 1fr, 1fr, 1fr),
      stroke: 0.5pt + rgb("cbd5e1"),
      inset: 4pt,
      fill: (_, row) => if row == 0 { primary-color.lighten(88%) } else if calc.odd(row) { rgb("f8fafc") } else { white },
      text(fill: primary-color, weight: "bold", size: 7.6pt)[Criterio (Peso)],
      text(fill: rgb("166534"), weight: "bold", size: 7.6pt)[Excelente],
      text(fill: rgb("1d4ed8"), weight: "bold", size: 7.6pt)[Bueno],
      text(fill: rgb("b45309"), weight: "bold", size: 7.6pt)[Suficiente],
      text(fill: rgb("991b1b"), weight: "bold", size: 7.6pt)[Requiere Apoyo],
      ..ev.rubric.map(c => {
        let get-desc(name) = {
          let found = c.levels.find(l => l.levelName == name)
          if found != none { found.descriptor } else { "—" }
        }
        (
          text(fill: primary-color, weight: "bold", size: 7.6pt)[#c.criterion (#c.weightPercent%)],
          text(fill: rgb("1e293b"), size: 7.3pt)[#get-desc("Excelente")],
          text(fill: rgb("1e293b"), size: 7.3pt)[#get-desc("Bueno")],
          text(fill: rgb("1e293b"), size: 7.3pt)[#get-desc("Suficiente")],
          text(fill: rgb("1e293b"), size: 7.3pt)[#get-desc("Requiere Apoyo")],
        )
      }).flatten()
    )
    #v(5pt)
  ]

  #if "checklist" in ev and ev.checklist != none and ev.checklist.len() > 0 [
    #text(fill: primary-color, weight: "bold", size: 9pt)[2. Lista de Cotejo de Evidencias]
    #v(2pt)
    #table(
      columns: (2fr, 0.9fr, 34pt, 34pt),
      stroke: 0.5pt + rgb("cbd5e1"),
      inset: 4pt,
      fill: (_, row) => if row == 0 { primary-color.lighten(90%) } else if calc.odd(row) { rgb("f8fafc") } else { white },
      text(fill: primary-color, weight: "bold", size: 7.8pt)[Indicador Verificable],
      text(fill: primary-color, weight: "bold", size: 7.8pt)[Categoría],
      align(center)[#text(fill: primary-color, weight: "bold", size: 7.8pt)[Sí]],
      align(center)[#text(fill: primary-color, weight: "bold", size: 7.8pt)[No]],
      ..ev.checklist.map(item => (
        text(fill: rgb("1e293b"), size: 7.8pt)[#item.item],
        text(fill: rgb("475569"), size: 7.5pt)[#item.category],
        align(center)[#rect(width: 9pt, height: 9pt, stroke: 0.6pt + rgb("64748b"))],
        align(center)[#rect(width: 9pt, height: 9pt, stroke: 0.6pt + rgb("64748b"))],
      )).flatten()
    )
    #v(5pt)
  ]

  #if "quizQuestions" in ev and ev.quizQuestions != none and ev.quizQuestions.len() > 0 [
    #text(fill: primary-color, weight: "bold", size: 9pt)[3. Reactivos de Pensamiento Crítico (Para el Estudiante)]
    #v(2pt)
    #for q in ev.quizQuestions [
      #block(
        width: 100%,
        fill: rgb("f8fafc"),
        stroke: 0.5pt + rgb("cbd5e1"),
        radius: 3pt,
        inset: 5pt,
        spacing: 3pt,
        breakable: false,
        [
          #text(fill: primary-color, weight: "bold", size: 8pt)[Pregunta #q.questionNumber:] #text(fill: rgb("334155"), size: 8pt)[#q.scenario]\
          #text(fill: rgb("0f172a"), weight: "bold", size: 8.2pt)[#q.question]
          #if "options" in q and q.options != none and q.options.len() > 0 [
            #v(2pt)
            #for opt in q.options [
              #text(fill: rgb("334155"), size: 7.8pt)[○ #opt]\
            ]
          ]
        ]
      )
    ]
    #v(4pt)
  ]

  #if "reflectionPrompts" in ev and ev.reflectionPrompts != none and ev.reflectionPrompts.len() > 0 [
    #block(
      width: 100%,
      fill: rgb("faf5ff"),
      stroke: (left: 3pt + accent-color, rest: 0.5pt + rgb("e9d5ff")),
      radius: (right: 4pt),
      inset: 6pt,
      breakable: false,
      [
        #text(fill: primary-color, weight: "bold", size: 8.8pt)[4. Semáforo y Reflexión Metacognitiva]
        #v(2pt)
        #for prompt in ev.reflectionPrompts [
          #text(fill: rgb("1e293b"), size: 8.1pt)[• #prompt]
          #v(8pt)
          #line(length: 100%, stroke: (paint: rgb("cbd5e1"), thickness: 0.5pt, dash: "dotted"))
          #v(3pt)
        ]
      ]
    )
  ]
]
