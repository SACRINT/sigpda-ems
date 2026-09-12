import fitz

doc = fitz.open(r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas\vBrm4pCEKV-PROGRAMACION.pdf')

page19 = doc[18]
tab_finder = page19.find_tables()
tables = tab_finder.tables
print(f"Tables found on page 19: {len(tables)}")
for t_idx, tab in enumerate(tables):
    df = tab.extract()
    print(f"\n--- Table {t_idx+1} ({len(df)} rows) ---")
    for r_idx, row in enumerate(df[:10]):
        cleaned = [c.replace('\n', ' ') if c else '' for c in row]
        print(f"Row {r_idx}: {cleaned[:4]}")
