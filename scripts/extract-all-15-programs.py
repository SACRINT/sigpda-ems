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

SEMESTER_WORDS = {
    "tercer": 3,
    "tercero": 3,
    "cuarto": 4,
    "quinto": 5,
    "sexto": 6,
    "3er": 3,
    "4°": 4,
    "4º": 4,
    "5°": 5,
    "5º": 5,
    "6°": 6,
    "6º": 6
}

def clean(s):
    if not s:
        return ""
    s = s.replace("\r\n", " ").replace("\n", " ").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def extract_from_pdf(file_name):
    pdf_path = os.path.join(pdf_dir, file_name)
    doc = fitz.open(pdf_path)
    curr_name = PDF_TO_CURRICULUM[file_name]
    
    uacs = []
    
    for p in range(len(doc)):
        text = doc[p].get_text()
        
        # Check if page has Actividad Clave definitions
        if re.search(r'Actividad\s*Clave\s*1', text, re.IGNORECASE) and \
           re.search(r'Actividad\s*Clave\s*2', text, re.IGNORECASE) and \
           re.search(r'Actividad\s*Clave\s*3', text, re.IGNORECASE):
           
            # Identify semester
            sem = None
            sem_m = re.search(r'(Tercer|Cuarto|Quinto|Sexto|3er|4°|5°|6°)\s+Semestre', text, re.IGNORECASE)
            if sem_m:
                sem = SEMESTER_WORDS.get(sem_m.group(1).lower(), None)
            
            # Identify UAC number
            uac_num = None
            uac_m = re.search(r'(?:UAC|Unidad de Aprendizaje Curricular)\s*([12])', text, re.IGNORECASE)
            if uac_m:
                uac_num = int(uac_m.group(1))
                
            # Extract Actividades
            pattern1 = r'Actividad\s*Clave\s*1\s*:\s*(.*?)(?:Horas|Actividad\s*Clave\s*2|$)'
            pattern2 = r'Actividad\s*Clave\s*2\s*:\s*(.*?)(?:Horas|Actividad\s*Clave\s*3|$)'
            pattern3 = r'Actividad\s*Clave\s*3\s*:\s*(.*?)(?:Horas|Horas de Estudio|Ocupaciones|$)'
            
            m1 = re.search(pattern1, text, re.DOTALL | re.IGNORECASE)
            m2 = re.search(pattern2, text, re.DOTALL | re.IGNORECASE)
            m3 = re.search(pattern3, text, re.DOTALL | re.IGNORECASE)
            
            if m1 and m2 and m3:
                act1 = clean(m1.group(1))
                act2 = clean(m2.group(1))
                act3 = clean(m3.group(1))
                act1 = re.sub(r':$', '', act1).strip()
                act2 = re.sub(r':$', '', act2).strip()
                act3 = re.sub(r':$', '', act3).strip()
                
                # Check next page for outcome
                outcome = ""
                if p + 1 < len(doc):
                    next_text = doc[p+1].get_text()
                    if "Resultado de aprendizaje" in next_text:
                        out_m = re.search(r'Resultado de aprendizaje\s*(?:Al finalizar.*?:\s*)?(.*?)(?:Actividad clave|Actividades para|$)', next_text, re.DOTALL | re.IGNORECASE)
                        if out_m:
                            outcome = clean(out_m.group(1))
                            
                uacs.append({
                    "page": p + 1,
                    "semester": sem,
                    "uac_num": uac_num,
                    "activities": [
                        {"order": 1, "name": act1, "hours": 18},
                        {"order": 2, "name": act2, "hours": 18},
                        {"order": 3, "name": act3, "hours": 18}
                    ],
                    "outcome": outcome,
                    "raw_sample": text[:200]
                })
                
    return curr_name, uacs

print("Extracting all 15...")
catalog = {}
for f in sorted(PDF_TO_CURRICULUM.keys()):
    curr, uacs = extract_from_pdf(f)
    catalog[curr] = uacs
    print(f"{curr}: extracted {len(uacs)} UACs")
    for u in uacs:
        if not u["semester"] or not u["uac_num"]:
            print(f"  Warning: UAC missing sem/num on page {u['page']}: sem={u['semester']}, num={u['uac_num']}")

