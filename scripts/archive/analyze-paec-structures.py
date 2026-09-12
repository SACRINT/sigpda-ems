import fitz, os, glob, re, sys

sys.stdout.reconfigure(encoding='utf-8')

folder = r'C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[05] Proyectos_PAEC_y_PMC\PAEC-PEC Zona004'
all_files = [os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith('.pdf')]
pdfs = all_files[:6]

# Also include the user's specific PDF
user_pdf = r'C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[05] Proyectos_PAEC_y_PMC\PAEC-PEC_2025-2026_21EBH0200X_HÉROES DE LA PATRIA(1er y 2do SEM).pdf'
pdfs.insert(0, user_pdf)

for p in pdfs:
    fname = os.path.basename(p)
    try:
        doc = fitz.open(p)
        print(f"\n=======================================================")
        print(f"FILE: {fname} (Total pages: {len(doc)})")
        print(f"=======================================================")
        
        found_pages = []
        for page_num in range(len(doc)):
            txt = doc[page_num].get_text()
            if re.search(r'problem[aá]tica|necesidades\s+de\s+la\s+comunidad|selecci[oó]n\s+del\s+problema|planteamiento\s+del\s+problema|problema\s+central', txt, re.IGNORECASE):
                found_pages.append(page_num + 1)
        print(f"Pages matching problem keywords: {found_pages}")
        
        for pg in found_pages:
            t = doc[pg-1].get_text()
            lines = [l.strip() for l in t.split('\n') if l.strip()]
            for j, l in enumerate(lines):
                if re.search(r'problem[aá]ticas?\s+o\s+necesidades|selecci[oó]n\s+del\s+problema|planteamiento\s+del\s+problema|problem[aá]tica\s+central|problem[aá]tica\s+detectada|problema\s+a\s+resolver|eje\s+central\s+del\s+proyecto', l, re.IGNORECASE):
                    print(f"  [Página {pg}] Match: \"{l}\"")
                    snippet = " // ".join(lines[j:min(len(lines), j+10)])
                    print(f"    Snippet: {snippet[:300]}")
                    break
    except Exception as e:
        print(f"Error reading {fname}: {e}")
