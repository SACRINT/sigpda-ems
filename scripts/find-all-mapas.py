import os
import fitz

pdf_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024"
pdf_files = sorted([f for f in os.listdir(pdf_dir) if f.endswith(".pdf")])

for f in pdf_files:
    pdf_path = os.path.join(pdf_dir, f)
    doc = fitz.open(pdf_path)
    
    start_page = -1
    for i in range(len(doc)):
        t = doc[i].get_text()
        # Look for the title on pages that are not the TOC (page index > 10)
        if i > 10 and ("Mapa de competencias del componente de Formación Laboral" in t or "Mapa de competencias" in t):
            if "Perfil de egreso" not in t and "Índice" not in t and "Contenido" not in t:
                start_page = i
                break
    
    if start_page != -1:
        # Find consecutive pages until "Perfil de egreso"
        pages = [start_page]
        for p in range(start_page + 1, min(start_page + 5, len(doc))):
            pt = doc[p].get_text()
            if "Perfil de egreso" in pt or "Unidad de Aprendizaje Curricular" in pt:
                break
            if "Semestre" in pt or "UAC" in pt:
                pages.append(p)
        print(f"{f}: Map pages {[p+1 for p in pages]}")
    else:
        print(f"FAILED TO FIND in {f}")
