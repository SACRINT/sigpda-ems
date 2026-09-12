import os
import re
import json
import fitz

pdf_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024"

# Map PDF file name to database curriculum_name
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

def clean_text(s):
    if not s:
        return ""
    # Normalize spaces, newlines, and non-standard chars
    s = s.replace("\r\n", " ").replace("\n", " ").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def split_activities(act_text):
    # Matches "1. ... 2. ... 3. ..."
    # Some numbers might be "1.-" or "1." or "1 "
    pattern = r'(?:^|\s*)([1-3])[\.\-\)]\s*'
    parts = re.split(pattern, act_text)
    # parts will be ['', '1', 'text of 1', '2', 'text of 2', '3', 'text of 3']
    activities = []
    if len(parts) >= 7:
        for i in range(1, len(parts), 2):
            num = parts[i]
            val = clean_text(parts[i+1])
            if val:
                activities.append(val)
    return activities

def extract_for_pdf(file_name):
    pdf_path = os.path.join(pdf_dir, file_name)
    doc = fitz.open(pdf_path)
    curr_name = PDF_TO_CURRICULUM[file_name]
    
    # 1. Find mapa pages
    start_page = -1
    for i in range(len(doc)):
        t = doc[i].get_text()
        if i > 10 and ("Mapa de competencias del componente de Formación Laboral" in t or "Mapa de competencias" in t):
            if "Perfil de egreso" not in t and "Índice" not in t and "Contenido" not in t:
                start_page = i
                break
                
    if start_page == -1:
        return None, f"Could not find start page for {file_name}"
        
    mapa_pages = [start_page]
    for p in range(start_page + 1, min(start_page + 5, len(doc))):
        pt = doc[p].get_text()
        if "Perfil de egreso" in pt or "Unidad de Aprendizaje Curricular 1" in pt or "Estructura del programa" in pt:
            break
        if "Semestre" in pt or "UAC" in pt or "Actividades Clave" in pt or "3." in pt:
            mapa_pages.append(p)
            
    # Let's extract all rows from tables across these pages
    raw_rows = []
    for p in mapa_pages:
        page = doc[p]
        tabs = page.find_tables()
        for tab in tabs.tables:
            extracted = tab.extract()
            for r in extracted:
                raw_rows.append([clean_text(c) for c in r])
                
    return {
        "file": file_name,
        "curriculum": curr_name,
        "pages": [p + 1 for p in mapa_pages],
        "rows": raw_rows
    }, None

all_extracted = {}
for f in sorted(PDF_TO_CURRICULUM.keys()):
    res, err = extract_for_pdf(f)
    if err:
        print(f"Error {f}: {err}")
    else:
        print(f"{f} -> {len(res['rows'])} table rows across pages {res['pages']}")
        all_extracted[f] = res

