import os, re, json, fitz, unicodedata

def clean(t):
    if not t: return ""
    t = t.replace("\xa0", " ").replace("\r\n", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", t).strip()

def strip_accents(text):
    if not text: return ""
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

fund_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Currículum Fundamental"

# Scan all 8 PDFs for table pages
books = [f for f in os.listdir(fund_dir) if f.startswith("2025_") and f.endswith(".pdf")]

all_extracted = []

for bname in books:
    doc = fitz.open(os.path.join(fund_dir, bname))
    print(f"\n--- {bname} ({len(doc)} pages) ---")
    
    # Find table start pages
    for p_idx in range(10, min(30, len(doc))):
        text = doc[p_idx].get_text()
        norm = strip_accents(text).lower()
        if "propositos formativos" in norm and ("contenidos formativos" in norm or "contenidos" in norm):
            # Extract UAC name from page or previous page
            combined = ""
            if p_idx > 0: combined += doc[p_idx-1].get_text() + "\n"
            combined += text
            
            # Look for asignatura name
            m_name = re.search(r'Nombre de la asignatura\s*[:\s]*([^\n\r]+?)(?:Meta educativa|Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|\d+\s*horas)', combined, re.I)
            uac_name = clean(m_name.group(1)) if m_name else ""
            
            # Semester
            sem = None
            for s_str, s_num in [("primer", 1), ("segundo", 2), ("tercer", 3), ("cuarto", 4), ("quinto", 5), ("sexto", 6)]:
                if f"{s_str} semestre" in norm or (uac_name and f"{s_str} semestre" in strip_accents(combined).lower()):
                    sem = s_num
                    break
            if not sem:
                # Try roman numeral in uac_name
                if re.search(r'\bVI\b', uac_name): sem = 6
                elif re.search(r'\bIV\b', uac_name): sem = 4
                elif re.search(r'\bV\b', uac_name): sem = 5
                elif re.search(r'\bIII\b', uac_name): sem = 3
                elif re.search(r'\bII\b', uac_name): sem = 2
                elif re.search(r'\bI\b', uac_name): sem = 1

            # Meta educativa
            meta_m = re.search(r'Meta educativa\s*[:\s]*([\s\S]+?)(?:Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|Horas/semana|Propósitos formativos)', combined, re.I)
            meta_educativa = clean(meta_m.group(1)) if meta_m else None

            # Extract blocks from p_idx and p_idx + 1
            p1 = doc[p_idx]
            p2 = doc[p_idx + 1] if p_idx + 1 < len(doc) else None
            
            b1 = p1.get_text("blocks")
            b2 = p2.get_text("blocks") if p2 else []
            
            props = []
            conts = []
            
            for b in b1:
                if b[1] < 380 and ("Tabla" in b[4] or "Nombre de" in b[4] or "Meta educativa" in b[4]): continue
                if b[1] > 740: continue # footer
                btext = b[4].strip()
                if "Propósitos formativos" in btext or "Contenidos" in btext: continue
                if b[0] < 310:
                    props.append((b[1], btext))
                else:
                    conts.append((b[1], btext))
                    
            if p2:
                # Check if p2 is continuation of table
                p2_text = strip_accents(p2.get_text()).lower()
                if "fuente:" in p2_text or "propósitos formativos" in p2_text or (b2 and any(b[1] < 400 and b[0] < 310 for b in b2)):
                    for b in b2:
                        if b[1] < 120 or b[1] > 740: continue
                        btext = b[4].strip()
                        if "Propósitos formativos" in btext or "Contenidos" in btext or "Fuente:" in btext: continue
                        if b[0] < 310:
                            props.append((b[1] + 1000, btext))
                        else:
                            conts.append((b[1] + 1000, btext))

            # Group props by number
            parsed_items = []
            for y, text in props:
                m_num = re.match(r'^(\d{1,2})\s+([A-ZÁÉÍÓÚ].*)', text, re.DOTALL)
                if m_num:
                    order = int(m_num.group(1))
                    prop_text = clean(m_num.group(2))
                    parsed_items.append({'order': order, 'y': y, 'prop': prop_text, 'conts': []})
                elif parsed_items:
                    parsed_items[-1]['prop'] += " " + clean(text)

            # Associate contents
            for lg in parsed_items:
                for ry, rtext in conts:
                    if abs(ry - lg['y']) < 140 or (lg['y'] < 1000 and ry < 1000 and abs(ry - lg['y']) < 160) or (lg['y'] >= 1000 and ry >= 1000 and abs(ry - lg['y']) < 160):
                        lines = [clean(l) for l in rtext.split('\n') if len(clean(l)) > 2]
                        lg['conts'].extend(lines)

            if parsed_items and (uac_name or sem):
                all_extracted.append((bname, uac_name, sem, len(parsed_items)))
                print(f"  P{p_idx+1}: {uac_name} (Sem {sem}) -> {len(parsed_items)} propósitos")

print(f"\nTotal extraídas: {len(all_extracted)}")
