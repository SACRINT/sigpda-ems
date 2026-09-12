import fitz
import re
import json

pdf_path = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Currículum Fundamental\2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf"

doc = fitz.open(pdf_path)

# Let's inspect pages 13 to 26
for p in range(12, 26):
    text = doc[p].get_text()
    if "Tabla" in text or "Propósitos formativos" in text:
        print(f"--- PÁGINA {p+1} ---")
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        for line in lines[:15]:
            print("  ", line)
