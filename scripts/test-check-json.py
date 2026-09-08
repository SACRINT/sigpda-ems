import os
import re
import json
import fitz

pdf_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024"

PDF_TO_CURRICULUM = {
    "Administracion_2024.pdf": "Administración",
    "Agricultura_Sostenible_de_Traspatio_2024.pdf": "Agricultura Sostenible de Traspatio",
    "Area_de_la_Salud_2024.pdf": "Área de la Salud",
    "Comunicacion_Grafica_2024.pdf": "Comunicación Gráfica",
    "Contabilidad_2024.pdf": "Contabilidad",
    "Domotica_2024.pdf": "Domótica",
    "Instalaciones_Residenciales_2024.pdf": "Instalaciones Residenciales",
    "Mecanica_Dental_2024.pdf": "Mecánica Dental",
    "Preparacion_de_Alimentos_Artesanales_2024.pdf": "Preparación de Alimentos Artesanales",
    "Procesos_Culinarios_y_Reposteria_2024.pdf": "Procesos Culinarios y Repostería",
    "Redes_y_Mantenimiento_2024.pdf": "Redes y Mantenimiento",
    "Servicios_Ecosistemicos_2024.pdf": "Servicios Ecosistémicos",
    "Sistemas_Electricos_2024.pdf": "Sistemas Eléctricos",
    "Tecnologia_Informatica_2024.pdf": "Tecnología Informática",
    "Turismo_2024.pdf": "Turismo",
}

def clean(s):
    if not s:
        return ""
    s = s.replace("\r\n", " ").replace("\n", " ").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

# Load DB uacs to match
with open(r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\matched-laboral-complete.json", "r", encoding="utf-8") as f:
    db_uacs = json.load(f)

print("DB UACs loaded.")
