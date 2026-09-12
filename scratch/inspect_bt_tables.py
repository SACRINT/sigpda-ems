import fitz
import os
import re

folder = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas'

test_pdfs = [
    ("Programacion", "vBrm4pCEKV-PROGRAMACION.pdf"),
    ("Ciberseguridad", "lJmOA2k5Pp-Ciberseguridad_presencial.pdf"),
    ("Contabilidad", "BaicwgARuD-CONTABILIDAD1.pdf"),
    ("Inteligencia Artificial", "UlWagZywil-INTELIGENCIA_ARTIFICIAL1.pdf"),
    ("Electronica", "Nku1TCJEni-ELECTRONICA.pdf")
]

for name, filename in test_pdfs:
    full_path = os.path.join(folder, filename)
    doc = fitz.open(full_path)
    print(f"\n========================================================")
    print(f"CARRERA: {name} ({len(doc)} páginas)")
    print(f"========================================================")
    
    # Buscar ocurrencias de "PROCESO PARA LA FORMACIÓN" o "PROCESO DE FORMACIÓN"
    pages_found = []
    for page_idx in range(len(doc)):
        text = doc[page_idx].get_text("text")
        if "proceso para la formación" in text.lower() or "proceso de formación" in text.lower():
            # Buscar mención de Módulo o Submódulo en esa página
            m_mod = re.search(r'MÓDULO\s+([IVXLCDM]+)', text, re.IGNORECASE)
            m_sub = re.search(r'SUBMÓDULO\s*([0-9]+|S[0-9]+)?', text, re.IGNORECASE)
            pages_found.append((page_idx + 1, m_mod.group(0) if m_mod else "N/A", m_sub.group(0) if m_sub else "N/A"))
            
    print(f"Páginas con tablas de competencias ({len(pages_found)} págs):")
    for p, mod, sub in pages_found[:12]:
        print(f"  Pág {p:3d}: {mod} | {sub}")
