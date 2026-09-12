# -*- coding: utf-8 -*-
import fitz
import unicodedata
import re
import os
import sys
import json

def clean(t):
    if not t: return ""
    t = t.replace("\xa0", " ").replace("\r\n", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", t).strip()

def strip_accents(text):
    if not text: return ""
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

fund_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Currículum Fundamental"

books_map = {
    "2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf": [
        (1, "Pensamiento Matemático I", "Pensamiento aritmético", 13, 64),
        (2, "Pensamiento Matemático II", "Introducción al álgebra", 15, 64),
        (3, "Pensamiento Matemático III", "Pensamiento algebraico e introducción a geometría plana", 17, 64),
        (4, "Pensamiento Matemático IV", "Trigonometría y geometría analítica", 19, 64),
        (5, "Pensamiento Matemático V", "Cálculo diferencial", 21, 64),
        (6, "Pensamiento Matemático VI", "Pensamiento estadístico y probabilístico", 23, 64),
    ],
    "2025_MCC_CIENCIAS NATURALES_BN.pdf": [
        (1, "Ciencias Naturales, Experimentales y Tecnología I", "Invitación a la ciencia", 13, 72),
        (2, "Ciencias Naturales, Experimentales y Tecnología II", "El poder de la energía", 15, 72),
        (3, "Ciencias Naturales, Experimentales y Tecnología III", "Nuestro hogar", 17, 72),
        (4, "Ciencias Naturales, Experimentales y Tecnología IV", "El poder de la química", 19, 72),
        (5, "Ciencias Naturales, Experimentales y Tecnología V", "Del átomo al universo", 21, 72),
        (6, "Ciencias Naturales, Experimentales y Tecnología VI", "¿Qué es la vida? Evolución y biodiversidad", 23, 72),
    ],
    "2025_ MCC_CIENCIAS SOCIALES_BN.pdf": [
        (1, "Ciencias Sociales I", "Estado, ciudadanía y relaciones de poder", 13, 36),
        (2, "Ciencias Sociales II", "Organización, relaciones sociales y económicas", 15, 36),
        (4, "Ciencias Sociales III", "Las dinámicas de la realidad actual: la condición estudiantil", 17, 72),
    ],
    "2025_ MCC_CONCIENCIA HISTORICA_BN.pdf": [
        (4, "Conciencia Histórica I", "Coordenadas de la Historia", 13, 54),
        (5, "Conciencia Histórica II", "La experiencia histórica", 15, 54),
        (6, "Conciencia Histórica III", "Navegar en el tiempo: investigaciones históricas", 17, 54),
    ],
    "2025_ MCC_CULTURA DIGITAL_BN.pdf": [
        (1, "Cultura Digital I", "Ciudadanía digital", 13, 54),
        (2, "Cultura Digital II", "Aprendizaje individual y colaborativo", 15, 36),
        (6, "Cultura Digital III", "Uso y difusión del conocimiento", 17, 36),
    ],
    "2025_ MCC_LENGUA Y COMUNICACION_BN.pdf": [
        (1, "Lengua y Comunicación I", "Leer y escribir para pensarnos juntos", 13, 54),
        (2, "Lengua y Comunicación II", "Libertad para imaginar, poder para comunicar", 15, 54),
        (3, "Lengua y Comunicación III", "Describir culturas, apropiarse de las palabras", 17, 54),
    ],
    "2025_ MCC_MCC_INGLES_BN.pdf": [
        (1, "Inglés I", "To be, or not to be, that is the question (A1)", 13, 54),
        (2, "Inglés II", "Once upon a time (A1-A2)", 15, 54),
        (3, "Inglés III", "A picture is worth a thousand words (A2)", 17, 54),
        (4, "Inglés IV", "Life is a journey, not a destination (A2+)", 19, 54),
    ],
    "2025_MCC_PENSAMIENTO FILOSOFICO_BN.pdf": [
        (1, "Humanidades I", "Vivir aquí y ahora", 13, 72),
        (2, "Humanidades II", "Estar juntos", 15, 72),
        (3, "Humanidades III", "El sentido de la vida", 17, 72),
    ]
}

total_props = 0
for filename, uac_specs in books_map.items():
    filepath = os.path.join(fund_dir, filename)
    doc = fitz.open(filepath)
    print(f"\n--- {filename} ---")
    for sem, uac_name, topic, p_start, default_hrs in uac_specs:
        # Search around p_start - 1
        target_page = None
        for p in range(max(0, p_start - 3), min(len(doc), p_start + 4)):
            t = strip_accents(doc[p].get_text()).lower()
            if "propositos formativos" in t and ("contenidos formativos" in t or "contenidos" in t):
                # Verify semester or uac name
                if f"semestre {sem}" in t or f"semestre: {sem}" in t or f"{sem}°" in t or f"semestre" in t:
                    # check if this page corresponds to the UAC
                    comb = (doc[p-1].get_text() if p > 0 else "") + doc[p].get_text()
                    norm_comb = strip_accents(comb).lower()
                    
                    # check semester matches
                    sem_words = {1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto", 5: "quinto", 6: "sexto"}
                    if f"{sem_words[sem]} semestre" in norm_comb or f"semestre {sem}" in norm_comb or f" {sem}º" in norm_comb or f" {sem}°" in norm_comb:
                        target_page = p
                        break
        if target_page is None:
            target_page = p_start - 1

        # Extract blocks from target_page and target_page + 1
        p1 = doc[target_page]
        p2 = doc[target_page + 1] if target_page + 1 < len(doc) else None
        
        # Meta educativa
        comb_text = (doc[target_page-1].get_text() if target_page > 0 else "") + p1.get_text()
        meta_m = re.search(r'Meta educativa\s*[:\s]*([\s\S]+?)(?:Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|Horas/semana|Propósitos formativos)', comb_text, re.I)
        meta_educativa = clean(meta_m.group(1)) if meta_m else None

        b1 = p1.get_text("blocks")
        b2 = p2.get_text("blocks") if p2 else []
        
        props = []
        conts = []
        
        for b in b1:
            if b[1] < 380 and ("Tabla" in b[4] or "Nombre de" in b[4] or "Meta educativa" in b[4]): continue
            if b[1] > 740: continue # footer
            btext = b[4].strip()
            if "Propósitos formativos" in btext or "Contenidos" in btext: continue
            if b[0] < 310:
                props.append((b[1], btext))
            else:
                conts.append((b[1], btext))
                
        if p2:
            p2_text = strip_accents(p2.get_text()).lower()
            if "fuente:" in p2_text or "propositos formativos" in p2_text or (b2 and any(b[1] < 400 and b[0] < 310 for b in b2)):
                for b in b2:
                    if b[1] < 120 or b[1] > 740: continue
                    btext = b[4].strip()
                    if "Propósitos formativos" in btext or "Contenidos" in btext or "Fuente:" in btext: continue
                    if b[0] < 310:
                        props.append((b[1] + 1000, btext))
                    else:
                        conts.append((b[1] + 1000, btext))

        parsed_items = []
        for y, text in props:
            m_num = re.match(r'^(\d{1,2})\s+([A-ZÁÉÍÓÚ].*)', text, re.DOTALL)
            if m_num:
                order = int(m_num.group(1))
                prop_text = clean(m_num.group(2))
                parsed_items.append({'order': order, 'y': y, 'prop': prop_text, 'conts': []})
            elif parsed_items:
                parsed_items[-1]['prop'] += " " + clean(text)

        # Associate contents
        for lg in parsed_items:
            for ry, rtext in conts:
                if abs(ry - lg['y']) < 140 or (lg['y'] < 1000 and ry < 1000 and abs(ry - lg['y']) < 160) or (lg['y'] >= 1000 and ry >= 1000 and abs(ry - lg['y']) < 160):
                    lines = [clean(l) for l in rtext.split('\n') if len(clean(l)) > 2]
                    lg['conts'].extend(lines)

        total_props += len(parsed_items)
        print(f"  {uac_name} (Sem {sem}, Pag {target_page+1}): {len(parsed_items)} propósitos extraídos")
        if parsed_items:
            print(f"    P1: {parsed_items[0]['prop'][:60]}... | Contenidos: {len(parsed_items[0]['conts'])}")

print(f"\nTOTAL PROPÓSITOS EXTRAÍDOS EN TODAS LAS 32 UACS FUNDAMENTALES: {total_props}")
