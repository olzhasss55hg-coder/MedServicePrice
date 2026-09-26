import sqlite3
import json
import os

db_path = 'backend/medservice.db'
if not os.path.exists(db_path):
    db_path = 'medservice.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

def get_table(name):
    try:
        cursor.execute(f"SELECT * FROM {name}")
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            # convert boolean-like ints
            for k, v in d.items():
                if isinstance(v, bytes):
                    d[k] = v.decode('utf-8', errors='ignore')
            result.append(d)
        return result
    except Exception as e:
        print(f"Warning on {name}: {e}")
        return []

data = {
    'clinics': get_table('clinics'),
    'doctors': get_table('doctors'),
    'services': get_table('services'),
    'prices': get_table('prices'),
    'promotions': get_table('promotions'),
    'promo_codes': get_table('promo_codes'),
    'reviews': get_table('reviews'),
}

os.makedirs('src/data', exist_ok=True)
with open('src/data/mock_db.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Exported successfully to src/data/mock_db.json:")
print(f" - Clinics: {len(data['clinics'])}")
print(f" - Doctors: {len(data['doctors'])}")
print(f" - Services: {len(data['services'])}")
print(f" - Prices: {len(data['prices'])}")
print(f" - Promo codes: {len(data['promo_codes'])}")
print(f" - Reviews: {len(data['reviews'])}")
