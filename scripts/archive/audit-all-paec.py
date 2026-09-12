import fitz, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')

folder = r'C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[05] Proyectos_PAEC_y_PMC\PAEC-PEC Zona004'
orig_pdfs = [os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith('.pdf') and 'revision' not in f.lower()]

keywords = [
    r'problem[aá]ticas?\s+o\s+necesidades',
    r'problem[aá]tica\s+detectada',
    r'problem[aá]tica\s+comunitaria',
    r'selecci[oó]n\s+del\s+problema',
    r'planteamiento\s+del\s+problema',
    r'problema\s+central',
    r'problema\s+a\s+resolver',
    r'eje\s+central\s+del\s+proyecto',
    r'etapa\s+tres[:\s]+selecci[oó]n\s+del\s+problema',
    r'etapa\s+tres',
    r'diagn[oó]stico\s+comunitario',
    r'descripci[oó]n\s+del\s+problema'
]
combined_regex = re.compile('|'.join(keywords), re.IGNORECASE)

print(f"Auditing {len(orig_pdfs)} full PAEC documents:\n")

for p in orig_pdfs:
    fname = os.path.basename(p)
    doc = fitz.open(p)
    matches = []
    
    for page_num in range(len(doc)):
        txt = doc[page_num].get_text()
        found = combined_regex.findall(txt)
        if found:
            # check if it's not just the index
            lines = [l.strip() for l in txt.split('\n') if l.strip()]
            is_index = any('índice' in l.lower() or 'indice' in l.lower() for l in lines[:5])
            matches.append((page_num + 1, list(set(found)), is_index, txt[:400]))
            
    print(f"=== {fname} ({len(doc)} págs) ===")
    non_index = [m for m in matches if not m[2]]
    if non_index:
        for pg, kws, _, snippet in non_index[:3]:
            print(f"  Pág {pg}: KWs={kws}")
            # print first 150 chars around match
            t = doc[pg-1].get_text()
            for kw in kws:
                m = re.search(re.escape(kw), t, re.IGNORECASE)
                if m:
                    start = max(0, m.start() - 20)
                    end = min(len(t), m.end() + 200)
                    ctx = t[start:end].replace('\n', ' ')
                    print(f"    -> \"{ctx[:180]}...\"")
                    break
    else:
        print("  NO SE ENCONTRARON PALABRAS CLAVE DIRECTAS (fuera de índice)")
    print()
