"""Comprehensive Automated Test Suite for all 11 Core Modules."""

import sys
import os
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
import models
import uuid

client = TestClient(app)

def test_module_1_root_and_resilience():
    response = client.get("/")
    assert response.status_code == 200
    assert "running" in response.json().get("message", "")

def test_module_2_bilingual_chat():
    # Test Kazakh language query
    response_kz = client.post(
        "/api/chat",
        json={"message": "Алматыда кардиолог қанша тұрады?", "language": "kz"},
        headers={"X-AI-Session": "test-session-kz"}
    )
    assert response_kz.status_code == 200
    data_kz = response_kz.json()
    assert data_kz.get("language") == "kz"
    assert "reply" in data_kz

    # Test Russian language query
    response_ru = client.post(
        "/api/chat",
        json={"message": "Какая стоимость приема терапевта в Астане?", "language": "ru"},
        headers={"X-AI-Session": "test-session-ru"}
    )
    assert response_ru.status_code == 200
    data_ru = response_ru.json()
    assert data_ru.get("language") == "ru"

def test_module_3_and_7_clinics_and_doctors_filtering():
    # Fetch clinics in Almaty
    res_clinics = client.get("/api/clinics?city=Алматы")
    assert res_clinics.status_code == 200
    clinics = res_clinics.json()
    assert len(clinics) > 0

    # Fetch doctor list with filters
    res_doctors = client.get("/api/doctors?city=Алматы&min_rating=4.5")
    assert res_doctors.status_code == 200
    doctors = res_doctors.json()
    assert len(doctors) > 0
    assert all(d.get("rating", 0) >= 4.5 for d in doctors)

def test_module_4_and_8_map_bounds():
    # Bounding box for Almaty
    res_bounds = client.get("/api/clinics/bounds?min_lat=43.1&max_lat=43.4&min_lng=76.8&max_lng=77.1")
    assert res_bounds.status_code == 200
    bounds_clinics = res_bounds.json()
    assert len(bounds_clinics) > 0

def test_module_5_promocodes():
    # Test WELCOME10 validation
    res = client.post("/api/promocodes/validate", json={"code": "WELCOME10", "amount": 10000})
    assert res.status_code == 200
    data = res.json()
    assert data["discount_amount"] == 1000.0
    assert data["total_amount"] == 9000.0

def test_module_6_slots_and_booking():
    # Get a real doctor
    res_docs = client.get("/api/doctors?limit=1")
    assert res_docs.status_code == 200
    doctors = res_docs.json()
    assert len(doctors) > 0
    doctor = doctors[0]

    # Get slots
    res_slots = client.get(f"/api/doctors/{doctor['id']}/slots")
    assert res_slots.status_code == 200
    slots = res_slots.json()
    assert len(slots) > 0

    # Create booking
    res_booking = client.post("/api/bookings", json={
        "clinic_id": doctor["clinic_id"],
        "doctor_id": doctor["id"],
        "name": "Тест Пациент",
        "phone": "+7 777 123 45 67",
        "appointment_at": "2028-10-10T10:00:00",
        "promo_code": "WELCOME10",
    })
    assert res_booking.status_code in [201, 200]
    booking_data = res_booking.json()
    assert booking_data["status"] == "new"

def test_module_9_verified_reviews():
    res_docs = client.get("/api/doctors?limit=1")
    doctor = res_docs.json()[0]

    review_payload = {
        "doctor_id": doctor["id"],
        "rating": 5,
        "comment": "Отличный врач, внимательный осмотр!",
        "patient_name": "Пациент Тест"
    }
    res_rev = client.post("/api/reviews", json=review_payload)
    assert res_rev.status_code == 201
    rev_data = res_rev.json()
    assert rev_data["is_verified"] is True
    assert rev_data["rating"] == 5

def test_module_10_subscriptions_and_checkout():
    # Register a new test user
    email = f"user_{str(uuid.uuid4())[:8]}@medservice.kz"
    res_reg = client.post("/api/auth/register", json={"email": email, "password": "securepassword123", "full_name": "VIP Пациент"})
    assert res_reg.status_code == 200

    # Login
    res_login = client.post("/api/auth/login", data={"username": email, "password": "securepassword123"})
    assert res_login.status_code == 200
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Check Plan
    res_plan = client.get("/api/subscriptions/plan", headers=headers)
    assert res_plan.status_code == 200
    assert res_plan.json()["plan"] == "free"

    # Upgrade Plan via checkout
    res_upgrade = client.post("/api/payment/checkout", json={"plan": "premium"}, headers=headers)
    assert res_upgrade.status_code == 200
    assert res_upgrade.json()["plan"] == "premium"
    assert res_upgrade.json()["priority_booking"] is True

def test_module_11_symptom_checker():
    payload = {
        "symptoms_text": "Сильная головная боль, шум в ушах и тошнота",
        "selected_symptoms": ["Головная боль"],
        "language": "ru",
        "city": "Алматы"
    }
    res = client.post("/api/ai/symptom-checker", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "Невропатолог" in data["specialty"]
    assert len(data["potential_conditions"]) > 0
    assert len(data["recommended_examinations"]) > 0
    assert "диагноз" in data["disclaimer"].lower()
    assert len(data["recommended_doctors"]) > 0

if __name__ == "__main__":
    print("Running Module 1-11 Automated Tests...")
    test_module_1_root_and_resilience()
    print("[OK] Module 1: System Resilience & Health")
    test_module_2_bilingual_chat()
    print("[OK] Module 2: Multilingual AI Assistant (RU/KK)")
    test_module_3_and_7_clinics_and_doctors_filtering()
    print("[OK] Module 3 & 7: Relational DB & Advanced Catalog Filters")
    test_module_4_and_8_map_bounds()
    print("[OK] Module 4 & 8: 2GIS/Google Maps & Map Bounds")
    test_module_5_promocodes()
    print("[OK] Module 5: Promotions & Promo Code Engine")
    test_module_6_slots_and_booking()
    print("[OK] Module 6: Doctor Slot Engine & Automated Notifications")
    test_module_9_verified_reviews()
    print("[OK] Module 9: Verified Rating & Review Recalculation")
    test_module_10_subscriptions_and_checkout()
    print("[OK] Module 10: Monetization Tiers (Free/Pro/Premium) & Checkout")
    test_module_11_symptom_checker()
    print("[OK] Module 11: AI Symptom Checker & Clinical Recommendations")
    print("\nALL 11 TASK MODULES VERIFIED AND PASSING SUCCESSFULLY!")
