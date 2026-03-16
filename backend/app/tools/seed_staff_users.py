import asyncio

from sqlalchemy import or_, select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models import User, UserRole

STAFF_ACCOUNTS = [
    {
        "role": UserRole.GP,
        "full_name": "Dr. Amelia Clarke",
        "nhs_healthcare_id": "NHS-GP-1001",
        "email": "gp.admin@caresync.local",
        "password": "CareSyncGP!2026",
    },
    {
        "role": UserRole.SPECIALIST,
        "full_name": "Dr. Benjamin Shah",
        "nhs_healthcare_id": "NHS-SPEC-1001",
        "email": "specialist.admin@caresync.local",
        "password": "CareSyncSpecialist!2026",
    },
    {
        "role": UserRole.LAB,
        "full_name": "Royal London Lab Admin",
        "nhs_healthcare_id": "NHS-LAB-1001",
        "email": "lab.admin@caresync.local",
        "password": "CareSyncLab!2026",
    },
    {
        "role": UserRole.PHARMACY,
        "full_name": "Kensington Pharmacy Admin",
        "nhs_healthcare_id": "NHS-PHARM-1001",
        "email": "pharmacy.admin@caresync.local",
        "password": "CareSyncPharmacy!2026",
    },
]


async def main() -> None:
    async with AsyncSessionLocal() as session:
        created_or_updated: list[dict[str, str]] = []

        for account in STAFF_ACCOUNTS:
            user = await session.scalar(
                select(User).where(
                    or_(
                        User.email == account["email"],
                        User.nhs_healthcare_id == account["nhs_healthcare_id"],
                    )
                )
            )

            if user is None:
                user = User(
                    full_name=account["full_name"],
                    nhs_healthcare_id=account["nhs_healthcare_id"],
                    email=account["email"],
                    password_hash=hash_password(account["password"]),
                    role=account["role"],
                )
                session.add(user)
                action = "created"
            else:
                user.full_name = account["full_name"]
                user.nhs_healthcare_id = account["nhs_healthcare_id"]
                user.email = account["email"]
                user.password_hash = hash_password(account["password"])
                user.role = account["role"]
                action = "updated"

            await session.flush()
            created_or_updated.append(
                {
                    "action": action,
                    "db_user_id": user.id,
                    "role": account["role"].value,
                    "full_name": account["full_name"],
                    "nhs_healthcare_id": account["nhs_healthcare_id"],
                    "email": account["email"],
                    "password": account["password"],
                }
            )

        await session.commit()

    print("Seeded staff accounts:")
    for account in created_or_updated:
        print(
            "| ".join(
                [
                    account["action"],
                    account["role"],
                    account["full_name"],
                    account["db_user_id"],
                    account["nhs_healthcare_id"],
                    account["email"],
                    account["password"],
                ]
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
