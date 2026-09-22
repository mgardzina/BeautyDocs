from app.models.domain import TeamMember
from app.services.team_assignments import can_perform_treatment


def _member(*, all_treatments: bool, treatment_codes: list[str]) -> TeamMember:
    return TeamMember(
        display_name="Anna Nowak",
        performs_treatments=True,
        all_treatments=all_treatments,
        treatment_codes=treatment_codes,
        is_active=True,
    )


def test_all_treatments_includes_current_and_future_forms() -> None:
    member = _member(all_treatments=True, treatment_codes=[])

    assert can_perform_treatment(member, "modelowanie-ust") is True
    assert can_perform_treatment(member, "nowy-zabieg") is True


def test_selected_treatments_only_include_assigned_form_codes() -> None:
    member = _member(
        all_treatments=False,
        treatment_codes=["modelowanie-ust", "mezoterapia-iglowa"],
    )

    assert can_perform_treatment(member, "modelowanie-ust") is True
    assert can_perform_treatment(member, "depilacja-laserowa") is False
