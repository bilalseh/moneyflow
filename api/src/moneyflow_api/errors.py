"""API error type and the handlers that render every failure as the contract error shape."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    """An error that maps directly onto `{"error": {code, message, retryAfterSeconds?}}`."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        retry_after_seconds: int | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retry_after_seconds = retry_after_seconds
        self.headers = dict(headers or {})
        if retry_after_seconds is not None:
            self.headers["Retry-After"] = str(retry_after_seconds)

    @classmethod
    def unauthenticated(cls, message: str = "Missing or invalid credentials.") -> "ApiError":
        return cls(401, "unauthenticated", message, headers={"WWW-Authenticate": "Bearer"})

    @classmethod
    def not_found(cls, message: str = "Not found.") -> "ApiError":
        return cls(404, "not_found", message)

    @classmethod
    def quota_exceeded(cls, retry_after_seconds: int) -> "ApiError":
        return cls(
            429,
            "quota_exceeded",
            "Daily AI quota used up. It resets at midnight UTC.",
            retry_after_seconds=retry_after_seconds,
        )

    @classmethod
    def rate_limited(cls, retry_after_seconds: int) -> "ApiError":
        return cls(
            429,
            "rate_limited",
            "Too many requests. Please slow down.",
            retry_after_seconds=retry_after_seconds,
        )

    @classmethod
    def ai_invalid(cls) -> "ApiError":
        return cls(502, "ai_invalid", "The AI returned an invalid answer. Please try again.")

    @classmethod
    def ai_unavailable(cls) -> "ApiError":
        return cls(503, "ai_unavailable", "AI features are not available right now.")

    @classmethod
    def billing_not_configured(cls) -> "ApiError":
        return cls(503, "billing_not_configured", "Billing is not configured on this server.")

    @classmethod
    def billing_error(cls) -> "ApiError":
        return cls(502, "billing_error", "The payment provider could not complete the request.")

    @classmethod
    def invalid_signature(cls) -> "ApiError":
        return cls(400, "invalid_signature", "Webhook signature verification failed.")


def error_body(code: str, message: str, retry_after_seconds: int | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if retry_after_seconds is not None:
        error["retryAfterSeconds"] = retry_after_seconds
    return {"error": error}


def _describe_validation_error(exc: RequestValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Request body is invalid."
    first = errors[0]
    location = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    message = str(first.get("msg", "invalid value"))
    suffix = f" ({len(errors) - 1} more)" if len(errors) > 1 else ""
    return f"{location}: {message}{suffix}" if location else f"{message}{suffix}"


async def _handle_api_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)  # noqa: S101 - narrows the type for the registered class
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.retry_after_seconds),
        headers=exc.headers,
    )


async def _handle_validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)  # noqa: S101
    return JSONResponse(
        status_code=422,
        content=error_body("invalid_request", _describe_validation_error(exc)),
    )


async def _handle_http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)  # noqa: S101
    code = "not_found" if exc.status_code == 404 else "http_error"
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, str(exc.detail)),
        headers=dict(exc.headers or {}),
    )


async def _handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=500, content=error_body("internal_error", "Something went wrong.")
    )


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _handle_api_error)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, _handle_http_error)
    app.add_exception_handler(Exception, _handle_unexpected_error)
