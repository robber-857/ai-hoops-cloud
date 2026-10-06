"""Staff-facing names prefer the nickname, then the registered username."""


def staff_display_name(user) -> str:
    return (
        (user.nickname or "").strip()
        or (user.username or "").strip()
        or "Name not added"
    )
