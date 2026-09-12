with open('scripts/extract_all_canonical_curriculum.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'f"' in line or "f'" in line:
            print(f"{i}: {line.strip()}")
