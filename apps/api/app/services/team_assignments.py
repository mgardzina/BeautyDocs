"""Treatment assignment rules shared by public form reads and submissions."""

from app.models.domain import TeamMember


def can_perform_treatment(member: TeamMember, form_code: str) -> bool:
    """Return whether a practitioner may be selected for a form template."""

    if member.all_treatments is not False:
        return True
    return form_code in (member.treatment_codes or [])
