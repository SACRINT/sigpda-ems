import fitz

doc = fitz.open(r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas\vBrm4pCEKV-PROGRAMACION.pdf')

for page_no in [18, 19]:
    page = doc[page_no]
    blocks = page.get_text("blocks")
    print(f"\n================ PAGE {page_no+1} ({len(blocks)} blocks) ================")
    for b in blocks:
        # b = (x0, y0, x1, y1, text, block_no, block_type)
        text = b[4].strip().replace('\n', ' ')
        if len(text) > 20 and not all(c in ' Xx-' for c in text):
            print(f"[{b[0]:.0f}, {b[1]:.0f}] {text[:120]}")
