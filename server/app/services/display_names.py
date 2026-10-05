"""Human names for staff-facing surfaces. Account identifiers are never names."""


def staff_display_name(user) -> str:
    return (user.nickname or "").strip() or "Name not added"
