from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_queries():
    test_queries = [
        ("Прием врача", "Алматы"),
        ("прием терапевта", "Алматы"),
        ("Анализы", "Алматы"),
        ("УЗИ", "Алматы"),
        ("МРТ", "Алматы"),
        ("Прием врача", "Астана"),
        ("ОАК", "Астана"),
    ]

    for q, city in test_queries:
        res = client.get(f"/api/search?q={q}&city={city}")
        assert res.status_code == 200
        data = res.json()
        print(f"Query '{q}' in '{city}': {len(data)} results returned")
        if data:
            first = data[0]
            print(f"   First match: {first['service']['name_raw']} - Min Price: {first['min_price']} KZT in {first['best_offer_clinic']['name']}")
            assert first['best_offer_clinic']['latitude'] is not None
            assert first['best_offer_clinic']['longitude'] is not None

if __name__ == "__main__":
    test_queries()
    print("ALL SEARCH TESTS PASSED!")
