import fitz
import re
import os
import json

folder = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Curriculum Laboral BGE 2024"
pdf_file = "Administracion_2024.pdf"
doc = fitz.open(os.path.join(folder, pdf_file))

def clean(t):
    if not t: return ""
    t = t.replace("\xa0", " ").replace("\r\n", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", t).strip()

print(f"Abriendo {pdf_file}...")

# In Laboral PDFs, each UAC typically starts with a header page:
# "Unidad de Aprendizaje Curricular 1" o "UAC 1: [Nombre]"
# Followed by "Resultado de aprendizaje" and "Actividad Clave 1", "Actividad Clave 2", "Actividad Clave 3"

uacs = []

for p in range(len(doc)):
    text = doc[p].get_text()
    
    # Check if page has Actividades Clave definition
    if re.search(r'Actividad\s*Clave\s*1', text, re.I) and re.search(r'Actividad\s*Clave\s*2', text, re.I) and re.search(r'Actividad\s*Clave\s*3', text, re.I):
        # Identify semester
        sem = 3
        if re.search(r'Tercer\s*Semestre|3er\s*Semestre', text, re.I): sem = 3
        elif re.search(r'Cuarto\s*Semestre|4to\s*Semestre', text, re.I): sem = 4
        elif re.search(r'Quinto\s*Semestre|5to\s*Semestre', text, re.I): sem = 5
        elif re.search(r'Sexto\s*Semestre|6to\s*Semestre', text, re.I): sem = 6
        
        # Identify UAC name
        # Look at previous page or current page header
        prev_text = doc[p-1].get_text() if p > 0 else ""
        
        # Patterns for UAC name:
        name = ""
        m_name = re.search(r'(?:UAC\s*[12]|Unidad\s*de\s*Aprendizaje\s*Curricular\s*[12])\s*[:\-–—]?\s*([A-ZÁÉÍÓÚÜÑ][^:\n\r]{10,120})', text, re.I)
        if not m_name and prev_text:
            m_name = re.search(r'(?:UAC\s*[12]|Unidad\s*de\s*Aprendizaje\s*Curricular\s*[12])\s*[:\-–—]?\s*([A-ZÁÉÍÓÚÜÑ][^:\n\r]{10,120})', prev_text, re.I)
        if not m_name:
            m_name = re.search(r'Nombre\s*de\s*la\s*UAC\s*[:\-–—]?\s*([A-ZÁÉÍÓÚÜÑ][^:\n\r]{10,120})', text + "\n" + prev_text, re.I)
            
        if m_name:
            name = clean(m_name.group(1))
            
        # Extract Actividades Clave
        m1 = re.search(r'Actividad\s*Clave\s*1\s*[:\-–—]?\s*(.*?)(?=\d*\s*Horas|Actividad\s*Clave\s*2|$)', text, re.DOTALL | re.I)
        m2 = re.search(r'Actividad\s*Clave\s*2\s*[:\-–—]?\s*(.*?)(?=\d*\s*Horas|Actividad\s*Clave\s*3|$)', text, re.DOTALL | re.I)
        m3 = re.search(r'Actividad\s*Clave\s*3\s*[:\-–—]?\s*(.*?)(?=\d*\s*Horas|Ocupaciones|Resultado\s*de|$)', text, re.DOTALL | re.I)
        
        act1 = clean(m1.group(1)) if m1 else ""
        act2 = clean(m2.group(1)) if m2 else ""
        act3 = clean(m3.group(1)) if m3 else ""
        
        # Outcome
        outcome_m = re.search(r'Resultado\s+de\s+aprendizaje\s*[:\-–—]?\s*(.*?)(?=Actividad\s*Clave|Actividades\s*para|$)', text + "\n" + prev_text, re.DOTALL | re.I)
        outcome = clean(outcome_m.group(1)) if outcome_m else ""
        
        print(f"\n--- UAC en pág {p+1} (Sem {sem}) ---")
        print(f"Nombre detectado: {name}")
        print(f"Act 1: {act1[:60]}...")
        print(f"Act 2: {act2[:60]}...")
        print(f"Act 3: {act3[:60]}...")
