content = open('src/lib/bt-carreras-catalog.ts', encoding='utf-8').read()
idx = content.find('"id": "programacion"')
if idx != -1:
    print(content[idx:idx+1500])
else:
    print("Not found")
