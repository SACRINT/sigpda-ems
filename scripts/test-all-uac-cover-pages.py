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

def extract_from_uac_cover_pages(doc):
    # Search for pages that have "Actividad Clave 1:" and "Actividad Clave 2:" and "Actividad Clave 3:"
    # or "Actividades Clave"
    uacs_found = []
    
    for p in range(len(doc)):
        text = doc[p].get_text()
        if "Actividad Clave 1" in text and "Actividad Clave 2" in text and "Actividad Clave 3" in text:
            # Check if this page defines a UAC
            # Let's extract Actividad Clave 1, 2, 3
            # Regex pattern to capture the text after "Actividad Clave X:" up to "Horas" or next "Actividad"
            pattern1 = r'Actividad Clave 1\s*:\s*(.*?)(?:Horas|Actividad Clave 2|$)'
            pattern2 = r'Actividad Clave 2\s*:\s*(.*?)(?:Horas|Actividad Clave 3|$)'
            pattern3 = r'Actividad Clave 3\s*:\s*(.*?)(?:Horas|Horas de Estudio|Ocupaciones|$)'
            
            m1 = re.search(pattern1, text, re.DOTALL | re.IGNORECASE)
            m2 = re.search(pattern2, text, re.DOTALL | re.IGNORECASE)
            m3 = re.search(pattern3, text, re.DOTALL | re.IGNORECASE)
            
            if m1 and m2 and m3:
                act1 = clean(m1.group(1))
                act2 = clean(m2.group(1))
                act3 = clean(m3.group(1))
                # Also clean any trailing punctuation or colon
                act1 = re.sub(r':$', '', act1).strip()
                act2 = re.sub(r':$', '', act2).strip()
                act3 = re.sub(r':$', '', act3).strip()
                
                # Try to get UAC name from page or semester
                sem_match = re.search(r'(Tercer|Cuarto|Quinto|Sexto)\s+Semestre', text, re.IGNORECASE)
                uac_num_match = re.search(r'UAC\s*([12])|Unidad de Aprendizaje Curricular\s*([12])', text, re.IGNORECASE)
                
                # Check next page for "Resultado de aprendizaje"
                outcome = ""
                if p + 1 < len(doc):
                    next_text = doc[p+1].get_text()
                    if "Resultado de aprendizaje" in next_text:
                        out_match = re.search(r'Resultado de aprendizaje\s*(?:Al finalizar.*?:\s*)?(.*?)(?:Actividad clave|Actividades para|$)', next_text, re.DOTALL | re.IGNORECASE)
                        if out_match:
                            outcome = clean(out_match.group(1))
                
                uacs_found.append({
                    "page": p + 1,
                    "semester_str": sem_match.group(1) if sem_match else "",
                    "uac_num": (uac_num_match.group(1) or uac_num_match.group(2)) if uac_num_match else "",
                    "act1": act1,
                    "act2": act2,
                    "act3": act3,
                    "outcome": outcome,
                    "full_text_sample": clean(text[:300])
                })
    return uacs_found

print("Running test on all 15 PDFs...")
total_found = 0
for f in sorted(PDF_TO_CURRICULUM.keys()):
    doc = fitz.open(os.path.join(pdf_dir, f))
    uacs = extract_from_uac_cover_pages(doc)
    print(f"{PDF_TO_CURRICULUM[f]} ({f}): Found {len(uacs)} UAC detail pages")
    total_found += len(uacs)
    if len(uacs) != 8:
        print(f"  --> Pages found: {[u['page'] for u in uacs]}")

print(f"\nTotal UAC cover pages found across all 15: {total_found} / 120")
