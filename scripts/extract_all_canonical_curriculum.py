# -*- coding: utf-8 -*-
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
    """Une palabras partidas por salto de línea o espacios SIN romper guiones compuestos legítimos."""
    if not text: return ""
    text = text.replace("\u00ad", "")  # Soft hyphen
    # 1. Guión seguido de salto de línea
    text = re.sub(r'([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)-\s*[\r\n]+\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)', r'\1\2', text)
    # 2. Guión seguido de espacios (palabra partida artificialmente por salto de línea previo)
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
            
        # Determinar si la línea anterior termina en conector colgante (nunca si termina en cierre de paréntesis o puntuación)
        ends_with_closing = prev.rstrip().endswith((')', ']', '}', '"', '»', '.', ':', ';'))
        last_word = prev.split()[-1].lower() if prev.split() else ''
        last_word_clean = re.sub(r'[^\wáéíóúñ]', '', last_word)
        ends_with_connector = not ends_with_closing and (last_word_clean in DANGLING_CONNECTORS)
        
        # Determinar si la línea actual inicia con minúscula
        starts_with_lower = len(line) > 0 and line[0].islower()
        
        # Regla 2 y 3: Continuación por minúscula o conector colgante
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

EVIDENCE_MAP_BY_SEMESTER = {
    # ── Pensamiento Matemático ──────────────────────────────────────────────────
    "pensamiento matematico": {
        1: [  # PM I: Aritmética — lógica, conteo, naturales, enteros, fracciones, potencias, raíces, medición
            "Problemario de operaciones con números reales, jerarquía de operaciones y razonamiento lógico",
            "Proyecto de aplicación de fracciones, porcentajes y proporciones en situaciones cotidianas",
            "Portafolio de ejercicios de potenciación, radicación y sistemas numéricos",
        ],
        2: [  # PM II: Pre-álgebra — lenguaje algebraico, monomios, polinomios, productos notables, factorización
            "Problemario de expresiones algebraicas, productos notables y factorización",
            "Proyecto de traducción de situaciones cotidianas al lenguaje algebraico",
            "Portafolio de operaciones con monomios, binomios y polinomios",
        ],
        3: [  # PM III: Álgebra y geometría plana — ecuaciones lineales, cuadráticas, sistemas, Pitágoras
            "Problemario de ecuaciones lineales y cuadráticas con aplicación contextualizada",
            "Reporte de resolución de sistemas de ecuaciones por múltiples métodos (igualación, sustitución, gráfico)",
            "Proyecto de modelación algebraica y representación gráfica de funciones lineales",
        ],
        4: [  # PM IV: Trigonometría y geometría analítica — rectas, funciones trigonométricas, cónicas
            "Problemario de funciones trigonométricas y resolución de triángulos",
            "Proyecto de aplicación de geometría analítica (rectas, circunferencia, parábola) en contextos reales",
            "Portafolio de gráficas de funciones polinomiales y cónicas en el plano cartesiano",
        ],
        5: [  # PM V: Cálculo diferencial — límites, derivadas, optimización
            "Problemario de cálculo de límites, derivadas y aplicaciones de optimización",
            "Proyecto de modelación de fenómenos de cambio con funciones y derivadas",
            "Reporte de investigación aplicada sobre razón de cambio en contextos de física o economía",
        ],
        6: [  # PM VI: Estadística y probabilidad — datos, probabilidad, distribuciones
            "Proyecto de recolección, organización y análisis estadístico de datos reales",
            "Reporte de investigación con aplicación de medidas de tendencia central y dispersión",
            "Problemario de probabilidad, combinatoria y distribuciones aplicadas a situaciones del entorno",
        ],
    },
    # ── Ciencias Naturales, Experimentales y Tecnología ─────────────────────────
    "ciencias naturales": {
        1: [  # CNEyT I: Invitación a la ciencia — método científico, materia, energía
            "Reporte de práctica experimental sobre propiedades de la materia y transformaciones de energía",
            "Infografía explicativa del método científico aplicado a fenómenos cotidianos",
            "Portafolio de observaciones y registro de fenómenos naturales",
        ],
        2: [  # CNEyT II: El poder de la energía — termodinámica, ondas, electricidad
            "Reporte de laboratorio sobre transferencia de calor, ondas y circuitos eléctricos",
            "Proyecto de investigación sobre fuentes de energía renovable y sustentabilidad",
            "Maqueta o prototipo funcional que demuestre principios de transformación energética",
        ],
        3: [  # CNEyT III: Nuestro hogar — ecosistemas, ciclos biogeoquímicos, sustentabilidad
            "Proyecto de investigación sobre problemáticas ambientales locales y propuesta de solución",
            "Infografía de ciclos biogeoquímicos y su impacto en el ecosistema de la comunidad",
            "Plan de acción comunitaria para la sustentabilidad y cuidado del entorno",
        ],
        4: [  # CNEyT IV: El poder de la química — tabla periódica, enlaces, reacciones
            "Reporte de práctica de laboratorio sobre reacciones químicas y estequiometría",
            "Proyecto de investigación sobre aplicaciones de la química en la vida cotidiana",
            "Portafolio de ejercicios de balanceo de ecuaciones y clasificación de compuestos",
        ],
        5: [  # CNEyT V: Del átomo al universo — física moderna, estructura atómica
            "Reporte de investigación sobre modelos atómicos y su evolución histórica",
            "Proyecto de divulgación científica sobre fenómenos de física moderna (radioactividad, partículas)",
            "Infografía de la estructura del átomo y su relación con las propiedades de los materiales",
        ],
        6: [  # CNEyT VI: ¿Qué es la vida? — biología, evolución, biodiversidad
            "Proyecto de investigación sobre biodiversidad local y estrategias de conservación",
            "Reporte sobre mecanismos de evolución y adaptación en especies de la región",
            "Infografía de procesos celulares (fotosíntesis, respiración) y su importancia ecológica",
        ],
    },
    # ── Ciencias Sociales ───────────────────────────────────────────────────────
    "ciencias sociales": {
        1: [  # CS I: Estado, ciudadanía y relaciones de poder
            "Ensayo argumentativo sobre derechos ciudadanos y participación democrática",
            "Debate estructurado sobre relaciones de poder y formas de gobierno",
            "Portafolio de análisis de casos de ciudadanía activa en la comunidad",
        ],
        2: [  # CS II: Organización, relaciones sociales y económicas
            "Reporte de investigación sobre dinámicas socioeconómicas de la localidad",
            "Cartografía social comunitaria con análisis de desigualdad y organización social",
            "Proyecto de propuesta de mejora comunitaria con enfoque de justicia social",
        ],
        4: [  # CS III: Las dinámicas de la realidad actual — condición estudiantil (sem 4)
            "Ensayo crítico sobre la condición estudiantil y las problemáticas juveniles contemporáneas",
            "Investigación de campo sobre dinámicas sociales actuales en el entorno escolar",
            "Propuesta de intervención social con enfoque de derechos humanos y bienestar comunitario",
        ],
    },
    # ── Conciencia Histórica ────────────────────────────────────────────────────
    "conciencia historica": {
        4: [  # CH I: Coordenadas de la Historia (sem 4)
            "Línea de tiempo analítica de procesos históricos con fuentes primarias",
            "Ensayo de interpretación histórica sobre el concepto de tiempo y cambio social",
            "Portafolio de análisis de fuentes históricas (documentales, iconográficas, orales)",
        ],
        5: [  # CH II: La experiencia histórica (sem 5)
            "Ensayo crítico sobre memoria colectiva, identidad y patrimonio cultural local",
            "Investigación sobre experiencias históricas de transformación social en México",
            "Exposición temática sobre coyunturas históricas con análisis de multicausalidad",
        ],
        6: [  # CH III: Navegar en el tiempo — investigaciones históricas (sem 6)
            "Proyecto de investigación histórica con metodología y análisis de fuentes",
            "Ensayo de historia regional que vincule pasado-presente con la comunidad",
            "Portafolio de investigaciones históricas con reflexión sobre identidad nacional",
        ],
    },
    # ── Cultura Digital ─────────────────────────────────────────────────────────
    "cultura digital": {
        1: [  # CD I: Ciudadanía digital (sem 1)
            "Proyecto de ciudadanía digital, ciberseguridad y uso ético de la información",
            "Infografía sobre identidad digital, privacidad y huella digital responsable",
            "Portafolio de prácticas de búsqueda, verificación y curación de información en línea",
        ],
        2: [  # CD II: Aprendizaje individual y colaborativo (sem 2)
            "Desarrollo de producto multimedia colaborativo en entornos virtuales",
            "Proyecto de aprendizaje colaborativo usando herramientas digitales (documentos, presentaciones)",
            "Portafolio digital de aplicaciones ofimáticas y herramientas de productividad",
        ],
        6: [  # CD III: Uso y difusión del conocimiento (sem 6)
            "Solución algorítmica o prototipo computacional funcional para un problema del entorno",
            "Proyecto de difusión del conocimiento mediante plataformas y medios digitales",
            "Portafolio de creación de contenido digital (video, podcast, sitio web) con propósito educativo",
        ],
    },
    # ── Lengua y Comunicación ───────────────────────────────────────────────────
    "lengua y comunicacion": {
        1: [  # LyC I: Leer y escribir para pensarnos juntos
            "Portafolio de lectura comprensiva con fichas de análisis de textos diversos",
            "Texto argumentativo breve de composición propia con estructura clara",
            "Proyecto de comunicación oral: exposición o debate sobre temas de interés estudiantil",
        ],
        2: [  # LyC II: Libertad para imaginar, poder para comunicar
            "Texto narrativo o descriptivo de autoría propia (cuento, crónica, relato personal)",
            "Antología comentada de narrativas populares y sus adaptaciones modernas",
            "Proyecto creativo de expresión escrita y oral (podcast, monólogo, recital)",
        ],
        3: [  # LyC III: Describir culturas, apropiarse de las palabras
            "Reseña crítica de una obra literaria con análisis de movimiento y género literario",
            "Antología comentada de textos literarios de diferentes movimientos culturales",
            "Ensayo de análisis literario sobre la función social de la literatura en la comunidad",
        ],
    },
    # ── Inglés ──────────────────────────────────────────────────────────────────
    "ingles": {
        1: [  # Inglés I: A1 — ser/estar, presentaciones, rutinas
            "Diálogo oral estructurado sobre presentaciones personales y rutinas cotidianas (Speaking A1)",
            "Compilador de textos descriptivos breves sobre personas, lugares y objetos (Writing A1)",
            "Bitácora de comprensión auditiva de instrucciones y conversaciones simples (Listening A1)",
        ],
        2: [  # Inglés II: A1-A2 — pasado, narrativas, secuencias
            "Narrativa breve en pasado simple sobre una experiencia personal (Writing A1-A2)",
            "Dramatización de una historia o cuento adaptado en lengua inglesa (Speaking A1-A2)",
            "Portafolio de lectura comprensiva de textos narrativos breves en inglés (Reading A1-A2)",
        ],
        3: [  # Inglés III: A2 — descripciones, comparaciones, opiniones
            "Texto descriptivo y comparativo sobre su comunidad o entorno (Writing A2)",
            "Exposición oral con apoyo visual sobre un tema de interés (Speaking A2)",
            "Bitácora de comprensión auditiva de materiales auténticos y medios digitales (Listening A2)",
        ],
        4: [  # Inglés IV: A2+ — planes, predicciones, argumentación básica
            "Ensayo breve argumentativo sobre un tema social o cultural en lengua inglesa (Writing A2+)",
            "Debate o mesa redonda sobre planes futuros y problemáticas juveniles (Speaking A2+)",
            "Portafolio de análisis de textos informativos y artículos breves en inglés (Reading A2+)",
        ],
    },
    # ── Humanidades (Pensamiento Filosófico) ────────────────────────────────────
    "humanidades": {
        1: [  # Humanidades I: Vivir aquí y ahora
            "Bitácora reflexiva sobre la experiencia humana y el sentido del presente",
            "Disertación filosófica sobre dilemas éticos y existenciales del entorno cotidiano",
            "Diálogo socrático sobre la relación ser humano–naturaleza–comunidad",
        ],
        2: [  # Humanidades II: Estar juntos
            "Ensayo filosófico sobre la convivencia, la alteridad y el reconocimiento del otro",
            "Debate ético sobre problemáticas de justicia social y derechos humanos",
            "Manifiesto ético-comunitario fundamentado en la convivencia democrática",
        ],
        3: [  # Humanidades III: El sentido de la vida
            "Disertación filosófica sobre el sentido de la vida y proyectos de trascendencia personal",
            "Análisis crítico de textos humanísticos sobre la libertad, la finitud y la trascendencia",
            "Portafolio reflexivo con diálogos filosóficos sobre identidad, vocación y proyecto de vida",
        ],
    },
}

def get_contextual_evidences(uac_name, topic="", semester=None):
    """Retorna evidencias contextualizadas por disciplina Y semestre."""
    combined = strip_accents(f"{uac_name} {topic}").lower()
    for key, sem_map in EVIDENCE_MAP_BY_SEMESTER.items():
        if key in combined:
            # Primero intentar con semestre específico
            if semester is not None and semester in sem_map:
                return sem_map[semester]
            # Fallback: primera entrada disponible (genérico de la disciplina)
            first_key = next(iter(sem_map))
            return sem_map[first_key]
    return [
        f"Proyecto formativo integrador de {uac_name}",
        "Portafolio de evidencias y rúbrica de evaluación formativa"
    ]

SEMESTER_MAP = {
    "primer": 1, "primero": 1, "1er": 1, "1°": 1, "1º": 1, "1": 1,
    "segundo": 2, "2do": 2, "2°": 2, "2º": 2, "2": 2,
    "tercer": 3, "tercero": 3, "3er": 3, "3°": 3, "3º": 3, "3": 3,
    "cuarto": 4, "4to": 4, "4°": 4, "4º": 4, "4": 4,
    "quinto": 5, "5to": 5, "5°": 5, "5º": 5, "5": 5,
    "sexto": 6, "6to": 6, "6°": 6, "6º": 6, "6": 6
}

MASTER_PATH = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\data\uacs_master_203.json"
MASTER_UACS = []
if os.path.exists(MASTER_PATH):
    with open(MASTER_PATH, "r", encoding="utf-8") as f:
        MASTER_UACS = json.load(f)

MASTER_MAP = {}
for u in MASTER_UACS:
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

def extract_progs_from_doc(doc, max_pages=45):
    progs = []
    for p_idx in range(min(len(doc), max_pages)):
        text = doc[p_idx].get_text()
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        for i, line in enumerate(lines):
            m = re.match(r'^(?:Etapa de\s+)?(?:Progresi[oó]n|Prop[oó]sito)\s*(\d{1,2})\s*[\.:\-–]?\s*(.*)', line, re.I)
            if m:
                order = int(m.group(1))
                desc = m.group(2).strip(' .:–-')
                if not desc and i + 1 < len(lines):
                    desc_parts = []
                    for j in range(i + 1, min(i + 6, len(lines))):
                        nxt = lines[j]
                        if re.match(r'^(?:(?:Etapa de\s+)?(?:Progresi[oó]n|Prop[oó]sito)|Metas?|Categor[ií]as?|Aprendizaje)\b', nxt, re.I):
                            break
                        desc_parts.append(nxt)
                    desc = ' '.join(desc_parts).strip()
                if desc and len(desc) > 8 and not any(p['order'] == order for p in progs):
                    progs.append({'order': order, 'name': clean(desc)})
    progs.sort(key=lambda x: x['order'])
    return progs

# ─────────────────────────────────────────────────────────────────────────────
# 1. Extractor de los 8 Libros Oficiales del Currículum Fundamental (2025-2028)
# ─────────────────────────────────────────────────────────────────────────────

def extract_fundamental_books():
    fund_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Currículum Fundamental"
    
    books_map = {
        "2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf": [
            (1, "Pensamiento Matemático I", "Pensamiento aritmético", 64),
            (2, "Pensamiento Matemático II", "Introducción al álgebra", 64),
            (3, "Pensamiento Matemático III", "Pensamiento algebraico e introducción a geometría plana", 64),
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
            (3, "Humanidades III", "El sentido de la vida", 72),
        ]
    }

    results = []

    for filename, uac_specs in books_map.items():
        filepath = os.path.join(fund_dir, filename)
        if not os.path.exists(filepath):
            print(f"WARN: Archivo no encontrado: {filepath}")
            continue

        print(f"Extrayendo libro fundamental: {filename}...")
        safe_path = get_safe_path(filepath)
        doc = fitz.open(safe_path)

        for u_idx, (sem, uac_name, topic, default_hrs) in enumerate(uac_specs):
            target_page = 13 + (u_idx * 2)
            if target_page >= len(doc):
                continue
            p1 = doc[target_page]
            p2 = doc[target_page + 1] if target_page + 1 < len(doc) else None

            # Meta educativa auténtica: buscar dentro de la tabla del semestre (después de "Tabla \d+")
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
            for b in b1:
                if b[1] < 380 and ("Tabla" in b[4] or "Nombre de" in b[4] or "Meta educativa" in b[4]): continue
                if b[1] > 740: continue
                btext = b[4].strip()
                if "Propósitos formativos" in btext or "Contenidos" in btext: continue
                if b[0] < 310: props.append((b[1], btext))
                else: conts.append((b[1], btext))

            if p2:
                p2_text = strip_accents(p2.get_text()).lower()
                if "fuente:" in p2_text or "propositos formativos" in p2_text or (b2 and any(b[1] < 400 and b[0] < 310 for b in b2)):
                    for b in b2:
                        if b[1] < 120 or b[1] > 740: continue
                        btext = b[4].strip()
                        if "Propósitos formativos" in btext or "Contenidos" in btext or "Fuente:" in btext: continue
                        if b[0] < 310: props.append((b[1] + 1000, btext))
                        else: conts.append((b[1] + 1000, btext))

            parsed_items = []
            for y, text in props:
                m_num = re.match(r'^(\d{1,2})\s+([A-ZÁÉÍÓÚ].*)', text, re.DOTALL)
                if m_num:
                    order = int(m_num.group(1))
                    prop_text = clean(m_num.group(2))
                    parsed_items.append({'order': order, 'y': y, 'prop': prop_text, 'conts': []})
                elif parsed_items:
                    parsed_items[-1]['prop'] += " " + clean(text)

            # Voronoi 1D / Nearest-Neighbor: asignar cada bloque de contenidos al propósito más cercano en la misma página
            for ry, rtext in conts:
                same_page_props = [lg for lg in parsed_items if (lg['y'] < 1000) == (ry < 1000)]
                closest_lg = min(same_page_props, key=lambda lg: abs(lg['y'] - ry)) if same_page_props else (min(parsed_items, key=lambda lg: abs(lg['y'] - ry)) if parsed_items else None)
                if closest_lg:
                    raw_lines = [l.strip() for l in rtext.split('\n') if l.strip()]
                    closest_lg['conts'].extend(raw_lines)

            m_uac = get_master_uac(uac_name, sem)
            final_hrs = m_uac['total_hours'] if m_uac and 'total_hours' in m_uac else default_hrs
            hours_per_act = round(final_hrs / len(parsed_items)) if parsed_items else 0

            parsed_items.sort(key=lambda x: x['order'])

            activities = []
            contenidos_formativos = []

            for p in parsed_items:
                activities.append({
                    "order": p['order'],
                    "name": p['prop'],
                    "hours": hours_per_act
                })
                merged_conts = merge_fragmented_lines(p['conts'])
                unique_conts = []
                for c in merged_conts:
                    if c not in unique_conts and len(c) > 3:
                        unique_conts.append(c)
                contenidos_formativos.append({
                    "order": p['order'],
                    "proposito": p['prop'],
                    "contenidos": unique_conts if unique_conts else [p['prop']]
                })

            evidences = get_contextual_evidences(uac_name, topic, semester=sem)

            results.append({
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
            conts_len = sum(len(c['contenidos']) for c in contenidos_formativos)
            print(f"  ✓ {uac_name} (Sem {sem}) extraída ({len(activities)} propósitos, {conts_len} contenidos)")

    return results

# ─────────────────────────────────────────────────────────────────────────────
# 2. Extractor de las 15 Capacitaciones Laborales BGE 2024 (120 UACs)
# ─────────────────────────────────────────────────────────────────────────────

def extract_laboral_capacitaciones():
    catalog_json_path = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\archive\bge-laboral-official-catalog.json"
    names_json_path = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\archive\matched-laboral-complete.json"
    
    with open(catalog_json_path, 'r', encoding='utf-8') as f:
        acts_catalog = json.load(f)
    with open(names_json_path, 'r', encoding='utf-8') as f:
        names_catalog = json.load(f)

    normalized_names_map = {}
    for k, v in names_catalog.items():
        norm_k = strip_accents(k).lower()
        normalized_names_map[norm_k] = (k, v)

    results = []

    for cap_name, uac_list in acts_catalog.items():
        norm_cap = strip_accents(cap_name).lower()
        
        matched_info = None
        if norm_cap in normalized_names_map:
            matched_info = normalized_names_map[norm_cap][1]
        else:
            for nk, val in normalized_names_map.items():
                if nk in norm_cap or norm_cap in nk:
                    matched_info = val[1]
                    break
                    
        if not matched_info:
            print(f"WARN: No se encontró mapeo de nombres para capacitación {cap_name}")
            continue

        by_sem = {3: [], 4: [], 5: [], 6: []}
        for u in uac_list:
            sem = u['semester']
            if sem in by_sem:
                by_sem[sem].append(u)

        for sem in [3, 4, 5, 6]:
            sem_uacs = by_sem[sem]
            sem_names = matched_info.get(f"sem{sem}", [])
            
            for idx, u_data in enumerate(sem_uacs):
                name = sem_names[idx] if idx < len(sem_names) else f"Capacitación {cap_name} UAC {idx+1} Sem {sem}"
                
                activities = []
                for act in u_data.get('activities', []):
                    act_name = clean(act['name'])
                    activities.append({
                        "order": act['order'],
                        "name": act_name,
                        "hours": act.get('hours', 18)
                    })
                    
                # Learning outcome auténtico extraído de la tabla de la UAC o None (cero sintético)
                raw_outcome = u_data.get('learning_outcome')
                outcome = clean(raw_outcome) if raw_outcome else None
                
                evidences = [
                    f"Reporte de práctica / Demostración técnica de {name}",
                    f"Portafolio de desempeño en {cap_name}"
                ]

                # CONTENIDOS FORMATIVOS: Los PDFs laborales 2024 de BGE organizan por Actividades Clave
                # y no cuentan con la tabla tridimensional de saberes (conceptuales/procedimentales/actitudinales).
                # Siguiendo la directiva oficial: se asigna estrictamente null para no inventar texto sintético.
                results.append({
                    "uac_name": name,
                    "semester": sem,
                    "component": "laboral",
                    "subsystem": "bge",
                    "total_hours": 54,
                    "learning_outcome": outcome,
                    "activities": activities,
                    "evidences": evidences,
                    "contenidos_formativos": None,
                    "model_type": "propositos_contenidos",
                    "year": 2024,
                    "curriculum_name": cap_name
                })

    print(f"Total UACs laborales procesadas: {len(results)}")
    return results

# ─────────────────────────────────────────────────────────────────────────────
# 3. Extractor de las 40 Optativas FFE (Quinto y Sexto Semestre)
# ─────────────────────────────────────────────────────────────────────────────

def extract_ffe_optativas():
    bg_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG"
    folder_2023 = [d for d in os.listdir(bg_dir) if '2023' in d][0]
    dir_2023 = os.path.join(bg_dir, folder_2023)
    ffe_opt_folder = [d for d in os.listdir(dir_2023) if 'optativas' in d.lower()][0]
    ffe_base = os.path.join(dir_2023, ffe_opt_folder)
    sem5_folder = [d for d in os.listdir(ffe_base) if 'quinto' in d.lower()][0]
    sem6_folder = [d for d in os.listdir(ffe_base) if 'sexto' in d.lower()][0]
    sem5_dir = os.path.join(ffe_base, sem5_folder)
    sem6_dir = os.path.join(ffe_base, sem6_folder)

    master_path = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\data\uacs_master_203.json"
    with open(master_path, 'r', encoding='utf-8') as f:
        master_uacs = json.load(f)
    ffe_master = [u for u in master_uacs if u.get('component') == 'ffe_optativa']

    scanned_data = {}
    scanned_path = os.path.join(os.path.dirname(__file__), "data", "scanned_ffe_extracted.json")
    if os.path.exists(scanned_path):
        with open(scanned_path, 'r', encoding='utf-8') as sf:
            scanned_data = json.load(sf)

    results = []

    def process_dir(directory, sem):
        if not os.path.exists(directory): return
        
        sem_official = [u for u in ffe_master if u.get('semester') == sem]
        
        for fname in os.listdir(directory):
            if not fname.lower().endswith('.pdf'): continue
            
            raw_title = fname
            if "-" in fname:
                parts = fname.split("-", 1)
                raw_title = parts[1].replace(".pdf", "").replace("-", " ").replace("_", " ")
            else:
                raw_title = fname.replace(".pdf", "").replace("-", " ").replace("_", " ")
                
            clean_title = clean(raw_title)
            norm_clean = strip_accents(clean_title).lower()
            
            matched_uac = None
            for off in sem_official:
                norm_off = strip_accents(off['uac_name']).lower()
                if norm_off in norm_clean or norm_clean in norm_off:
                    matched_uac = off
                    break
            if not matched_uac:
                for off in sem_official:
                    words = [w for w in strip_accents(off['uac_name']).lower().split() if len(w) > 4]
                    if any(w in norm_clean for w in words):
                        matched_uac = off
                        break
                        
            if "economia" in norm_clean and ("agentes" in norm_clean or "funcion" in norm_clean):
                final_name = "Economía I. La Función de los Agentes Económicos en la Sociedad"
            elif "procesos contab" in norm_clean:
                final_name = "Procesos Contables I" if sem == 5 else "Procesos Contables II"
            else:
                final_name = matched_uac['uac_name'] if matched_uac else clean_title

            # Lectura del archivo con soporte para rutas largas en Windows (get_safe_path)
            full_pdf_path = get_safe_path(os.path.join(directory, fname))
            progresiones = []
            extracted_outcome = None

            try:
                doc = fitz.open(full_pdf_path)
                progresiones = extract_progs_from_doc(doc, max_pages=45)
                
                # Intentar extraer aprendizaje de trayectoria o propósito oficial si está presente
                for p_idx in range(min(len(doc), 15)):
                    t = doc[p_idx].get_text()
                    m_out = re.search(r'(?:Aprendizaje(?:s)? de trayectoria|Propósito de la UAC|Propósito formativo)[:\s]+([^.\n]+(?:\.[^.\n]+)?)', t, re.I)
                    if m_out and len(clean(m_out.group(1))) > 20:
                        extracted_outcome = clean(m_out.group(1))
                        break
            except Exception as e:
                print(f"  ⚠ Error al leer PDF ({fname}): {e}")

            # Si el PDF estaba rasterizado/escaneado, cargar progresiones extraídas vía Gemini Vision
            if not progresiones and final_name in scanned_data:
                progresiones = scanned_data[final_name].get('progresiones', [])
                print(f"  ✓ {final_name} integrada desde extracción visual OCR ({len(progresiones)} progresiones)")

            # FALLBACK CANÓNICO: Si no se pudieron extraer progresiones, dejar array vacío []
            # Prohibido inyectar textos sintéticos como 'Analiza y fundamenta...'
            m_uac = get_master_uac(final_name, sem)
            final_hrs = m_uac['total_hours'] if m_uac and 'total_hours' in m_uac else 54
            
            activities = []
            if progresiones:
                hours_per_act = round(final_hrs / len(progresiones))
                for p in progresiones:
                    activities.append({
                        "order": p['order'],
                        "name": p['name'],
                        "hours": hours_per_act
                    })

            evidences = [
                f"Ensayo crítico o proyecto de aplicación en {final_name}",
                "Portafolio de evidencias de aprendizaje y evaluación formativa"
            ] if activities else []

            # LEARNING OUTCOME: Si no se extrajo del PDF, asignar estrictamente None (null)
            results.append({
                "uac_name": final_name,
                "semester": sem,
                "component": "ffe_optativa",
                "subsystem": "bge",
                "total_hours": final_hrs,
                "learning_outcome": extracted_outcome,
                "activities": activities,
                "evidences": evidences,
                "contenidos_formativos": None,
                "model_type": "progresiones",
                "year": 2023,
                "curriculum_name": "Formación Propedéutica Optativa"
            })
            status_desc = f"{len(activities)} progresiones" if activities else "activities: [] (pendiente revisión)"
            print(f"  ✓ Optativa Sem {sem}: {final_name} ({status_desc})")

    process_dir(sem5_dir, 5)
    process_dir(sem6_dir, 6)

    print(f"Total Optativas FFE procesadas: {len(results)}")
    return results

# ─────────────────────────────────────────────────────────────────────────────
# 4. Extractor de FFEO (9 UACs) y Socioemocionales (7 UACs)
# ─────────────────────────────────────────────────────────────────────────────

def build_ffeo_and_socioemocional():
    master_path = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\data\uacs_master_203.json"
    with open(master_path, 'r', encoding='utf-8') as f:
        master_uacs = json.load(f)
        
    target_items = [u for u in master_uacs if u.get('component') in ['ffeo', 'socioemocional']]

    bg_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG"
    dir_2023 = os.path.join(bg_dir, "Programas de Estudio para la Generación 2023 - 2026")
    ffeo_dir = os.path.join(dir_2023, "Formación Fundamental Extendido Obligatorio")
    sem5_ffe_dir = os.path.join(dir_2023, "Formación Fundamental Extendido (UAC optativas)", "Quinto Semestre")

    # Mapeo oficial de PDFs para las asignaturas de FFEO
    ffeo_pdf_map = {
        ("laboratorio de investigacion", 1): os.path.join(ffeo_dir, "hoRWlvTon9-Laboratorio_de_Investigacion.pdf"),
        ("taller de ciencias i", 2): os.path.join(ffeo_dir, "ZaTS7U81zP-Progresiones_de_aprendizaje_de_Taller_de_Ciencias_I.pdf"),
        ("taller de ciencias ii", 3): os.path.join(ffeo_dir, "84Nuywj4iX-Taller_de_Ciencias_II.pdf"),
        ("taller de cultura digital i", 4): os.path.join(ffeo_dir, "bCjnueYiA4-Taller_de_Cultura_Digital.pdf"),
        ("temas selectos de matematicas i", 4): os.path.join(ffeo_dir, "2n4no7T5CZ-Temas_selectos_de_Matematicas_I.pdf"),
        ("pensamiento literario", 4): os.path.join(ffeo_dir, "yUoZTSVhoI-Pensamiento_Literario.pdf"),
        ("espacio y sociedad", 4): os.path.join(ffeo_dir, "le6CptSR0R-Espacio_y_Sociedad.pdf"),
        ("taller de pensamiento variacional i", 5): os.path.join(sem5_ffe_dir, "RSy6bF9KM0-Taller_de_Pensamiento_Variacional_I.pdf"),
        ("temas selectos de matematicas ii", 6): os.path.join(ffeo_dir, "XpmVRgpT9H-Temas_Selectos_de_Matematicas_II.pdf"),
    }

    results = []

    for item in target_items:
        name = item['uac_name']
        sem = item['semester']
        hrs = item.get('total_hours', 54)
        comp = item['component']
        norm_name = normalize_key(name)
        
        activities = []
        outcome = None

        if comp == 'ffeo':
            pdf_path = ffeo_pdf_map.get((norm_name, sem))
            if pdf_path and os.path.exists(pdf_path):
                try:
                    safe_p = get_safe_path(pdf_path)
                    doc = fitz.open(safe_p)
                    progs = extract_progs_from_doc(doc, max_pages=45)
                    if progs:
                        hours_per_act = round(hrs / len(progs))
                        for p in progs:
                            activities.append({
                                "order": p['order'],
                                "name": p['name'],
                                "hours": hours_per_act
                            })
                except Exception as e:
                    print(f"  ⚠ Error al extraer FFEO ({name}): {e}")

            curr_name = "Formación Fundamental Extendida Obligatoria"
        else:
            # Socioemocional: MCCEMS organiza por Ámbitos Socioemocionales y no define
            # progresiones secuenciales estándar. activities queda como array vacío []
            curr_name = "Currículum Ampliado"

        results.append({
            "uac_name": name,
            "semester": sem,
            "component": comp,
            "subsystem": "bge",
            "total_hours": hrs,
            "learning_outcome": outcome,
            "activities": activities,
            "evidences": [],
            "contenidos_formativos": None,
            "model_type": "progresiones" if sem >= 5 else "propositos_contenidos",
            "year": 2025 if sem <= 4 else 2023,
            "curriculum_name": curr_name
        })
        act_desc = f"{len(activities)} progresiones auténticas" if activities else "activities: []"
        print(f"  ✓ [{comp}] Sem {sem}: {name} ({act_desc})")

    return results

# ─────────────────────────────────────────────────────────────────────────────
# Main Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=== INICIANDO MOTOR DE EXTRACCIÓN CURRICULAR OFICIAL SEP / BGE ===")
    
    fundamentals = extract_fundamental_books()
    laborales = extract_laboral_capacitaciones()
    optativas = extract_ffe_optativas()
    otros = build_ffeo_and_socioemocional()

    all_catalog = []
    all_catalog.extend(fundamentals)
    all_catalog.extend(laborales)
    all_catalog.extend(optativas)
    all_catalog.extend(otros)

    print("\n=== RESUMEN DE EXTRACCIÓN CANÓNICA ===")
    print(f"Fundamentales: {len(fundamentals)}")
    print(f"Laborales: {len(laborales)}")
    print(f"Optativas FFE: {len(optativas)}")
    print(f"FFEO y Socioemocionales: {len(otros)}")
    print(f"TOTAL GENERAL: {len(all_catalog)}")

    # Auditoría de calidad de datos sintéticos
    ffe_empty = [u['uac_name'] for u in optativas if len(u['activities']) == 0]
    lab_null_contenidos = [u['uac_name'] for u in laborales if u['contenidos_formativos'] is None]
    ffeo_with_progs = [u['uac_name'] for u in otros if len(u['activities']) > 0]

    print(f"\n--- AUDITORÍA DE CONTENIDOS Y FALLBACKS ---")
    print(f"Laborales con contenidos_formativos: null: {len(lab_null_contenidos)}/{len(laborales)}")
    print(f"Optativas FFE con activities: [] (pendiente revisión): {len(ffe_empty)}/{len(optativas)}")
    print(f"FFEO con progresiones auténticas extraídas: {len(ffeo_with_progs)}")

    output_path = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\data\curriculum_canonical_203.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_catalog, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Catálogo canónico oficial guardado exitosamente en: {output_path}")

if __name__ == "__main__":
    main()
