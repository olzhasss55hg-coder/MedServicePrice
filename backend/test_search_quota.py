import uuid
from fastapi.testclient import TestClient
from main import app, FREE_SEARCH_LIMIT
import models
from database import SessionLocal

client = TestClient(app)

def test_search_quota_flow():
    # 1. Test guest quota
    guest_session = f"test-guest-{uuid.uuid4()}"
    headers = {"X-Search-Session": guest_session}

    # Initial quota check
    res = client.get("/api/search/quota", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["searches_used"] == 0
    assert data["remaining"] == 20
    assert data["is_unlimited"] is False

    # Perform 20 searches
    for i in range(20):
        r = client.get("/api/search?city=Алматы", headers=headers)
        assert r.status_code == 200, f"Search {i+1} failed: {r.text}"
        assert r.headers.get("X-Search-Remaining") == str(19 - i)

    # 21st search MUST return 402 Payment Required
    r21 = client.get("/api/search?city=Алматы", headers=headers)
    assert r21.status_code == 402, f"Expected 402, got {r21.status_code}: {r21.text}"
    detail = r21.json()["detail"]
    assert detail["limit_reached"] is True
    assert detail["searches_used"] >= 20
    print("✓ Guest 20 search limit & 402 blocking verified!")

    # 2. Test registered user upgrade to Standard and Premium
    user_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post("/api/auth/register", json={
        "email": user_email,
        "password": "Password123!",
        "full_name": "Test User"
    })
    assert reg_res.status_code == 200, reg_res.text

    login_res = client.post("/api/auth/login", data={"username": user_email, "password": "Password123!"})
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Upgrade to Standard
    std_upgrade = client.post("/api/payment/checkout", json={"plan": "standard"}, headers=auth_headers)
    assert std_upgrade.status_code == 200, std_upgrade.text
    assert std_upgrade.json()["plan"] == "standard"
    assert std_upgrade.json()["is_unlimited_search"] is True

    # Check search is unlimited
    quota_res = client.get("/api/search/quota", headers=auth_headers)
    assert quota_res.status_code == 200
    assert quota_res.json()["is_unlimited"] is True
    assert quota_res.json()["plan"] == "standard"

    # Search works without decrements
    search_std = client.get("/api/search?city=Алматы", headers=auth_headers)
    assert search_std.status_code == 200
    assert search_std.headers.get("X-Search-Unlimited") == "true"
    print("✓ Standard plan unlimited search verified!")

    # Upgrade to Premium
    prem_upgrade = client.post("/api/payment/checkout", json={"plan": "premium"}, headers=auth_headers)
    assert prem_upgrade.status_code == 200, prem_upgrade.text
    assert prem_upgrade.json()["plan"] == "premium"
    assert prem_upgrade.json()["priority_booking"] is True

    # Test VIP Booking sorting
    db = SessionLocal()
    clinic = db.query(models.Clinic).first()
    doctor = db.query(models.Doctor).first()
    db.close()

    if clinic:
        booking_res = client.post("/api/bookings", json={
            "clinic_id": clinic.id,
            "doctor_id": doctor.id if doctor else None,
            "name": "VIP Patient",
            "phone": "+7 777 123 4567",
        }, headers=auth_headers)
        assert booking_res.status_code == 201, booking_res.text
        assert booking_res.json()["priority_booking"] is True
        print("✓ Premium VIP priority booking verified!")

    print("\nALL BACKEND SEARCH LIMIT & MONETIZATION TIERS TESTS PASSED! 🎉")

if __name__ == "__main__":
    test_search_quota_flow()
