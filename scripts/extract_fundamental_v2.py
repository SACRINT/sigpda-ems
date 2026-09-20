# -*- coding: utf-8 -*-
r"""
extract_fundamental_v2.py
Extractor especializado y robusto con PyMuPDF para las 31 UACs del Currículum Fundamental (BGE 2025-2028).

Características clave:
1. Heurística estricta de encabezados: regex r'^\s*Tabla\s+\d+' para evitar falsos positivos
   en contenidos legítimos como "Tablas de verdad" (Pensamiento Matemático I).
2. Prevención de fugas de encabezados de columnas ("Propósitos formativos", "Contenidos formativos").
3. Distribución exacta de horas mediante residuo matemático (sum(hours) == total_hours garantizado).
4. Voronoi 1D / Nearest-Neighbor para asignación de bloques de contenidos a propósitos en la misma página.
5. Fusión de líneas fragmentadas (merge_fragmented_lines) respetando conectores y guiones léxicos.
6. Logging granular detallado por cada Propósito Formativo y sus contenidos asociados.
7. Genera 'curriculum_fundamental_v2.json' y actualiza de manera segura las 31 UACs en 'curriculum_canonical_203.json'.
"""

import fitz
import unicodedata
import re
import os
import sys
import json
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def get_safe_path(p):
    s = os.path.abspath(str(p))
    if os.name == 'nt' and not s.startswith('\\\\?\\'):
        return '\\\\?\\' + s
    return s

def strip_accents(text):
    if not text: return ""
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def remove_line_hyphens(text):
    """Une palabras partidas por salto de línea o espacios sin romper guiones legítimos."""
    if not text: return ""
    text = text.replace("\u00ad", "")  # Soft hyphen
    # 1. Guión seguido de salto de línea
    text = re.sub(r'([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)-\s*[\r\n]+\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)', r'\1\2', text)
    # 2. Guión seguido de espacios (palabra partida artificialmente)
    text = re.sub(r'([a-zA-ZáéíóúñÁÉÍÓÚÑ]{2,})-\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ]{2,})', r'\1\2', text)
    return text

DANGLING_CONNECTORS = {
    'de', 'del', 'al', 'a', 'para', 'por', 'con', 'en', 'o', 'y', 'e', 'u',
    'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'su', 'sus'
}

def merge_fragmented_lines(raw_lines):
    """Une líneas fragmentadas del PDF: guiones finales, fragmentos cortos y continuaciones gramaticales."""
    if not raw_lines:
        return []
        
    merged = []
    for raw in raw_lines:
        if not raw or not raw.strip():
            continue
        line = raw.strip()
        
        if not merged:
            merged.append(line)
            continue
            
        prev = merged[-1]
        
        # 1. Si la línea anterior termina con guión (ej: 'mate-', 'ecuacio-'), unir directamente sin guión
        if prev.endswith('-'):
            merged[-1] = prev[:-1] + line
            continue
            
        # Determinar si la línea anterior termina en conector colgante
        ends_with_closing = prev.rstrip().endswith((')', ']', '}', '"', '»', '.', ':', ';'))
        last_word = prev.split()[-1].lower() if prev.split() else ''
        last_word_clean = re.sub(r'[^\wáéíóúñ]', '', last_word)
        ends_with_connector = not ends_with_closing and (last_word_clean in DANGLING_CONNECTORS)
        
        # Determinar si la línea actual inicia con minúscula
        starts_with_lower = len(line) > 0 and line[0].islower()
        
        # Regla: Continuación por minúscula o conector colgante
        if (starts_with_lower or ends_with_connector) and not ends_with_closing:
            merged[-1] = prev + ' ' + line
        else:
            merged.append(line)
            
    cleaned = []
    for item in merged:
        c = clean(item)
        if len(c) > 3:
            cleaned.append(c)
            
    return cleaned

def clean(t):
    if not t: return ""
    t = remove_line_hyphens(t)
    t = t.replace("\xa0", " ").replace("\r\n", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", t).strip()

def normalize_key(t):
    return strip_accents(clean(t)).lower()

# ── Catálogo Pedagógico de Evidencias Oficiales contextualizadas ──────────────
EVIDENCE_MAP_BY_SEMESTER = {
    "pensamiento matematico": {
        1: [
            "Problemario de operaciones con números reales, jerarquía de operaciones y razonamiento lógico",
            "Proyecto de aplicación de fracciones, porcentajes y proporciones en situaciones cotidianas",
            "Portafolio de ejercicios de potenciación, radicación y sistemas numéricos",
        ],
        2: [
            "Problemario de expresiones algebraicas, productos notables y factorización",
            "Proyecto de traducción de situaciones cotidianas al lenguaje algebraico",
            "Portafolio de operaciones con monomios, binomios y polinomios",
        ],
        3: [
            "Problemario de ecuaciones lineales y cuadráticas con aplicación contextualizada",
            "Reporte de resolución de sistemas de ecuaciones por múltiples métodos (igualación, sustitución, gráfico)",
            "Proyecto de modelación algebraica y representación gráfica de funciones lineales",
        ],
        4: [
            "Problemario de funciones trigonométricas y resolución de triángulos",
            "Proyecto de aplicación de geometría analítica (rectas, circunferencia, parábola) en contextos reales",
            "Portafolio de gráficas de funciones polinomiales y cónicas en el plano cartesiano",
        ],
        5: [
            "Problemario de cálculo de límites, derivadas y aplicaciones de optimización",
            "Proyecto de modelación de fenómenos de cambio con funciones y derivadas",
            "Reporte de investigación aplicada sobre razón de cambio en contextos de física o economía",
        ],
        6: [
            "Proyecto de recolección, organización y análisis estadístico de datos reales",
            "Reporte de investigación con aplicación de medidas de tendencia central y dispersión",
            "Problemario de probabilidad, combinatoria y distribuciones aplicadas a situaciones del entorno",
        ],
    },
    "ciencias naturales": {
        1: [
            "Reporte de práctica experimental sobre propiedades de la materia y transformaciones de energía",
            "Infografía explicativa del método científico aplicado a fenómenos cotidianos",
            "Portafolio de observaciones y registro de fenómenos naturales",
        ],
        2: [
            "Reporte de laboratorio sobre transferencia de calor, ondas y circuitos eléctricos",
            "Proyecto de investigación sobre fuentes de energía renovable y sustentabilidad",
            "Maqueta o prototipo funcional que demuestre principios de transformación energética",
        ],
        3: [
            "Proyecto de investigación sobre problemáticas ambientales locales y propuesta de solución",
            "Infografía de ciclos biogeoquímicos y su impacto en el ecosistema de la comunidad",
            "Plan de acción comunitaria para la sustentabilidad y cuidado del entorno",
        ],
        4: [
            "Reporte de práctica de laboratorio sobre reacciones químicas y estequiometría",
            "Proyecto de investigación sobre aplicaciones de la química en la vida cotidiana",
            "Portafolio de ejercicios de balanceo de ecuaciones y clasificación de compuestos",
        ],
        5: [
            "Reporte de investigación sobre modelos atómicos y su evolución histórica",
            "Proyecto de divulgación científica sobre fenómenos de física moderna (radioactividad, partículas)",
            "Infografía de la estructura del átomo y su relación con las propiedades de los materiales",
        ],
        6: [
            "Proyecto de investigación sobre biodiversidad local y estrategias de conservación",
            "Reporte sobre mecanismos de evolución y adaptación en especies de la región",
            "Infografía de procesos celulares (fotosíntesis, respiración) y su importancia ecológica",
        ],
    },
    "ciencias sociales": {
        1: [
            "Ensayo argumentativo sobre derechos ciudadanos y participación democrática",
            "Debate estructurado sobre relaciones de poder y formas de gobierno",
            "Portafolio de análisis de casos de ciudadanía activa en la comunidad",
        ],
        2: [
            "Reporte de investigación sobre dinámicas socioeconómicas de la localidad",
            "Cartografía social comunitaria con análisis de desigualdad y organización social",
            "Proyecto de propuesta de mejora comunitaria con enfoque de justicia social",
        ],
        4: [
            "Ensayo crítico sobre la condición estudiantil y las problemáticas juveniles contemporáneas",
            "Investigación de campo sobre dinámicas sociales actuales en el entorno escolar",
            "Propuesta de intervención social con enfoque de derechos humanos y bienestar comunitario",
        ],
    },
    "conciencia historica": {
        4: [
            "Línea de tiempo analítica de procesos históricos con fuentes primarias",
            "Ensayo de interpretación histórica sobre el concepto de tiempo y cambio social",
            "Portafolio de análisis de fuentes históricas (documentales, iconográficas, orales)",
        ],
        5: [
            "Ensayo crítico sobre memoria colectiva, identidad y patrimonio cultural local",
            "Investigación sobre experiencias históricas de transformación social en México",
            "Exposición temática sobre coyunturas históricas con análisis de multicausalidad",
        ],
        6: [
            "Proyecto de investigación histórica con metodología y análisis de fuentes",
            "Ensayo de historia regional que vincule pasado-presente con la comunidad",
            "Portafolio de investigaciones históricas con reflexión sobre identidad nacional",
        ],
    },
    "cultura digital": {
        1: [
            "Proyecto de ciudadanía digital, ciberseguridad y uso ético de la información",
            "Infografía sobre identidad digital, privacidad y huella digital responsable",
            "Portafolio de prácticas de búsqueda, verificación y curación de información en línea",
        ],
        2: [
            "Desarrollo de producto multimedia colaborativo en entornos virtuales",
            "Proyecto de aprendizaje colaborativo usando herramientas digitales (documentos, presentaciones)",
            "Portafolio digital de aplicaciones ofimáticas y herramientas de productividad",
        ],
        6: [
            "Solución algorítmica o prototipo computacional funcional para un problema del entorno",
            "Proyecto de difusión del conocimiento mediante plataformas y medios digitales",
            "Portafolio de creación de contenido digital (video, podcast, sitio web) con propósito educativo",
        ],
    },
    "lengua y comunicacion": {
        1: [
            "Portafolio de lectura comprensiva con fichas de análisis de textos diversos",
            "Texto argumentativo breve de composición propia con estructura clara",
            "Proyecto de comunicación oral: exposición o debate sobre temas de interés estudiantil",
        ],
        2: [
            "Texto narrativo o descriptivo de autoría propia (cuento, crónica, relato personal)",
            "Antología comentada de narrativas populares y sus adaptaciones modernas",
            "Proyecto creativo de expresión escrita y oral (podcast, monólogo, recital)",
        ],
        3: [
            "Reseña crítica de una obra literaria con análisis de movimiento y género literario",
            "Antología comentada de textos literarios de diferentes movimientos culturales",
            "Ensayo de análisis literario sobre la función social de la literatura en la comunidad",
        ],
    },
    "ingles": {
        1: [
            "Diálogo oral estructurado sobre presentaciones personales y rutinas cotidianas (Speaking A1)",
            "Compilador de textos descriptivos breves sobre personas, lugares y objetos (Writing A1)",
            "Bitácora de comprensión auditiva de instrucciones y conversaciones simples (Listening A1)",
        ],
        2: [
            "Narrativa breve en pasado simple sobre una experiencia personal (Writing A1-A2)",
            "Dramatización de una historia o cuento adaptado en lengua inglesa (Speaking A1-A2)",
            "Portafolio de lectura comprensiva de textos narrativos breves en inglés (Reading A1-A2)",
        ],
        3: [
            "Texto descriptivo y comparativo sobre su comunidad o entorno (Writing A2)",
            "Exposición oral con apoyo visual sobre un tema de interés (Speaking A2)",
            "Bitácora de comprensión auditiva de materiales auténticos y medios digitales (Listening A2)",
        ],
        4: [
            "Ensayo breve argumentativo sobre un tema social o cultural en lengua inglesa (Writing A2+)",
            "Debate o mesa redonda sobre planes futuros y problemáticas juveniles (Speaking A2+)",
            "Portafolio de análisis de textos informativos y artículos breves en inglés (Reading A2+)",
        ],
    },
    "humanidades": {
        1: [
            "Bitácora reflexiva sobre la experiencia humana y el sentido del presente",
            "Disertación filosófica sobre dilemas éticos y existenciales del entorno cotidiano",
            "Diálogo socrático sobre la relación ser humano–naturaleza–comunidad",
        ],
        2: [
            "Ensayo filosófico sobre la convivencia, la alteridad y el reconocimiento del otro",
            "Debate ético sobre problemáticas de justicia social y derechos humanos",
            "Manifiesto ético-comunitario fundamentado en la convivencia democrática",
        ],
        3: [
            "Disertación filosófica sobre el sentido de la vida y proyectos de trascendencia personal",
            "Análisis crítico de textos humanísticos sobre la libertad, la finitud y la trascendencia",
            "Portafolio reflexivo con diálogos filosóficos sobre identidad, vocación y proyecto de vida",
        ],
    },
}

def get_contextual_evidences(uac_name, topic="", semester=None):
    combined = strip_accents(f"{uac_name} {topic}").lower()
    for key, sem_map in EVIDENCE_MAP_BY_SEMESTER.items():
        if key in combined:
            if semester is not None and semester in sem_map:
                return sem_map[semester]
            first_key = next(iter(sem_map))
            return sem_map[first_key]
    return [
        f"Proyecto formativo integrador de {uac_name}",
        "Portafolio de evidencias y rúbrica de evaluación formativa"
    ]

# ── Rutas Base ────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
DATA_DIR = SCRIPT_DIR / "data"

MASTER_PATH = DATA_DIR / "uacs_master_203.json"
CANONICAL_PATH = DATA_DIR / "curriculum_canonical_203.json"
OUTPUT_V2_PATH = DATA_DIR / "curriculum_fundamental_v2.json"

FUND_DIR = Path(r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Currículum Fundamental")

# Cargar catálogo maestro para horas y metadatos oficiales
MASTER_MAP = {}
if MASTER_PATH.exists():
    with open(MASTER_PATH, "r", encoding="utf-8") as f:
        master_data = json.load(f)
        for u in master_data:
            k = (normalize_key(u['uac_name']), u['semester'])
            MASTER_MAP[k] = u

def get_master_uac(name, sem):
    k = (normalize_key(name), sem)
    if k in MASTER_MAP:
        return MASTER_MAP[k]
    norm_name = normalize_key(name)
    for (nk, s), val in MASTER_MAP.items():
        if s == sem and (nk in norm_name or norm_name in nk):
            return val
    return None

# Definición de los 8 libros oficiales y sus 31 UACs
BOOKS_MAP = {
    "2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf": [
        (1, "Pensamiento Matemático I", "Pensamiento aritmético", 72),
        (2, "Pensamiento Matemático II", "Introducción al álgebra", 72),
        (3, "Pensamiento Matemático III", "Pensamiento algebraico e introducción a geometría plana", 72),
        (4, "Pensamiento Matemático IV", "Trigonometría y geometría analítica", 64),
        (5, "Pensamiento Matemático V", "Cálculo diferencial", 64),
        (6, "Pensamiento Matemático VI", "Pensamiento estadístico y probabilístico", 64),
    ],
    "2025_MCC_CIENCIAS NATURALES_BN.pdf": [
        (1, "Ciencias Naturales, Experimentales y Tecnología I", "Invitación a la ciencia", 72),
        (2, "Ciencias Naturales, Experimentales y Tecnología II", "El poder de la energía", 72),
        (3, "Ciencias Naturales, Experimentales y Tecnología III", "Nuestro hogar", 72),
        (4, "Ciencias Naturales, Experimentales y Tecnología IV", "El poder de la química", 72),
        (5, "Ciencias Naturales, Experimentales y Tecnología V", "Del átomo al universo", 72),
        (6, "Ciencias Naturales, Experimentales y Tecnología VI", "¿Qué es la vida? Evolución y biodiversidad", 72),
    ],
    "2025_ MCC_CIENCIAS SOCIALES_BN.pdf": [
        (1, "Ciencias Sociales I", "Estado, ciudadanía y relaciones de poder", 36),
        (2, "Ciencias Sociales II", "Organización, relaciones sociales y económicas", 36),
        (4, "Ciencias Sociales III", "Las dinámicas de la realidad actual: la condición estudiantil", 72),
    ],
    "2025_ MCC_CONCIENCIA HISTORICA_BN.pdf": [
        (4, "Conciencia Histórica I", "Coordenadas de la Historia", 54),
        (5, "Conciencia Histórica II", "La experiencia histórica", 54),
        (6, "Conciencia Histórica III", "Navegar en el tiempo: investigaciones históricas", 54),
    ],
    "2025_ MCC_CULTURA DIGITAL_BN.pdf": [
        (1, "Cultura Digital I", "Ciudadanía digital", 54),
        (2, "Cultura Digital II", "Aprendizaje individual y colaborativo", 36),
        (6, "Cultura Digital III", "Uso y difusión del conocimiento", 36),
    ],
    "2025_ MCC_LENGUA Y COMUNICACION_BN.pdf": [
        (1, "Lengua y Comunicación I", "Leer y escribir para pensarnos juntos", 54),
        (2, "Lengua y Comunicación II", "Libertad para imaginar, poder para comunicar", 54),
        (3, "Lengua y Comunicación III", "Describir culturas, apropiarse de las palabras", 54),
    ],
    "2025_ MCC_MCC_INGLES_BN.pdf": [
        (1, "Inglés I", "To be, or not to be, that is the question (A1)", 54),
        (2, "Inglés II", "Once upon a time (A1-A2)", 54),
        (3, "Inglés III", "A picture is worth a thousand words (A2)", 54),
        (4, "Inglés IV", "Life is a journey, not a destination (A2+)", 54),
    ],
    "2025_MCC_PENSAMIENTO FILOSOFICO_BN.pdf": [
        (1, "Humanidades I", "Vivir aquí y ahora", 72),
        (2, "Humanidades II", "Estar juntos", 72),
        (3, "Humanidades III", "El sentido de la vida", 90),
    ]
}

def extract_all_fundamentals():
    print("=" * 65)
    print("🚀 EXTRACTOR FUNDAMENTAL V2 (PyMuPDF Mejorado)")
    print("   Total UACs objetivo: 31 fundamentales (Semestres 1 a 6)")
    print("=" * 65 + "\n")

    if not FUND_DIR.exists():
        print(f"❌ ERROR: Directorio fundamental no encontrado: {FUND_DIR}")
        sys.exit(1)

    extracted_uacs = []

    for filename, uac_specs in BOOKS_MAP.items():
        filepath = FUND_DIR / filename
        if not filepath.exists():
            print(f"⚠️  ADVERTENCIA: Archivo no encontrado: {filepath.name}")
            continue

        print(f"\n📘 Procesando libro: {filename}")
        print("-" * 65)
        safe_path = get_safe_path(filepath)
        doc = fitz.open(safe_path)

        for u_idx, (sem, uac_name, topic, default_hrs) in enumerate(uac_specs):
            target_page = 13 + (u_idx * 2)
            if target_page >= len(doc):
                print(f"  ⚠️ Página {target_page} fuera de rango para {uac_name}")
                continue

            p1 = doc[target_page]
            p2 = doc[target_page + 1] if target_page + 1 < len(doc) else None

            # Extracción de Meta Educativa
            p1_text = p1.get_text()
            table_split = re.split(r'Tabla\s+\d+', p1_text, flags=re.I)
            table_text = table_split[-1] if len(table_split) > 1 else p1_text
            meta_m = re.search(r'Meta educativa(?:\s+de la UAC)?\s*[:\s]*([\s\S]+?)(?:Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|Horas/semana|Propósitos formativos|Tabla\s+\d+)', table_text, re.I)
            if not meta_m:
                meta_m = re.search(r'Meta educativa(?:\s+de la UAC)?\s*[:\s]*([\s\S]+?)(?:Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|Horas/semana|Propósitos formativos|Tabla\s+\d+)', p1_text, re.I)
            if not meta_m and target_page > 0:
                comb_text = doc[target_page-1].get_text() + p1_text
                meta_m = re.search(r'Meta educativa(?:\s+de la UAC)?\s*[:\s]*([\s\S]+?)(?:Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|Horas/semana|Propósitos formativos|Tabla\s+\d+)', comb_text, re.I)
            
            meta_educativa = clean(meta_m.group(1)) if meta_m else None
            if meta_educativa and len(meta_educativa) > 350:
                meta_educativa = meta_educativa[:350].rsplit('.', 1)[0] + '.'

            b1 = p1.get_text("blocks")
            b2 = p2.get_text("blocks") if p2 else []

            props = []
            conts = []

            # Filtrado estricto en página 1
            for b in b1:
                # Heurística estricta: filtrar metadatos de tabla sin importar coordenadas y
                if re.search(r'^\s*Tabla\s+\d+', b[4], re.I) or "Nombre de" in b[4] or "Meta educativa" in b[4] or "Horas/semana" in b[4]:
                    continue
                if b[1] > 740:
                    continue
                btext = b[4].strip()
                # Filtrar encabezados de columna
                if re.search(r'Propósitos\s+formativos|Contenidos\s+formativos', btext, re.I) and len(btext) < 70:
                    continue
                
                # Columna izquierda = propósitos (x < 310), Columna derecha = contenidos (x >= 310)
                if b[0] < 310:
                    props.append((b[1], btext))
                else:
                    conts.append((b[1], btext))

            # Filtrado en página 2 si la tabla continúa
            if p2:
                p2_text = strip_accents(p2.get_text()).lower()
                if "fuente:" in p2_text or "propositos formativos" in p2_text or (b2 and any(b[1] < 400 and b[0] < 310 for b in b2)):
                    for b in b2:
                        if b[1] < 120 or b[1] > 740:
                            continue
                        btext = b[4].strip()
                        if 'Fuente:' in btext:
                            continue
                        if re.search(r'Propósitos\s+formativos|Contenidos\s+formativos', btext, re.I) and len(btext) < 70:
                            continue
                        if b[0] < 310:
                            props.append((b[1] + 1000, btext))
                        else:
                            conts.append((b[1] + 1000, btext))

            # Parsear Propósitos Formativos numerados
            parsed_items = []
            for y, text in props:
                m_num = re.match(r'^(\d{1,2})\s+([A-ZÁÉÍÓÚ].*)', text, re.DOTALL)
                if m_num:
                    order = int(m_num.group(1))
                    prop_text = clean(m_num.group(2))
                    parsed_items.append({'order': order, 'y': y, 'prop': prop_text, 'conts': []})
                elif parsed_items:
                    cleaned_t = clean(text)
                    if not re.search(r'Propósitos\s+formativos|Contenidos\s+formativos|Fuente:', cleaned_t, re.I):
                        parsed_items[-1]['prop'] += " " + cleaned_t

            # Voronoi 1D / Nearest-Neighbor en la misma página
            for ry, rtext in conts:
                same_page_props = [lg for lg in parsed_items if (lg['y'] < 1000) == (ry < 1000)]
                closest_lg = min(same_page_props, key=lambda lg: abs(lg['y'] - ry)) if same_page_props else (
                    min(parsed_items, key=lambda lg: abs(lg['y'] - ry)) if parsed_items else None
                )
                if closest_lg:
                    raw_lines = [l.strip() for l in rtext.split('\n') if l.strip()]
                    closest_lg['conts'].extend(raw_lines)

            # Obtener horas maestras y modelo pedagógico
            m_uac = get_master_uac(uac_name, sem)
            final_hrs = m_uac['total_hours'] if m_uac and 'total_hours' in m_uac else default_hrs
            n_items = len(parsed_items)

            # Distribución de horas exacta por residuo matemático
            base_hrs = final_hrs // n_items if n_items else 0
            rem_hrs = final_hrs % n_items if n_items else 0

            parsed_items.sort(key=lambda x: x['order'])

            activities = []
            contenidos_formativos = []

            print(f"  📌 {uac_name} (Semestre {sem}, Total {final_hrs}h, {n_items} PFs):")

            for idx, p in enumerate(parsed_items):
                act_hrs = base_hrs + (1 if idx < rem_hrs else 0)
                activities.append({
                    "order": p['order'],
                    "name": p['prop'],
                    "hours": act_hrs
                })

                merged_conts = merge_fragmented_lines(p['conts'])
                unique_conts = []
                for c in merged_conts:
                    if c not in unique_conts and len(c) > 3:
                        unique_conts.append(c)

                # Fallback defensivo si no se capturaron contenidos
                final_conts = unique_conts if unique_conts else [p['prop']]

                contenidos_formativos.append({
                    "order": p['order'],
                    "proposito": p['prop'],
                    "contenidos": final_conts
                })

                # Logging detallado por PF
                print(f"     • [PF {p['order']}] {p['prop'][:55]}... ({len(final_conts)} contenidos, {act_hrs}h)")
                for c_item in final_conts:
                    print(f"         - {c_item[:70]}")

            evidences = get_contextual_evidences(uac_name, topic, semester=sem)

            extracted_uacs.append({
                "uac_name": uac_name,
                "semester": sem,
                "component": "fundamental",
                "subsystem": "bge",
                "total_hours": final_hrs,
                "learning_outcome": meta_educativa,
                "activities": activities,
                "evidences": evidences,
                "contenidos_formativos": contenidos_formativos if contenidos_formativos else None,
                "model_type": "progresiones" if sem >= 5 else "propositos_contenidos",
                "year": 2025,
                "curriculum_name": topic
            })

    print("\n" + "=" * 65)
    print(f"✨ Extracción fundamental finalizada: {len(extracted_uacs)} UACs procesadas.")
    print("=" * 65)

    return extracted_uacs

def main():
    # 1. Extraer las 31 UACs fundamentales
    fund_uacs = extract_all_fundamentals()

    # 2. Guardar archivo independiente fundamental v2
    with open(OUTPUT_V2_PATH, "w", encoding="utf-8") as f:
        json.dump(fund_uacs, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Archivo fundamental v2 guardado en: {OUTPUT_V2_PATH}")

    # 3. Actualizar de forma limpia y segura el archivo canónico principal
    if CANONICAL_PATH.exists():
        with open(CANONICAL_PATH, "r", encoding="utf-8") as f:
            canonical_data = json.load(f)

        print(f"📖 Cargado canonical existente ({len(canonical_data)} UACs en total).")

        # Mapear las nuevas fundamentales por (uac_name normalizado, semester)
        new_fund_map = {
            (normalize_key(u['uac_name']), u['semester']): u
            for u in fund_uacs
        }

        updated_canonical = []
        replaced_count = 0

        for item in canonical_data:
            if item.get('component') == 'fundamental':
                k = (normalize_key(item['uac_name']), item['semester'])
                if k in new_fund_map:
                    updated_canonical.append(new_fund_map[k])
                    replaced_count += 1
                else:
                    updated_canonical.append(item)
            else:
                # Laboral, optativas, ffeo, socioemocionales permanecen 100% INTACTOS
                updated_canonical.append(item)

        print(f"🔄 Reemplazadas {replaced_count} UACs fundamentales en canonical (los otros {len(canonical_data) - replaced_count} registros permanecen intactos).")

        with open(CANONICAL_PATH, "w", encoding="utf-8") as f:
            json.dump(updated_canonical, f, ensure_ascii=False, indent=2)
        print(f"✅ Archivo principal actualizado: {CANONICAL_PATH} ({len(updated_canonical)} registros).")
    else:
        print(f"⚠️  No se encontró canonical existente en {CANONICAL_PATH}; solo se guardó v2.")

if __name__ == "__main__":
    main()
