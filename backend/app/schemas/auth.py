from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    email: EmailStr
    password: str = Field(min_length=8, max_length=128, repr=False)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    email: EmailStr
    password: str = Field(max_length=128, repr=False)


class TokenResponse(BaseModel):
    access_token: str = Field(repr=False)
    token_type: str = "bearer"
    expires_in: int


class GoogleAuthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    id_token: str = Field(min_length=1, max_length=16384, repr=False)
    nonce: str = Field(min_length=1, max_length=256, repr=False)


class GoogleLinkResponse(BaseModel):
    linked: bool = True


class VerificationEmail(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    email: EmailStr


class VerifyEmailRequest(VerificationEmail):
    code: str = Field(pattern=r"^[0-9]{6}$", repr=False)
