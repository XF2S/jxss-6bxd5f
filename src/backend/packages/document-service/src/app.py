"""
FastAPI application entry point for the Document Service.
Implements comprehensive document management with security, monitoring, and scalability.

Version: 1.0.0
"""

import logging
import uvicorn  # version: 0.23.0
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from prometheus_fastapi_instrumentator import Prometheus, Instrumentator  # version: 5.9.1
from fastapi_limiter import FastAPILimiter  # version: 0.1.5
import aioredis  # version: 2.0.1
import mongoengine
from typing import Dict, Any
import time

from config import service_config, mongodb_config, logging_config, security_config
from controllers.document_controller import router as document_router

# Initialize FastAPI application with OpenAPI documentation
app = FastAPI(
    title="Document Service",
    description="Secure document management service for the Enrollment System",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize Prometheus metrics
instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    should_respect_env_var=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=[".*admin.*", "/metrics"],
    env_var_name="ENABLE_METRICS",
    inprogress_name="http_requests_inprogress",
    inprogress_labels=True
)

async def configure_logging() -> None:
    """Configure comprehensive logging with structured output."""
    try:
        logging.basicConfig(
            level=logging_config['level'],
            format=logging_config['format'],
            handlers=[
                logging.StreamHandler(),
                logging.handlers.RotatingFileHandler(
                    filename="document_service.log",
                    maxBytes=logging_config['rotation_size_mb'] * 1024 * 1024,
                    backupCount=logging_config['retention_days']
                )
            ]
        )
        logger.info("Logging configured successfully")
    except Exception as e:
        logger.error(f"Failed to configure logging: {str(e)}")
        raise

async def configure_mongodb() -> None:
    """Configure MongoDB connection with optimized settings."""
    try:
        # Configure MongoDB connection with pooling
        mongoengine.connect(
            db=mongodb_config['database'],
            host=mongodb_config['uri'],
            maxPoolSize=mongodb_config['connection_pool_size'],
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            retryWrites=mongodb_config['retry_writes']
        )
        logger.info("MongoDB connection established successfully")
    except Exception as e:
        logger.error(f"Failed to configure MongoDB: {str(e)}")
        raise

async def configure_middleware() -> None:
    """Configure comprehensive middleware stack."""
    try:
        # CORS middleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Configure based on environment
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["Content-Disposition"]
        )

        # Compression middleware
        app.add_middleware(GZipMiddleware, minimum_size=1000)

        # Security headers middleware
        @app.middleware("http")
        async def add_security_headers(request: Request, call_next):
            response = await call_next(request)
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            return response

        # Request ID middleware
        @app.middleware("http")
        async def add_request_id(request: Request, call_next):
            request_id = request.headers.get("X-Request-ID", str(time.time()))
            request.state.request_id = request_id
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response

        # Error handling middleware
        @app.exception_handler(Exception)
        async def global_exception_handler(request: Request, exc: Exception):
            logger.error(f"Global error handler: {str(exc)}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request.state.request_id}
            )

        logger.info("Middleware configuration completed")
    except Exception as e:
        logger.error(f"Failed to configure middleware: {str(e)}")
        raise

@app.on_event("startup")
async def startup_event() -> None:
    """Initialize application components on startup."""
    try:
        # Configure logging
        await configure_logging()

        # Configure MongoDB
        await configure_mongodb()

        # Configure Redis for rate limiting
        redis = await aioredis.from_url(
            "redis://localhost",
            encoding="utf-8",
            decode_responses=True
        )
        await FastAPILimiter.init(redis)

        # Initialize Prometheus metrics
        instrumentator.instrument(app).expose(app, include_in_schema=False)

        logger.info("Application startup completed successfully")
    except Exception as e:
        logger.error(f"Application startup failed: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Cleanup resources on application shutdown."""
    try:
        # Close MongoDB connection
        mongoengine.disconnect()

        # Close Redis connection
        await FastAPILimiter.close()

        logger.info("Application shutdown completed successfully")
    except Exception as e:
        logger.error(f"Application shutdown error: {str(e)}")

# Include API routes
app.include_router(
    document_router,
    prefix="/api/v1",
    tags=["documents"]
)

# Health check endpoint
@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "services": {
            "mongodb": mongoengine.get_connection().server_info()["ok"] == 1.0,
            "redis": await FastAPILimiter.redis.ping()
        }
    }

def main() -> None:
    """Application entry point."""
    try:
        uvicorn.run(
            "app:app",
            host="0.0.0.0",
            port=8000,
            workers=4,
            log_level="info",
            reload=False,
            proxy_headers=True,
            forwarded_allow_ips="*",
            access_log=True
        )
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}")
        raise

if __name__ == "__main__":
    main()