import os
import re
import fitz

doc = fitz.open(r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024\Procesos_Culinarios_y_Reposteria_2024.pdf")

text = doc[130].get_text() # Page 131

pattern1 = r'Actividad\s*Clave\s*1\s*:\s*(.*?)(?:Horas|Actividad\s*Clave\s*2|$)'
pattern2 = r'Actividad\s*Clave\s*2\s*:\s*(.*?)(?:Horas|Actividad\s*Clave\s*3|$)'
pattern3 = r'Actividad\s*Clave\s*3\s*:\s*(.*?)(?:Horas|Horas de Estudio|Ocupaciones|$)'

m1 = re.search(pattern1, text, re.DOTALL | re.IGNORECASE)
m2 = re.search(pattern2, text, re.DOTALL | re.IGNORECASE)
m3 = re.search(pattern3, text, re.DOTALL | re.IGNORECASE)

print("Page 131 match:")
print("Act 1:", m1.group(1).replace("\n", " ").strip() if m1 else "None")
print("Act 2:", m2.group(1).replace("\n", " ").strip() if m2 else "None")
print("Act 3:", m3.group(1).replace("\n", " ").strip() if m3 else "None")
