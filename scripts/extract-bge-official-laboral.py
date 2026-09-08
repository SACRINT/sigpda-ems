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

SEMESTER_WORDS = {
    "tercer": 3, "tercero": 3,
    "cuarto": 4,
    "quinto": 5,
    "sexto": 6,
    "3er": 3,
    "4°": 4, "4º": 4,
    "5°": 5, "5º": 5,
    "6°": 6, "6º": 6
}

def clean(s):
    if not s:
        return ""
    s = s.replace("\r\n", " ").replace("\n", " ").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def extract_uac_name_from_page(text):
    """Try to extract UAC name from page header area."""
    # Look for UAC name pattern - typically after "UAC 1" or "UAC 2" markers
    m = re.search(r'(?:UAC\s*[12]\s*[:\-–—]?\s*)([A-ZÁÉÍÓÚÜÑ][^:\n]{10,100})', text, re.IGNORECASE)
    if m:
        return clean(m.group(1))
    return ""

def get_outcome(text, next_text):
    """Extract learning outcome from text or next page."""
    # Try current page first
    for t in [text, next_text or ""]:
        m = re.search(
            r'Resultado\s+de\s+aprendizaje\s*(?:[:\-–]?\s*Al\s+finalizar[^:]*:\s*)?(.*?)(?=Actividad\s+[Cc]lave|Actividades\s+para\s+el|$)',
            t, re.DOTALL | re.IGNORECASE
        )
        if m:
            raw = clean(m.group(1))
            if len(raw) > 20:
                return raw
    return ""

def extract_from_pdf(file_name):
    pdf_path = os.path.join(pdf_dir, file_name)
    doc = fitz.open(pdf_path)
    curr_name = PDF_TO_CURRICULUM[file_name]

    uacs = []

    for p in range(len(doc)):
        text = doc[p].get_text()

        # Check if page has all 3 Actividad Clave definitions
        if not (re.search(r'Actividad\s*Clave\s*1', text, re.IGNORECASE) and
                re.search(r'Actividad\s*Clave\s*2', text, re.IGNORECASE) and
                re.search(r'Actividad\s*Clave\s*3', text, re.IGNORECASE)):
            continue

        # Identify semester
        sem = None
        sem_m = re.search(r'(Tercer|Cuarto|Quinto|Sexto|3er|4°|4º|5°|5º|6°|6º)\s+Semestre', text, re.IGNORECASE)
        if sem_m:
            sem = SEMESTER_WORDS.get(sem_m.group(1).lower(), None)

        # Identify UAC number (1 or 2)
        uac_num = None
        uac_m = re.search(r'(?:UAC|Unidad de Aprendizaje Curricular)\s*([12])', text, re.IGNORECASE)
        if uac_m:
            uac_num = int(uac_m.group(1))

        # Extract Actividades Clave
        pattern1 = r'Actividad\s*Clave\s*1\s*:\s*(.*?)(?=\d*\s*Horas|Actividad\s*Clave\s*2|$)'
        pattern2 = r'Actividad\s*Clave\s*2\s*:\s*(.*?)(?=\d*\s*Horas|Actividad\s*Clave\s*3|$)'
        pattern3 = r'Actividad\s*Clave\s*3\s*:\s*(.*?)(?=\d*\s*Horas?(?:\s+de\s+Estudio)?|Ocupaciones|Resultado\s+de|$)'

        m1 = re.search(pattern1, text, re.DOTALL | re.IGNORECASE)
        m2 = re.search(pattern2, text, re.DOTALL | re.IGNORECASE)
        m3 = re.search(pattern3, text, re.DOTALL | re.IGNORECASE)

        if not (m1 and m2 and m3):
            continue

        act1 = re.sub(r'[:\s]+$', '', clean(m1.group(1))).strip()
        act2 = re.sub(r'[:\s]+$', '', clean(m2.group(1))).strip()
        act3 = re.sub(r'[:\s]+$', '', clean(m3.group(1))).strip()

        # Remove trailing hour numbers (e.g. "...vivienda 18")
        act1 = re.sub(r'\s*\d+\s*$', '', act1).strip()
        act2 = re.sub(r'\s*\d+\s*$', '', act2).strip()
        act3 = re.sub(r'\s*\d+\s*$', '', act3).strip()

        # Get outcome
        next_text = doc[p + 1].get_text() if p + 1 < len(doc) else ""
        outcome = get_outcome(text, next_text)

        # Try to get UAC name from context
        uac_name = extract_uac_name_from_page(text)

        uacs.append({
            "page": p + 1,
            "semester": sem,
            "uac_num": uac_num,
            "uac_name": uac_name,
            "activities": [
                {"order": 1, "name": act1, "hours": 18},
                {"order": 2, "name": act2, "hours": 18},
                {"order": 3, "name": act3, "hours": 18}
            ],
            "learning_outcome": outcome,
            "total_hours": 54
        })

    return curr_name, uacs


print("=" * 60)
print("EXTRACTOR OFICIAL BGE — 15 Capacitaciones / 120 UACs")
print("=" * 60)

catalog = {}
total_uacs = 0
total_acts = 0

for f in sorted(PDF_TO_CURRICULUM.keys()):
    curr, uacs = extract_from_pdf(f)
    catalog[curr] = uacs
    total_uacs += len(uacs)
    total_acts += len(uacs) * 3
    status = "OK" if len(uacs) == 8 else f"WARNING EXPECTED 8, GOT {len(uacs)}"
    print(f"  {curr}: {len(uacs)} UACs [{status}]")
    for u in uacs:
        if not u["semester"] or not u["uac_num"]:
            print(f"    WARNING Missing sem/num on page {u['page']}: sem={u['semester']}, num={u['uac_num']}")

print()
print(f"Total: {len(catalog)} capacitaciones | {total_uacs} UACs | {total_acts} actividades")
print()

# Validate
errors = 0
for curr, uacs in catalog.items():
    for u in uacs:
        for a in u["activities"]:
            # Check for boilerplate
            if "diagn" in a["name"].lower() and "técnico" in a["name"].lower():
                print(f"  [ERROR] BOILERPLATE DETECTED in {curr} sem {u['semester']} UAC {u['uac_num']} act {a['order']}")
                errors += 1
            if len(a["name"]) < 10:
                print(f"  [ERROR] Too short in {curr} sem {u['semester']} UAC {u['uac_num']} act {a['order']}: '{a['name']}'")
                errors += 1

if errors == 0:
    print("[OK] Validation passed: 0 boilerplate texts detected")
else:
    print(f"[ERRORS] {errors} validation errors found")

# Save JSON
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bge-laboral-official-catalog.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print()
print(f"[DONE] Saved: scripts/bge-laboral-official-catalog.json")
print(f"   Size: {os.path.getsize(output_path):,} bytes")
