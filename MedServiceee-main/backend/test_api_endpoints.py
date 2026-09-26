"""Test API search endpoints directly with FastAPI TestClient."""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_endpoints():
    print("=== TESTING API SEARCH ENDPOINTS ===")
    
    test_cases = [
        {"name": "Search 'ОАК' in Almaty", "params": {"q": "ОАК", "city": "Алматы"}},
        {"name": "Search 'МРТ' in Astana", "params": {"q": "МРТ", "city": "Астана"}},
        {"name": "Search 'УЗИ' with price filter", "params": {"q": "УЗИ", "city": "Алматы", "min_price": 5000, "max_price": 15000}},
        {"name": "Search 'Терапевт' with sorting", "params": {"q": "Терапевт", "sort_by": "price_asc"}},
        {"name": "Category filter only (лаборатория)", "params": {"category": "лаборатория", "city": "Алматы"}},
        {"name": "Clinics list Almaty", "url": "/api/clinics", "params": {"city": "Алматы"}},
        {"name": "Clinics list Astana", "url": "/api/clinics", "params": {"city": "Астана"}},
        {"name": "Doctors list with specialty", "url": "/api/doctors", "params": {"specialty": "Кардиолог"}},
    ]

    all_passed = True
    for tc in test_cases:
        url = tc.get("url", "/api/search")
        res = client.get(url, params=tc["params"])
        if res.status_code == 200:
            data = res.json()
            print(f"✅ {tc['name']} -> Status 200 OK | Results count: {len(data)}")
        else:
            all_passed = False
            print(f"❌ {tc['name']} -> Failed with status {res.status_code}: {res.text}")

    print("\nAPI Test Result:", "ALL PASSED ✅" if all_passed else "SOME FAILED ❌")

if __name__ == "__main__":
    test_endpoints()
