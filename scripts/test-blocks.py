import fitz

pdf_path = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Currículum Fundamental\2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf"
doc = fitz.open(pdf_path)

# Check blocks on page 18 (0-indexed 17)
page = doc[17]
blocks = page.get_text("blocks")
print(f"Total blocks on page 18: {len(blocks)}")
for b in blocks:
    # b is (x0, y0, x1, y1, text, block_no, block_type)
    text = b[4].strip().replace('\n', ' ')
    if len(text) > 5:
        print(f"  bbox=({int(b[0])},{int(b[1])} -> {int(b[2])},{int(b[3])}) : {text[:80]}...")
