import os
import re
import fitz

pdf_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024"
pdf_files = sorted([f for f in os.listdir(pdf_dir) if f.endswith(".pdf")])

for f in pdf_files:
    doc = fitz.open(os.path.join(pdf_dir, f))
    uac_info_pages = []
    for p in range(len(doc)):
        text = doc[p].get_text()
        if ("Información general del programa" in text or "Información General del Programa" in text) and ("Actividad Clave 1" in text or "Actividades Clave" in text):
            uac_info_pages.append(p + 1)
    print(f"{f}: Found {len(uac_info_pages)} UAC info pages -> {uac_info_pages}")
