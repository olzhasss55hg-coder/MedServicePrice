"""Database seed entry point."""
from seed_real_data import seed_db
try:
    import search
    search_available = True
except Exception:
    search_available = False

if __name__ == "__main__":
    print("Starting database seeding...")
    seed_db()
    if search_available:
        try:
            print("Indexing services into MeiliSearch...")
            search.init_meilisearch()
            search.index_all_services()
        except Exception as e:
            print(f"MeiliSearch indexing skipped: {e}")
    print("Seeding finished successfully.")
