"""Promote a named existing admin using an operator's database connection."""

import argparse
from uuid import UUID

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.enums import ADMIN_ROLES, UserRole, UserStatus
from app.models.operation_log import OperationLog
from app.models.user import User


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", required=True, type=UUID, help="Public ID of an existing, active admin")
    args = parser.parse_args()
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.public_id == args.user_id).with_for_update())
        if not user or user.status != UserStatus.active or user.deleted_at or user.role not in ADMIN_ROLES:
            parser.error("The supplied public ID must identify an active administrator.")
        if user.role != UserRole.super_admin:
            user.role = UserRole.super_admin
            db.add(OperationLog(
                module="users", action="provision_system_admin", target_type="user",
                target_id=str(args.user_id), log_metadata={"previous": "admin", "role": "super_admin"},
            ))
    print(f"{args.user_id} is a system administrator.")


if __name__ == "__main__":
    main()
