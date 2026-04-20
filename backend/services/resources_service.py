import csv
import io
import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy import and_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

try:
    from ..models.resources import Resource
    from ..schemas.resources import ResourceCreate
    from ..services.intake_service import require_admin_access
except ImportError:
    from models.resources import Resource  # type: ignore
    from schemas.resources import ResourceCreate  # type: ignore
    from services.intake_service import require_admin_access  # type: ignore


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_json_list(items: Optional[List[str]]) -> str:
    if not items:
        return "[]"
    return json.dumps([str(i).strip() for i in items if str(i).strip()])


def parse_json_list(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(i).strip() for i in parsed if str(i).strip()]
    except Exception:
        return []
    return []


def resource_to_dict(resource: Resource) -> dict:
    data = {c.name: getattr(resource, c.name) for c in resource.__table__.columns}
    data["case_types"] = parse_json_list(resource.case_types)
    data["languages"] = parse_json_list(resource.languages)
    return data


def build_query_filters(
    country: Optional[str],
    state: Optional[str],
    city: Optional[str],
    category: Optional[str],
    cost_type: Optional[str],
) -> List:
    filters = [Resource.is_active.is_(True)]
    if country:
        filters.append(Resource.jurisdiction_country.ilike(country.strip()))
    if state:
        filters.append(Resource.jurisdiction_state.ilike(state.strip()))
    if city:
        filters.append(Resource.jurisdiction_city.ilike(city.strip()))
    if category:
        filters.append(Resource.category.ilike(category.strip()))
    if cost_type:
        filters.append(Resource.cost_type.ilike(cost_type.strip()))
    return filters


def list_resources(
    db: Session,
    country: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
    case_type: Optional[str] = None,
    language: Optional[str] = None,
    cost_type: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
):
    safe_limit = max(1, min(limit, 100))
    safe_offset = max(0, offset)

    filters = build_query_filters(country=country, state=state, city=city, category=category, cost_type=cost_type)

    query = db.query(Resource).filter(and_(*filters))

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            (Resource.title.ilike(term))
            | (Resource.description.ilike(term))
            | (Resource.eligibility.ilike(term))
        )

    rows = (
        query.order_by(
            Resource.priority_score.desc(),
            Resource.verified_at.desc(),
            Resource.title.asc(),
        )
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )

    normalized_case_type = (case_type or "").strip().lower()
    normalized_language = (language or "").strip().lower()
    results = []
    for row in rows:
        data = resource_to_dict(row)
        if normalized_case_type and normalized_case_type not in [x.lower() for x in data["case_types"]]:
            continue
        if normalized_language and normalized_language not in [x.lower() for x in data["languages"]]:
            continue
        results.append(data)
    return results


def get_resource(resource_id: int, db: Session):
    row = db.query(Resource).filter(Resource.id == resource_id, Resource.is_active.is_(True)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource_to_dict(row)


def get_resource_categories(db: Session):
    rows = (
        db.query(Resource.category)
        .filter(Resource.is_active.is_(True))
        .distinct()
        .order_by(Resource.category.asc())
        .all()
    )
    return [r[0] for r in rows if r[0]]


def suggest_resources(
    db: Session,
    country: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    case_type: Optional[str] = None,
    language: Optional[str] = None,
    limit: int = 10,
):
    candidates = list_resources(
        db=db,
        country=country,
        state=state,
        city=city,
        case_type=case_type,
        language=language,
        limit=max(limit * 3, 20),
        offset=0,
    )

    ranked = []
    for resource in candidates:
        reasons = []
        score = int(resource.get("priority_score") or 0)

        if city and resource.get("jurisdiction_city", "").lower() == city.strip().lower():
            score += 50
            reasons.append("same_city")
        elif state and resource.get("jurisdiction_state", "").lower() == state.strip().lower():
            score += 25
            reasons.append("same_state")
        elif country and resource.get("jurisdiction_country", "").lower() == country.strip().lower():
            score += 10
            reasons.append("same_country")

        if case_type and case_type.strip().lower() in [x.lower() for x in resource.get("case_types", [])]:
            score += 30
            reasons.append("matches_case_type")

        if language and language.strip().lower() in [x.lower() for x in resource.get("languages", [])]:
            score += 10
            reasons.append("supports_language")

        verified_at = resource.get("verified_at")
        if isinstance(verified_at, datetime):
            age_days = max((utc_now() - verified_at).days, 0)
        else:
            age_days = 999
        score += max(0, 90 - age_days)

        ranked.append(
            {
                "score": score,
                "resource": resource,
                "match_reasons": reasons,
                "last_verified_days_ago": age_days,
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked[: max(1, min(limit, 50))]


def create_resource(payload, request: Request, db: Session):
    require_admin_access(request)
    now = utc_now()
    row = Resource(
        title=payload.title.strip(),
        category=payload.category.strip(),
        jurisdiction_country=payload.jurisdiction_country.strip(),
        jurisdiction_state=(payload.jurisdiction_state or "").strip() or None,
        jurisdiction_city=(payload.jurisdiction_city or "").strip() or None,
        court_level=(payload.court_level or "").strip() or None,
        case_types=to_json_list(payload.case_types),
        description=(payload.description or "").strip() or None,
        eligibility=(payload.eligibility or "").strip() or None,
        cost_type=(payload.cost_type or "").strip() or None,
        phone=(payload.phone or "").strip() or None,
        email=(payload.email or "").strip().lower() or None,
        website_url=(payload.website_url or "").strip() or None,
        address_line1=(payload.address_line1 or "").strip() or None,
        address_line2=(payload.address_line2 or "").strip() or None,
        postal_code=(payload.postal_code or "").strip() or None,
        hours=(payload.hours or "").strip() or None,
        languages=to_json_list(payload.languages),
        action_label=(payload.action_label or "").strip() or None,
        action_url=(payload.action_url or "").strip() or None,
        source_name=payload.source_name.strip(),
        source_url=payload.source_url.strip(),
        verified_at=payload.verified_at or now,
        is_active=payload.is_active,
        priority_score=payload.priority_score,
        created_at=now,
        updated_at=now,
    )
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
        return resource_to_dict(row)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def update_resource(resource_id: int, payload, request: Request, db: Session):
    require_admin_access(request)
    row = db.query(Resource).filter(Resource.id == resource_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")

    data = payload.model_dump(exclude_unset=True)
    if "case_types" in data:
        data["case_types"] = to_json_list(data.get("case_types"))
    if "languages" in data:
        data["languages"] = to_json_list(data.get("languages"))
    if "email" in data and data["email"] is not None:
        data["email"] = data["email"].strip().lower()
    for key, value in data.items():
        if isinstance(value, str):
            cleaned = value.strip()
            setattr(row, key, cleaned or None)
        else:
            setattr(row, key, value)
    row.updated_at = utc_now()

    try:
        db.add(row)
        db.commit()
        db.refresh(row)
        return resource_to_dict(row)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def verify_resource(resource_id: int, request: Request, db: Session):
    require_admin_access(request)
    row = db.query(Resource).filter(Resource.id == resource_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")

    row.verified_at = utc_now()
    row.updated_at = utc_now()
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
        return resource_to_dict(row)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def deactivate_resource(resource_id: int, request: Request, db: Session):
    require_admin_access(request)
    row = db.query(Resource).filter(Resource.id == resource_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")
    row.is_active = False
    row.updated_at = utc_now()
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
        return resource_to_dict(row)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def stale_resources(days: int, request: Request, db: Session):
    require_admin_access(request)
    safe_days = max(1, min(days, 3650))
    cutoff = utc_now() - timedelta(days=safe_days)
    rows = (
        db.query(Resource)
        .filter(Resource.is_active.is_(True), Resource.verified_at < cutoff)
        .order_by(Resource.verified_at.asc(), Resource.priority_score.desc())
        .all()
    )
    return [resource_to_dict(r) for r in rows]


def bulk_import_resources(payloads, request: Request, db: Session):
    require_admin_access(request)
    created_count = 0
    skipped_count = 0
    errors: List[str] = []

    for idx, payload in enumerate(payloads, start=1):
        try:
            existing = (
                db.query(Resource)
                .filter(
                    Resource.title == payload.title.strip(),
                    Resource.category == payload.category.strip(),
                    Resource.jurisdiction_country == payload.jurisdiction_country.strip(),
                    Resource.jurisdiction_state == ((payload.jurisdiction_state or "").strip() or None),
                    Resource.jurisdiction_city == ((payload.jurisdiction_city or "").strip() or None),
                    Resource.is_active.is_(True),
                )
                .first()
            )
            if existing:
                skipped_count += 1
                continue

            now = utc_now()
            row = Resource(
                title=payload.title.strip(),
                category=payload.category.strip(),
                jurisdiction_country=payload.jurisdiction_country.strip(),
                jurisdiction_state=(payload.jurisdiction_state or "").strip() or None,
                jurisdiction_city=(payload.jurisdiction_city or "").strip() or None,
                court_level=(payload.court_level or "").strip() or None,
                case_types=to_json_list(payload.case_types),
                description=(payload.description or "").strip() or None,
                eligibility=(payload.eligibility or "").strip() or None,
                cost_type=(payload.cost_type or "").strip() or None,
                phone=(payload.phone or "").strip() or None,
                email=(payload.email or "").strip().lower() or None,
                website_url=(payload.website_url or "").strip() or None,
                address_line1=(payload.address_line1 or "").strip() or None,
                address_line2=(payload.address_line2 or "").strip() or None,
                postal_code=(payload.postal_code or "").strip() or None,
                hours=(payload.hours or "").strip() or None,
                languages=to_json_list(payload.languages),
                action_label=(payload.action_label or "").strip() or None,
                action_url=(payload.action_url or "").strip() or None,
                source_name=payload.source_name.strip(),
                source_url=payload.source_url.strip(),
                verified_at=payload.verified_at or now,
                is_active=payload.is_active,
                priority_score=payload.priority_score,
                created_at=now,
                updated_at=now,
            )
            db.add(row)
            db.flush()
            created_count += 1
        except Exception as e:
            skipped_count += 1
            errors.append(f"row {idx}: {str(e)}")

    try:
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "created_count": created_count,
        "skipped_count": skipped_count,
        "errors": errors,
    }


def _parse_bool(value: Optional[str], default: bool = True) -> bool:
    if value is None or str(value).strip() == "":
        return default
    lowered = str(value).strip().lower()
    return lowered in {"1", "true", "yes", "y"}


def _parse_int(value: Optional[str], default: int = 0) -> int:
    if value is None or str(value).strip() == "":
        return default
    try:
        return int(str(value).strip())
    except ValueError:
        return default


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None or str(value).strip() == "":
        return None
    raw = str(value).strip()
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_list_field(value: Optional[str]) -> List[str]:
    if value is None:
        return []
    raw = str(value).strip()
    if not raw:
        return []
    if raw.startswith("[") and raw.endswith("]"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(i).strip() for i in parsed if str(i).strip()]
        except Exception:
            pass
    parts = [p.strip() for p in raw.replace(";", ",").split(",")]
    return [p for p in parts if p]


def bulk_import_resources_csv(csv_bytes: bytes, request: Request, db: Session):
    require_admin_access(request)

    try:
        decoded = csv_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV header row is missing")

    required_headers = {"title", "category", "jurisdiction_country", "source_name", "source_url"}
    missing = [h for h in required_headers if h not in set(reader.fieldnames)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required CSV columns: {', '.join(missing)}")

    payloads: List[ResourceCreate] = []
    errors: List[str] = []
    for row_num, row in enumerate(reader, start=2):
        try:
            payloads.append(
                ResourceCreate(
                    title=(row.get("title") or "").strip(),
                    category=(row.get("category") or "").strip(),
                    jurisdiction_country=(row.get("jurisdiction_country") or "").strip(),
                    jurisdiction_state=(row.get("jurisdiction_state") or "").strip() or None,
                    jurisdiction_city=(row.get("jurisdiction_city") or "").strip() or None,
                    court_level=(row.get("court_level") or "").strip() or None,
                    case_types=_parse_list_field(row.get("case_types")),
                    description=(row.get("description") or "").strip() or None,
                    eligibility=(row.get("eligibility") or "").strip() or None,
                    cost_type=(row.get("cost_type") or "").strip() or None,
                    phone=(row.get("phone") or "").strip() or None,
                    email=(row.get("email") or "").strip() or None,
                    website_url=(row.get("website_url") or "").strip() or None,
                    address_line1=(row.get("address_line1") or "").strip() or None,
                    address_line2=(row.get("address_line2") or "").strip() or None,
                    postal_code=(row.get("postal_code") or "").strip() or None,
                    hours=(row.get("hours") or "").strip() or None,
                    languages=_parse_list_field(row.get("languages")),
                    action_label=(row.get("action_label") or "").strip() or None,
                    action_url=(row.get("action_url") or "").strip() or None,
                    source_name=(row.get("source_name") or "").strip(),
                    source_url=(row.get("source_url") or "").strip(),
                    verified_at=_parse_datetime(row.get("verified_at")),
                    is_active=_parse_bool(row.get("is_active"), default=True),
                    priority_score=_parse_int(row.get("priority_score"), default=0),
                )
            )
        except ValidationError as e:
            errors.append(f"row {row_num}: {str(e).splitlines()[0]}")

    result = bulk_import_resources(payloads=payloads, request=request, db=db)
    result["errors"] = errors + result["errors"]
    result["skipped_count"] = result["skipped_count"] + len(errors)
    return result


def download_resources_csv_template(request: Request):
    require_admin_access(request)
    headers = [
        "title",
        "category",
        "jurisdiction_country",
        "jurisdiction_state",
        "jurisdiction_city",
        "court_level",
        "case_types",
        "description",
        "eligibility",
        "cost_type",
        "phone",
        "email",
        "website_url",
        "address_line1",
        "address_line2",
        "postal_code",
        "hours",
        "languages",
        "action_label",
        "action_url",
        "source_name",
        "source_url",
        "verified_at",
        "is_active",
        "priority_score",
    ]
    example_row = [
        "Neighborhood Legal Aid Clinic",
        "legal_aid",
        "US",
        "IL",
        "Chicago",
        "",
        "housing;family",
        "Free legal help for low-income residents.",
        "Low-income residents in service area.",
        "free",
        "(312) 555-1234",
        "help@example.org",
        "https://example.org/legal-aid",
        "123 Main St",
        "Suite 400",
        "60601",
        "Mon-Fri 9:00 AM - 5:00 PM",
        "en;es",
        "Apply Online",
        "https://example.org/apply",
        "Example Legal Aid",
        "https://example.org/resources",
        "",
        "true",
        "80",
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerow(example_row)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=resources_import_template.csv"},
    )
