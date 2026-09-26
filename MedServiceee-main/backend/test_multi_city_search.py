import sys
import unittest
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, 'backend')

from fastapi.testclient import TestClient
from main import app

class TestMultiCitySearch(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_search_queries(self):
        tests = [
            ("q=Анализы&city=Астана", "Astana Lab", "Астана"),
            ("q=Анализы&city=г.+Астана", "Astana Lab with г.", "Астана"),
            ("q=Анализы&city=Astana", "Astana Lab Latin", "Астана"),
            ("q=УЗИ&city=Алматы", "Almaty UZI", "Алматы"),
            ("q=УЗИ&city=г.+Алматы", "Almaty UZI with г.", "Алматы"),
            ("q=Приём+врача&city=Павлодар", "Pavlodar Appointments", "Павлодар"),
            ("q=Прием+врача&city=Павлодар", "Pavlodar Appointments (e)", "Павлодар"),
            ("q=МРТ&city=Шымкент", "Shymkent MRI", "Шымкент"),
            ("q=КТ&city=Қарағанды", "Karaganda CT", "Қарағанды"),
            ("q=Рентген&city=Ақтөбе", "Aktobe X-Ray", "Ақтөбе"),
        ]

        print("\n=== RUNNING MULTI-CITY TARGET SEARCH TESTS ===")
        for query_params, label, expected_city in tests:
            r = self.client.get(f"/api/search?{query_params}")
            self.assertEqual(r.status_code, 200, f"Failed HTTP status for {label}")
            items = r.json()
            self.assertGreater(len(items), 0, f"Query '{query_params}' ({label}) returned 0 items!")
            first = items[0]
            clinic = first["best_offer_clinic"]
            print(f"[PASS] {label} -> {len(items)} offers found. Top: {first['service']['name_raw']} at {clinic['name']} ({clinic['city']}) - {first['best_offer_price']} KZT")
            self.assertEqual(clinic["city"], expected_city)

    def test_clinics_endpoint_by_city(self):
        cities = ["Астана", "Алматы", "Павлодар", "Шымкент", "Қарағанды", "Ақтөбе"]
        print("\n=== TESTING /api/clinics FOR ALL 6 CITIES ===")
        for city in cities:
            r = self.client.get(f"/api/clinics?city={city}")
            self.assertEqual(r.status_code, 200)
            clinics = r.json()
            self.assertGreater(len(clinics), 0, f"No clinics returned for city {city}")
            print(f"[PASS] {city}: {len(clinics)} clinics returned.")

    def test_doctors_endpoint_by_city(self):
        cities = ["Астана", "Алматы", "Павлодар", "Шымкент", "Қарағанды", "Ақтөбе"]
        print("\n=== TESTING /api/doctors FOR ALL 6 CITIES ===")
        for city in cities:
            r = self.client.get(f"/api/doctors?city={city}")
            self.assertEqual(r.status_code, 200)
            doctors = r.json()
            self.assertGreater(len(doctors), 0, f"No doctors returned for city {city}")
            print(f"[PASS] {city}: {len(doctors)} doctors returned.")

if __name__ == "__main__":
    unittest.main()
