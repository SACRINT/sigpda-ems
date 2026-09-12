import os
import fitz

doc = fitz.open(r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024\Procesos_Culinarios_y_Reposteria_2024.pdf")

print("Total pages:", len(doc))
for p in range(113, len(doc)):
    text = doc[p].get_text()
    if "Actividad Clave" in text or "Actividades Clave" in text:
        print(f"Page {p+1}:")
        print(text[:400])
        print("---")
