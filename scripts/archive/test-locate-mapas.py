import os
import re
import fitz  # PyMuPDF

pdf_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024"
pdf_files = sorted([f for f in os.listdir(pdf_dir) if f.endswith(".pdf")])

print(f"Total PDFs found: {len(pdf_files)}")

results = {}

for f in pdf_files:
    pdf_path = os.path.join(pdf_dir, f)
    doc = fitz.open(pdf_path)
    
    # Locate pages with "Mapa de competencias del componente de Formación Laboral"
    mapa_pages = []
    for page_idx in range(min(30, len(doc))):
        text = doc[page_idx].get_text()
        if "Mapa de competencias" in text or "competencias del componente de Formación Laboral" in text:
            mapa_pages.append(page_idx)
        elif mapa_pages and ("Perfil de egreso" in text or "Estructura del programa" in text or "Unidad de Aprendizaje Curricular 1" in text):
            # stop if we hit subsequent section
            break
        elif mapa_pages and len(mapa_pages) < 4:
            # check if it continues table
            if "Semestre" in text and "UAC" in text:
                mapa_pages.append(page_idx)
    
    # Extract combined text of mapa pages
    combined_text = "\n".join([doc[p].get_text() for p in mapa_pages])
    
    # Store page numbers
    results[f] = {
        "pages": [p + 1 for p in mapa_pages],
        "text_length": len(combined_text)
    }

for k, v in results.items():
    print(f"{k}: Pages {v['pages']}, length: {v['text_length']}")
