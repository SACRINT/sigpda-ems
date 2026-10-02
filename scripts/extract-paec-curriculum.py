"""
Extractor Determinista de Propósitos Formativos y Progresiones PAEC 2025-2027
Fuentes oficiales verificadas:
1. [05] DATOS PAEC-PEC/No Usados/PROPOSITOS FORMATIVOS 1ER-6TO SEMESTRE PARA EL PAEC 2025.docx
2. [05] DATOS PAEC-PEC/02 PROPOSITOS FORMATIVOS 1ER-2DO SEMESTRE PARA EL PAEC 2025.pdf
3. [05] DATOS PAEC-PEC/No Usados/PROGRESIONES 3ER-6TO SEMESTRE PAEC 2025.pdf
"""

import os
import re
import json
import docx

BASE_DIR = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[05] Proyectos_PAEC_y_PMC\DATOS PAEC-PEC"
DOCX_ALL = os.path.join(BASE_DIR, "No Usados", "PROPOSITOS FORMATIVOS 1ER-6TO SEMESTRE PARA EL PAEC 2025.docx")
OUTPUT_JSON = os.path.join(r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts", "paec-curriculum-extracted.json")

def clean_text(t: str) -> str:
    return re.sub(r'\s+', ' ', t or '').strip()

def extract_from_docx_tables(doc):
    results = []
    current_sem = 1
    current_uac = None

    for el in doc.element.body:
        tag = el.tag.split('}')[-1]
        if tag == 'p':
            p = docx.text.paragraph.Paragraph(el, doc)
            t = clean_text(p.text)
            if not t:
                continue
            if 'PRIMER SEMESTRE' in t.upper():
                current_sem = 1
            elif 'SEGUNDO SEMESTRE' in t.upper():
                current_sem = 2
            elif 'TERCER SEMESTRE' in t.upper():
                current_sem = 3
            elif 'CUARTO SEMESTRE' in t.upper():
                current_sem = 4
            elif 'QUINTO SEMESTRE' in t.upper():
                current_sem = 5
            elif 'SEXTO SEMESTRE' in t.upper():
                current_sem = 6
            elif not any(h in t.lower() for h in ['propósito', 'contenido']):
                # Could be UAC title
                current_uac = t
        elif tag == 'tbl':
            tbl = docx.table.Table(el, doc)
            if not current_uac:
                continue
            items = []
            for row_idx, row in enumerate(tbl.rows):
                if row_idx == 0:
                    continue # header
                cells = [clean_text(c.text) for c in row.cells]
                if len(cells) >= 2 and (cells[0] or cells[1]):
                    prop = cells[0]
                    cont = cells[1]
                    items.append({
                        "numero": row_idx,
                        "proposito": prop,
                        "contenidos": [c.strip() for c in cont.split(';') if c.strip()] if cont else []
                    })
            if items:
                results.append({
                    "semester": current_sem,
                    "uac_name": current_uac,
                    "model_type": "propositos_contenidos",
                    "contenidos_formativos": items
                })
    return results

def extract_from_docx_numbered(doc):
    results = []
    current_sem = 3
    current_uac = None
    current_items = []

    sem_names = {
        'TERCER SEMESTRE': 3,
        'CUARTO SEMESTRE': 4,
        'QUINTO SEMESTRE': 5,
        'SEXTO SEMESTRE': 6
    }

    in_numbered_zone = False

    for p in doc.paragraphs:
        t = clean_text(p.text)
        if not t:
            continue
        
        found_sem = False
        for s_text, s_num in sem_names.items():
            if s_text in t.upper() and len(t) < 30:
                if current_uac and current_items:
                    results.append({
                        "semester": current_sem,
                        "uac_name": current_uac,
                        "model_type": "propositos_contenidos" if current_sem <= 4 else "progresiones",
                        "contenidos_formativos": current_items
                    })
                    current_items = []
                current_sem = s_num
                in_numbered_zone = True
                found_sem = True
                current_uac = None
                break
        
        if found_sem:
            continue
            
        if not in_numbered_zone:
            continue

        m = re.match(r'^(\d+)\.\s*(.*)', t)
        if m:
            num = int(m.group(1))
            desc = clean_text(m.group(2))
            current_items.append({
                "numero": num,
                "proposito": desc if current_sem <= 4 else None,
                "progresion": desc if current_sem > 4 else None,
                "contenidos": []
            })
        else:
            # Subject header
            if len(t) < 120 and not t.endswith('.'):
                if current_uac and current_items:
                    results.append({
                        "semester": current_sem,
                        "uac_name": current_uac,
                        "model_type": "propositos_contenidos" if current_sem <= 4 else "progresiones",
                        "contenidos_formativos": current_items
                    })
                    current_items = []
                current_uac = t

    if current_uac and current_items:
        results.append({
            "semester": current_sem,
            "uac_name": current_uac,
            "model_type": "propositos_contenidos" if current_sem <= 4 else "progresiones",
            "contenidos_formativos": current_items
        })

    return results

def main():
    print(f"Abriendo {DOCX_ALL}...")
    doc = docx.Document(DOCX_ALL)
    
    print("Extrayendo tablas de Semestres 1 y 2...")
    tables_res = extract_from_docx_tables(doc)
    print(f"-> {len(tables_res)} materias extraidas de tablas")
    
    print("Extrayendo listas numeradas de Semestres 3 al 6...")
    numbered_res = extract_from_docx_numbered(doc)
    print(f"-> {len(numbered_res)} materias extraidas de listas numeradas")
    
    total = tables_res + numbered_res
    print(f"Total UACs extraidas: {len(total)}")
    
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(total, f, ensure_ascii=False, indent=2)
    print(f"Guardado exitosamente en: {OUTPUT_JSON}")

if __name__ == '__main__':
    main()
