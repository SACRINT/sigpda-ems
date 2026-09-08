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
    # Normalize unicode accents / chars
    s = s.replace("\r\n", " ").replace("\n", " ").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def extract_mapa_text(doc):
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
            
    # Concatenate lines
    all_lines = []
    for p in mapa_pages:
        lines = doc[p].get_text("text").splitlines()
        for l in lines:
            cl = l.strip()
            # ignore standalone page numbers or headers
            if cl and not cl.isdigit() and "Mapa de competencias" not in cl and "Actividades Clave" not in cl and not cl.startswith("Programas de"):
                all_lines.append(cl)
    return all_lines, [p+1 for p in mapa_pages]

results = {}
total_uacs = 0
total_acts = 0

for f in sorted(PDF_TO_CURRICULUM.keys()):
    doc = fitz.open(os.path.join(pdf_dir, f))
    lines, pages = extract_mapa_text(doc)
    text = "\n".join(lines)
    
    # Let's inspect how semesters and UACs are split in the text
    # Pattern:
    # (3er|4°|4º|5°|5º|6°|6º)\s+Semestre
    # UAC 1 / UAC 2
    # 1. ... 2. ... 3. ...
    
    results[f] = {
        "curriculum": PDF_TO_CURRICULUM[f],
        "pages": pages,
        "raw_text": text
    }

print("Loaded all 15 PDFs map text.")
