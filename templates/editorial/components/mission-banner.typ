// components/mission-banner.typ — Encuadre Visual de las 4 Misiones Pedagógicas
// SIGPDA-EMS · Fase 3 Motor Editorial Unificado (PUBLISHING_ENGINE_V2)

#let render-mission-banner(
  mission,
  chapter,
  primary-color: rgb("0f294a"),
  accent-color: rgb("c98a2c"),
) = [
  #metadata((blockNumber: mission.blockNumber, missionIndex: mission.missionIndex, title: mission.title)) <rendered-mission>
  #let assets-root = if "assetsRoot" in chapter and chapter.assetsRoot != none { chapter.assetsRoot } else { "/public" }
  #let has-scene = "scene" in mission and mission.scene != none
  #block(
    width: 100%,
    fill: primary-color.lighten(93%),
    stroke: (left: 4pt + accent-color, rest: 0.6pt + primary-color.lighten(70%)),
    radius: (right: 5pt),
    inset: 8pt,
    spacing: 5pt,
    breakable: false,
    [
      #grid(
        columns: if has-scene { (1fr, 4.4cm) } else { (1fr,) },
        gutter: 10pt,
        [
          #rect(
            fill: primary-color,
            radius: 2pt,
            inset: (x: 5pt, y: 2pt),
            [#text(fill: white, weight: "bold", size: 7.6pt)[
              BLOQUE #mission.blockNumber · MISIÓN #mission.missionIndex · #upper(mission.stageLabel)
            ]]
          )
          #v(3pt)
          #text(fill: primary-color, weight: "bold", size: 11pt)[#mission.title]\
          #text(fill: rgb("475569"), size: 8pt)[
            Sesiones #mission.startSession a #mission.endSession
          ]
          #if "realLifeContext" in mission and mission.realLifeContext != none and mission.realLifeContext != "" [
            #v(3pt)
            #text(fill: rgb("1e293b"), size: 8.3pt)[
              *Conexión con tu entorno:* #mission.realLifeContext
            ]
          ]
        ],
        ..if has-scene {
          (
            align(horizon)[
              #block(
                width: 100%,
                radius: 4pt,
                clip: true,
                stroke: 0.5pt + rgb("cbd5e1"),
                [#image(assets-root + mission.scene.relativePath, width: 100%, height: 2.5cm, fit: "cover")]
              )
            ],
          )
        } else { () }
      )
    ]
  )
  #v(4pt)
]
