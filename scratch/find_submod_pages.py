import fitz # PyMuPDF
import re

doc = fitz.open(r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas\vBrm4pCEKV-PROGRAMACION.pdf')

print("Total pages:", len(doc))

found = []
for i in range(len(doc)):
    text = doc[i].get_text("text")
    if "programa de estudio del submódulo" in text.lower() or "desarrollo del submódulo" in text.lower() or "propósito del submódulo" in text.lower() or "contenido formativo" in text.lower() or "aprendizajes esperados" in text.lower() or "resultado de aprendizaje" in text.lower() or "competencias laborales del submódulo" in text.lower():
        found.append((i+1, text[:300].replace('\n', ' ')))

print(f"Found {len(found)} candidate pages:")
for p, snippet in found[:15]:
    print(f"  Page {p}: {snippet}")
