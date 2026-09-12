import fitz
import unicodedata
import re
import os
import json

def strip_accents(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def clean(t):
    if not t: return ""
    t = t.replace("\xa0", " ").replace("\r\n", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", t).strip()

pdf_path = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Currículum Fundamental\2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf"
doc = fitz.open(pdf_path)

# Scan for all tables
tables_found = []
for p in range(len(doc)):
    page = doc[p]
    raw_text = page.get_text()
    norm_text = strip_accents(raw_text).lower()
    
    if "tabla" in norm_text and ("propositos y contenidos" in norm_text or ("nombre de la asignatura" in norm_text and "meta educativa" in norm_text)):
        tables_found.append(p)

print("Páginas de tablas encontradas en Pensamiento Matemático:", tables_found)

SEMS = [
    (1, "Pensamiento Matemático I", 13),
    (2, "Pensamiento Matemático II", 15),
    (3, "Pensamiento Matemático III", 17),
    (4, "Pensamiento Matemático IV", 19),
    (5, "Pensamiento Matemático V", 21),
    (6, "Pensamiento Matemático VI", 23),
]

for sem, expected_name, p_start in SEMS:
    p1 = doc[p_start]
    p2 = doc[p_start + 1] if p_start + 1 < len(doc) else None
    
    # Extract blocks
    b1 = p1.get_text("blocks")
    b2 = p2.get_text("blocks") if p2 else []
    
    # Left column: x0 < 310, Right column: x0 >= 315
    props = []
    conts = []
    
    # On p1: skip header blocks (above y=480)
    for b in b1:
        if b[1] < 450: continue
        if b[1] > 740: continue # footer
        text = b[4].strip()
        if "Propósitos formativos" in text or "Contenidos" in text: continue
        if b[0] < 310:
            props.append((b[1], text))
        else:
            conts.append((b[1], text))
            
    # On p2:
    for b in b2:
        if b[1] < 140: continue # header
        if b[1] > 740: continue # footer
        text = b[4].strip()
        if "Propósitos formativos" in text or "Contenidos" in text or "Fuente:" in text: continue
        if b[0] < 310:
            props.append((b[1] + 1000, text))
        else:
            conts.append((b[1] + 1000, text))
            
    # Reassemble purposes by order number
    parsed_items = []
    for y, text in props:
        # Check if starts with a number e.g. "1 ", "2 "
        m = re.match(r'^(\d{1,2})\s+([A-ZÁÉÍÓÚ].*)', text, re.DOTALL)
        if m:
            order = int(m.group(1))
            prop_text = clean(m.group(2))
            parsed_items.append({'order': order, 'y': y, 'prop': prop_text, 'conts': []})
        elif parsed_items:
            parsed_items[-1]['prop'] += " " + clean(text)
            
    # Associate contents
    for lg in parsed_items:
        for ry, rtext in conts:
            if abs(ry - lg['y']) < 140 or (lg['y'] < 1000 and ry < 1000 and abs(ry - lg['y']) < 160) or (lg['y'] >= 1000 and ry >= 1000 and abs(ry - lg['y']) < 160):
                lines = [clean(l) for l in rtext.split('\n') if len(clean(l)) > 2]
                lg['conts'].extend(lines)
                
    print(f"\n==========================================")
    print(f"Semestre {sem}: {expected_name} ({len(parsed_items)} propósitos)")
    for pi in sorted(parsed_items, key=lambda x: x['order']):
        print(f"  [{pi['order']}] {pi['prop'][:70]}... -> {len(pi['conts'])} contenidos")
        for c in pi['conts'][:3]:
            print(f"      • {c}")
