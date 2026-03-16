from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.modules.auth.schemas import LoginRequest, RegisterRequest


async def register_user(db: AsyncSession, payload: RegisterRequest) -> User:
    existing = await db.scalar(
        select(User).where(
            (User.email == payload.email) | (User.nhs_healthcare_id == payload.nhs_healthcare_id)
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    user = User(
        nhs_healthcare_id=payload.nhs_healthcare_id,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def login_user(db: AsyncSession, payload: LoginRequest) -> str:
    user = await db.scalar(
        select(User).where(
            (User.email == payload.identifier) | (User.nhs_healthcare_id == payload.identifier)
        )
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return create_access_token(user.id)
