from datetime import datetime, timezone

try:
    from ..database import SessionLocal, init_db
    from ..models.resources import Resource
except ImportError:
    from database import SessionLocal, init_db  # type: ignore
    from models.resources import Resource  # type: ignore


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


SEED_RESOURCES = [
    {
        "title": "Cook County Circuit Court - Domestic Relations",
        "category": "court",
        "jurisdiction_country": "US",
        "jurisdiction_state": "IL",
        "jurisdiction_city": "Chicago",
        "court_level": "family",
        "case_types": '["family", "custody", "divorce"]',
        "description": "Family court division handling divorce, custody, and support cases.",
        "eligibility": "Open to parties with active family law matters.",
        "cost_type": "varies",
        "phone": "(312) 603-6300",
        "website_url": "https://www.cookcountycourt.org/",
        "address_line1": "50 W Washington St",
        "postal_code": "60602",
        "hours": "Mon-Fri 8:30 AM - 4:30 PM",
        "languages": '["en", "es"]',
        "action_label": "Visit Court Website",
        "action_url": "https://www.cookcountycourt.org/",
        "source_name": "Cook County Circuit Court",
        "source_url": "https://www.cookcountycourt.org/",
        "priority_score": 90,
    },
    {
        "title": "Illinois Legal Aid Online",
        "category": "legal_aid",
        "jurisdiction_country": "US",
        "jurisdiction_state": "IL",
        "jurisdiction_city": "Statewide",
        "court_level": None,
        "case_types": '["housing", "family", "employment", "consumer"]',
        "description": "Free legal self-help resources and referral tools for Illinois residents.",
        "eligibility": "Illinois residents.",
        "cost_type": "free",
        "phone": None,
        "website_url": "https://www.illinoislegalaid.org/",
        "address_line1": None,
        "postal_code": None,
        "hours": "24/7 online",
        "languages": '["en", "es", "pl"]',
        "action_label": "Get Legal Help",
        "action_url": "https://www.illinoislegalaid.org/",
        "source_name": "Illinois Legal Aid Online",
        "source_url": "https://www.illinoislegalaid.org/",
        "priority_score": 100,
    },
    {
        "title": "Illinois Courts Approved Statewide Forms",
        "category": "forms",
        "jurisdiction_country": "US",
        "jurisdiction_state": "IL",
        "jurisdiction_city": "Statewide",
        "court_level": "state",
        "case_types": '["civil", "family", "probate", "criminal"]',
        "description": "Official Illinois statewide forms for various case types.",
        "eligibility": "Public resource.",
        "cost_type": "free",
        "phone": None,
        "website_url": "https://www.illinoiscourts.gov/forms/approved-forms/",
        "address_line1": None,
        "postal_code": None,
        "hours": "24/7 online",
        "languages": '["en"]',
        "action_label": "Browse Forms",
        "action_url": "https://www.illinoiscourts.gov/forms/approved-forms/",
        "source_name": "Illinois Courts",
        "source_url": "https://www.illinoiscourts.gov/",
        "priority_score": 95,
    },
]


def seed_resources() -> None:
    init_db()
    db = SessionLocal()
    created = 0
    skipped = 0
    now = utc_now()
    try:
        for item in SEED_RESOURCES:
            exists = (
                db.query(Resource)
                .filter(
                    Resource.title == item["title"],
                    Resource.category == item["category"],
                    Resource.jurisdiction_state == item["jurisdiction_state"],
                    Resource.jurisdiction_city == item["jurisdiction_city"],
                    Resource.is_active.is_(True),
                )
                .first()
            )
            if exists:
                skipped += 1
                continue

            row = Resource(
                title=item["title"],
                category=item["category"],
                jurisdiction_country=item["jurisdiction_country"],
                jurisdiction_state=item["jurisdiction_state"],
                jurisdiction_city=item["jurisdiction_city"],
                court_level=item["court_level"],
                case_types=item["case_types"],
                description=item["description"],
                eligibility=item["eligibility"],
                cost_type=item["cost_type"],
                phone=item["phone"],
                website_url=item["website_url"],
                address_line1=item["address_line1"],
                postal_code=item["postal_code"],
                hours=item["hours"],
                languages=item["languages"],
                action_label=item["action_label"],
                action_url=item["action_url"],
                source_name=item["source_name"],
                source_url=item["source_url"],
                verified_at=now,
                is_active=True,
                priority_score=item["priority_score"],
                created_at=now,
                updated_at=now,
            )
            db.add(row)
            created += 1

        db.commit()
        print(f"Seed completed. Created: {created}, Skipped: {skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_resources()
