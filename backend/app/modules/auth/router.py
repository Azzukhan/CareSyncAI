from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, get_current_user
from app.models import User
from app.modules.auth.schemas import LoginRequest, TokenResponse, UserResponse
from app.modules.auth.schemas import RegisterRequest as RegisterPayload
from app.modules.auth.service import login_user, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(payload: RegisterPayload, db: DbSession) -> UserResponse:
    user = await register_user(db, payload)
    return UserResponse.model_validate(user, from_attributes=True)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    token = await login_user(db, payload)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return UserResponse.model_validate(current_user, from_attributes=True)
