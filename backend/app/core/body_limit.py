from starlette.responses import JSONResponse


class BodyLimitMiddleware:
    """Bound actual bytes, including chunked requests, before multipart parsing."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PATCH", "PUT"}:
            return await self.app(scope, receive, send)
        limit = 6 * 1024 * 1024 if scope["path"] == "/api/generate" else 65536
        parts, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > limit:
                return await JSONResponse({"detail": "Request too large"}, status_code=413)(scope, receive, send)
            parts.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        body = b"".join(parts)
        delivered = False
        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()
        await self.app(scope, bounded_receive, send)
