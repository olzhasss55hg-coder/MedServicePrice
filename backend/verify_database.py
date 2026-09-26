"""Database and API verification script with utf-8 encoding."""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from database import SessionLocal
from models import Clinic, Doctor, Service, Price, PriceHistory, PromoCode

def verify():
    db = SessionLocal()
    try:
        clinics_count = db.query(Clinic).count()
        doctors_count = db.query(Doctor).count()
        services_count = db.query(Service).count()
        prices_count = db.query(Price).count()
        history_count = db.query(PriceHistory).count()
        promos_count = db.query(PromoCode).count()

        print("=== DATABASE VERIFICATION RESULTS ===")
        print(f"Clinics count: {clinics_count} (Required >= 20): {'PASS' if clinics_count >= 20 else 'FAIL'}")
        print(f"Doctors count: {doctors_count} (Required >= 60): {'PASS' if doctors_count >= 60 else 'FAIL'}")
        print(f"Services count: {services_count} (Required >= 100): {'PASS' if services_count >= 100 else 'FAIL'}")
        print(f"Prices count: {prices_count}")
        print(f"Price History count: {history_count}")
        print(f"Promo Codes count: {promos_count}")

        # Check Almaty and Astana clinics
        almaty_clinics = db.query(Clinic).filter(Clinic.city == "Алматы").all()
        astana_clinics = db.query(Clinic).filter(Clinic.city == "Астана").all()
        print(f"\nAlmaty Clinics ({len(almaty_clinics)}):")
        for c in almaty_clinics:
            print(f" - {c.name} | {c.address} | Lat: {c.latitude}, Lng: {c.longitude}")

        print(f"\nAstana Clinics ({len(astana_clinics)}):")
        for c in astana_clinics:
            print(f" - {c.name} | {c.address} | Lat: {c.latitude}, Lng: {c.longitude}")

        # Test search query simulation
        from main import resolve_search_category
        print("\n=== SEARCH RESOLVER CHECKS ===")
        for q in ["ОАК", "УЗИ брюшной", "МРТ", "КТ", "Терапевт", "Анализы", "Приём врача", "Процедуры"]:
            cat = resolve_search_category(q)
            print(f" Query '{q}' -> Resolved Category: {cat}")

    finally:
        db.close()

if __name__ == "__main__":
    verify()
