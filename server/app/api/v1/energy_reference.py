from fastapi import APIRouter, Depends
from app.api.deps import require_roles
from app.models.enums import UserRole
from app.schemas.energy_reference import EnergyReferenceRequest
from app.services.energy_reference_service import metadata, preview

router = APIRouter(prefix='/admin/energy-reference', dependencies=[Depends(require_roles(UserRole.admin))])


@router.get('')
def reference_metadata():
    return metadata()


@router.post('/preview')
def reference_preview(payload: EnergyReferenceRequest):
    # Read-only scenario, no student lookup, report publication or database mutation.
    return preview(payload)
