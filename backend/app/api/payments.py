from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from starlette.concurrency import run_in_threadpool

from app.api.deps import CurrentUser, Database
from app.schemas.payment import PaymentCheckoutResponse, PaymentCreateRequest, PaymentPackageResponse, PaymentResponse
from app.services import payment_service, payway_service
from app.services.user_service import database_operation

router = APIRouter(prefix="/api/payments", tags=["payments"])


@contextmanager
def payment_errors():
    try:
        yield
    except payment_service.PaymentNotFound:
        raise HTTPException(404, "Payment not found") from None
    except payment_service.PaymentMismatch:
        raise HTTPException(409, "Payment verification mismatch") from None
    except payment_service.CreditBalanceLimit:
        raise HTTPException(409, "Credit balance exceeds supported maximum") from None
    except payway_service.InvalidCallback:
        raise HTTPException(401, "Invalid callback signature") from None
    except payway_service.PayWayUnavailable:
        raise HTTPException(503, "Payment provider is temporarily unavailable") from None


@router.get("/packages", response_model=list[PaymentPackageResponse])
def packages():
    return list(payment_service.PACKAGES.values())


@router.post("", response_model=PaymentCheckoutResponse, status_code=201)
def create(request: PaymentCreateRequest, current_user: CurrentUser, db: Database):
    user_id = current_user.id
    with payment_errors(), database_operation(db):
        db.rollback()
        return payment_service.create_payment(db, user_id, request.package_code)


@router.post("/payway/callback")
async def callback(request: Request, db: Database):
    # Bound actual streamed bytes, not just an untrusted Content-Length header.
    with payment_errors():
        signature = request.headers.get("X-PAYWAY-HMAC-SHA512")
        if not signature:
            raise payway_service.InvalidCallback()
        if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
            raise HTTPException(415, "Expected application/json")
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > payway_service.MAX_CALLBACK_BYTES:
                raise HTTPException(413, "Callback body too large")
        data = payway_service.verify_callback(bytes(body), signature)
        payment = await run_in_threadpool(payment_service.get_payment, db, tran_id=data["tran_id"])
        if payment.status == "paid":
            return {"status": "ok"}
        result = await payway_service.check_transaction(payment.tran_id)
        await run_in_threadpool(payment_service.finalize_approved_payment, db, payment.tran_id, result, data)
        return {"status": "ok"}


@router.get("", response_model=list[PaymentResponse])
def history(current_user: CurrentUser, db: Database,
            skip: Annotated[int, Query(ge=0)] = 0, limit: Annotated[int, Query(ge=1, le=100)] = 20):
    return payment_service.list_payments(db, current_user.id, skip, limit)


@router.get("/{payment_id}", response_model=PaymentResponse)
def detail(payment_id: int, current_user: CurrentUser, db: Database):
    with payment_errors():
        return payment_service.get_payment(db, user_id=current_user.id, payment_id=payment_id)


@router.post("/{payment_id}/verify", response_model=PaymentResponse)
async def verify(payment_id: int, current_user: CurrentUser, db: Database):
    with payment_errors():
        payment = await run_in_threadpool(payment_service.get_payment, db, user_id=current_user.id,
                                         payment_id=payment_id)
        if payment.status == "paid":
            return payment
        result = await payway_service.check_transaction(payment.tran_id)
        return await run_in_threadpool(payment_service.finalize_approved_payment, db, payment.tran_id, result)
