import os
import re
import json
import fitz

pdf_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024"

PDF_TO_CURRICULUM = {
    "Administracion_2024.pdf": "Administración",
    "Agricultura_Sostenible_de_Traspatio_2024.pdf": "Agricultura Sostenible de Traspatio",
    "Area_de_la_Salud_2024.pdf": "Área de la Salud",
    "Comunicacion_Grafica_2024.pdf": "Comunicación Gráfica",
    "Contabilidad_2024.pdf": "Contabilidad",
    "Domotica_2024.pdf": "Domótica",
    "Instalaciones_Residenciales_2024.pdf": "Instalaciones Residenciales",
    "Mecanica_Dental_2024.pdf": "Mecánica Dental",
    "Preparacion_de_Alimentos_Artesanales_2024.pdf": "Preparación de Alimentos Artesanales",
    "Procesos_Culinarios_y_Reposteria_2024.pdf": "Procesos Culinarios y Repostería",
    "Redes_y_Mantenimiento_2024.pdf": "Redes y Mantenimiento",
    "Servicios_Ecosistemicos_2024.pdf": "Servicios Ecosistémicos",
    "Sistemas_Electricos_2024.pdf": "Sistemas Eléctricos",
    "Tecnologia_Informatica_2024.pdf": "Tecnología Informática",
    "Turismo_2024.pdf": "Turismo",
}

def clean(s):
    if not s:
        return ""
    s = s.replace("\r\n", " ").replace("\n", " ").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def split_activities_text(text):
    # Splits by numbers 1., 2., 3. or 1.- 2.- 3.-
    # Regex pattern: (?:\s|^)([1-3])[\.\-\)]\s+
    pattern = r'(?:^|\s+)([1-3])[\.\-\)]\s+'
    matches = list(re.finditer(pattern, text))
    if not matches:
        return []
    
    # Check if we have 1, 2, 3 in sequence
    acts = []
    for i in range(len(matches)):
        start = matches[i].end()
        end = matches[i+1].start() if i + 1 < len(matches) else len(text)
        act_text = clean(text[start:end])
        if act_text:
            acts.append(act_text)
    return acts

def parse_pdf_mapa_complete(f):
    doc = fitz.open(os.path.join(pdf_dir, f))
    curr_name = PDF_TO_CURRICULUM[f]
    
    start_page = -1
    for i in range(len(doc)):
        t = doc[i].get_text()
        if i > 10 and ("Mapa de competencias del componente de Formación Laboral" in t or "Mapa de competencias" in t):
            if "Perfil de egreso" not in t and "Índice" not in t and "Contenido" not in t:
                start_page = i
                break
                
    mapa_pages = [start_page]
    for p in range(start_page + 1, min(start_page + 6, len(doc))):
        pt = doc[p].get_text()
        if "Perfil de egreso" in pt or "Unidad de Aprendizaje Curricular 1" in pt or "Estructura del programa" in pt:
            break
        if "Semestre" in pt or "UAC" in pt or "Actividades Clave" in pt or "3." in pt:
            mapa_pages.append(p)
            
    # Accumulate all text cells from tables
    raw_rows = []
    for p in mapa_pages:
        tabs = doc[p].find_tables()
        for tab in tabs.tables:
            for row in tab.extract():
                cleaned_row = [clean(c) for c in row if c is not None]
                if any(cleaned_row):
                    raw_rows.append(cleaned_row)
                    
    return curr_name, mapa_pages, raw_rows

all_data = {}
for f in sorted(PDF_TO_CURRICULUM.keys()):
    curr, pages, rows = parse_pdf_mapa_complete(f)
    all_data[curr] = {"file": f, "pages": pages, "rows": rows}

print(f"Loaded rows for all {len(all_data)} capacitaciones.")
