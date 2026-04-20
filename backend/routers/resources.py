from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy.orm import Session

try:
    from ..database import get_db
    from ..schemas.resources import (
        ResourceBulkImportResult,
        ResourceCreate,
        ResourceOut,
        ResourceSuggestionOut,
        ResourceUpdate,
    )
    from ..services.resources_service import (
        create_resource,
        bulk_import_resources,
        bulk_import_resources_csv,
        download_resources_csv_template,
        deactivate_resource,
        get_resource,
        get_resource_categories,
        list_resources,
        stale_resources,
        suggest_resources,
        update_resource,
        verify_resource,
    )
except ImportError:
    from database import get_db  # type: ignore
    from schemas.resources import (  # type: ignore
        ResourceBulkImportResult,
        ResourceCreate,
        ResourceOut,
        ResourceSuggestionOut,
        ResourceUpdate,
    )
    from services.resources_service import (  # type: ignore
        create_resource,
        bulk_import_resources,
        bulk_import_resources_csv,
        download_resources_csv_template,
        deactivate_resource,
        get_resource,
        get_resource_categories,
        list_resources,
        stale_resources,
        suggest_resources,
        update_resource,
        verify_resource,
    )

router = APIRouter()


@router.get("/resources", response_model=List[ResourceOut])
def list_resources_endpoint(
    country: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
    case_type: Optional[str] = None,
    language: Optional[str] = None,
    cost_type: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return list_resources(
        db=db,
        country=country,
        state=state,
        city=city,
        category=category,
        case_type=case_type,
        language=language,
        cost_type=cost_type,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get("/resources/categories", response_model=List[str])
def get_resource_categories_endpoint(db: Session = Depends(get_db)):
    return get_resource_categories(db=db)


@router.get("/resources/suggested", response_model=List[ResourceSuggestionOut])
def suggest_resources_endpoint(
    country: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    case_type: Optional[str] = None,
    language: Optional[str] = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return suggest_resources(
        db=db,
        country=country,
        state=state,
        city=city,
        case_type=case_type,
        language=language,
        limit=limit,
    )


@router.get("/resources/{resource_id}", response_model=ResourceOut)
def get_resource_endpoint(resource_id: int, db: Session = Depends(get_db)):
    return get_resource(resource_id=resource_id, db=db)


@router.post("/admin/resources", response_model=ResourceOut)
def create_resource_endpoint(payload: ResourceCreate, request: Request, db: Session = Depends(get_db)):
    return create_resource(payload=payload, request=request, db=db)


@router.post("/admin/resources/bulk-import", response_model=ResourceBulkImportResult)
def bulk_import_resources_endpoint(payload: List[ResourceCreate], request: Request, db: Session = Depends(get_db)):
    return bulk_import_resources(payloads=payload, request=request, db=db)


@router.post("/admin/resources/bulk-import/csv", response_model=ResourceBulkImportResult)
async def bulk_import_resources_csv_endpoint(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        return {"created_count": 0, "skipped_count": 0, "errors": ["Only .csv files are supported"]}
    content = await file.read()
    return bulk_import_resources_csv(csv_bytes=content, request=request, db=db)


@router.get("/admin/resources/bulk-import/template.csv")
def download_resources_csv_template_endpoint(request: Request):
    return download_resources_csv_template(request=request)


@router.put("/admin/resources/{resource_id}", response_model=ResourceOut)
def update_resource_endpoint(resource_id: int, payload: ResourceUpdate, request: Request, db: Session = Depends(get_db)):
    return update_resource(resource_id=resource_id, payload=payload, request=request, db=db)


@router.patch("/admin/resources/{resource_id}/verify", response_model=ResourceOut)
def verify_resource_endpoint(resource_id: int, request: Request, db: Session = Depends(get_db)):
    return verify_resource(resource_id=resource_id, request=request, db=db)


@router.patch("/admin/resources/{resource_id}/deactivate", response_model=ResourceOut)
def deactivate_resource_endpoint(resource_id: int, request: Request, db: Session = Depends(get_db)):
    return deactivate_resource(resource_id=resource_id, request=request, db=db)


@router.get("/admin/resources/stale", response_model=List[ResourceOut])
def stale_resources_endpoint(
    request: Request,
    days: int = Query(default=90, ge=1, le=3650),
    db: Session = Depends(get_db),
):
    return stale_resources(days=days, request=request, db=db)
