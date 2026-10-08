from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import CreditResponse, UserCreate, UserUpdate


class UserServiceError(Exception):
    """Application error with a safe public message."""


class UserNotFound(UserServiceError):
    def __init__(self):
        super().__init__("User not found")


class DuplicateEmail(UserServiceError):
    def __init__(self):
        super().__init__("Email already exists")


class InvalidCreditAdjustment(UserServiceError):
    pass


class DatabaseFailure(UserServiceError):
    def __init__(self):
        super().__init__("Database operation failed")


@contextmanager
def database_operation(db: Session) -> Iterator[None]:
    """Rollback failures and prevent database details escaping the service."""
    try:
        yield
    except IntegrityError as exc:
        db.rollback()
        # The pre-check improves errors; the unique index also covers races.
        diag = getattr(exc.orig, "diag", None)
        if (
            getattr(exc.orig, "sqlstate", None) == "23505"
            and getattr(diag, "constraint_name", None) == "ix_users_email"
        ):
            raise DuplicateEmail() from None
        raise DatabaseFailure() from None
    except SQLAlchemyError:
        db.rollback()
        raise DatabaseFailure() from None
    except Exception:
        db.rollback()
        raise


def normalize_email(email: str) -> str:
    # Account emails are treated as case-insensitive throughout this service.
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    with database_operation(db):
        return db.scalar(
            select(User).where(func.lower(User.email) == normalize_email(email))
        )


def get_user(db: Session, user_id: int) -> User:
    with database_operation(db):
        user = db.get(User, user_id)
        if user is None:
            raise UserNotFound()
        return user


def list_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    with database_operation(db):
        statement = (
            select(User)
            .order_by(User.id)
            .offset(max(0, skip))
            .limit(min(100, max(1, limit)))
        )
        return list(db.scalars(statement))


def create_user(db: Session, user_data: UserCreate) -> User:
    with database_operation(db):
        email = normalize_email(str(user_data.email))
        if get_user_by_email(db, email) is not None:
            raise DuplicateEmail()
        user = User(email=email, plan="free", credits=10, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def locked_user(db: Session, user_id: int) -> User:
    # Refresh cached ORM state after waiting for the lock. The lock remains held
    # until commit/rollback, including when a prior read autobegan the transaction.
    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise UserNotFound()
    return user


def update_user(db: Session, user_id: int, update_data: UserUpdate) -> User:
    with database_operation(db):
        user = locked_user(db, user_id)
        changes = update_data.model_dump(exclude_unset=True)
        if "email" in changes:
            email = normalize_email(str(changes["email"]))
            existing = get_user_by_email(db, email)
            if existing is not None and existing.id != user.id:
                raise DuplicateEmail()
            user.email = email
        db.commit()
        db.refresh(user)
        return user


def deactivate_user(db: Session, user_id: int) -> User:
    with database_operation(db):
        user = locked_user(db, user_id)
        user.is_active = False
        db.commit()
        db.refresh(user)
        return user


def adjust_user_credits(db: Session, user_id: int, amount: int) -> CreditResponse:
    with database_operation(db):
        if type(amount) is not int or amount == 0:
            raise InvalidCreditAdjustment("Amount must be a nonzero integer")
        user = locked_user(db, user_id)
        previous = user.credits
        current = previous + amount
        if current < 0:
            raise InvalidCreditAdjustment("Insufficient credits")
        if current > 2_147_483_647:
            raise InvalidCreditAdjustment("Credit balance exceeds supported maximum")
        user.credits = current
        db.commit()
        # Return this transaction's balance, even if another adjustment follows.
        return CreditResponse(
            user_id=user_id,
            previous_credits=previous,
            adjustment=amount,
            current_credits=current,
        )
