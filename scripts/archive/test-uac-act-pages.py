import os
import re
import fitz

pdf_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024"

doc = fitz.open(os.path.join(pdf_dir, "Instalaciones_Residenciales_2024.pdf"))

# Let's search for "Actividad Clave 1:" across all pages
found = []
for p in range(len(doc)):
    text = doc[p].get_text()
    if "Actividad Clave 1:" in text or "Actividad Clave 1 :" in text:
        # Check if it has Horas: 18 or similar
        m = re.findall(r'Actividad Clave ([1-3])\s*:\s*([^:\n\r]+(?:\n[^:\n\r]+)*)', text)
        print(f"Page {p+1} matches:")
        for num, act in m:
            print(f"  Act {num}: {act.strip()[:60]}...")
