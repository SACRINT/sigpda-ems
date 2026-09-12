import os
import fitz

pdf_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024"

for f in ["Area_de_la_Salud_2024.pdf", "Procesos_Culinarios_y_Reposteria_2024.pdf"]:
    doc = fitz.open(os.path.join(pdf_dir, f))
    for p in range(14, 19):
        t = doc[p].get_text()
        if "Mapa de competencias" in t or "Semestre" in t:
            print(f"=== {f} PAGE {p+1} ===")
            print(t[:800])
