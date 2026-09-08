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

def extract_from_mapa_text(doc):
    # Find mapa pages
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
            
    # Extract blocks from mapa pages
    # Using blocks preserves reading order and coordinates!
    blocks = []
    for p in mapa_pages:
        page = doc[p]
        page_blocks = page.get_text("blocks")
        # Each block: (x0, y0, x1, y1, text, block_no, block_type)
        # Filter headers/footers
        for b in page_blocks:
            text = clean(b[4])
            if text and not text.isdigit() and "Mapa de competencias" not in text and "Actividades Clave" not in text and not text.startswith("Programas de"):
                blocks.append(text)
    return blocks, [p+1 for p in mapa_pages]

for f in sorted(PDF_TO_CURRICULUM.keys()):
    doc = fitz.open(os.path.join(pdf_dir, f))
    blocks, pages = extract_from_mapa_text(doc)
    print(f"{PDF_TO_CURRICULUM[f]}: {len(blocks)} blocks on pages {pages}")
