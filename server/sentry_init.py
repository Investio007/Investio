import logging
import os

logger = logging.getLogger(__name__)


def _is_valid_sentry_dsn(dsn: str) -> bool:
    return dsn.startswith("https://") or dsn.startswith("http://")


def init_sentry() -> bool:
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False

    if not _is_valid_sentry_dsn(dsn):
        logger.warning(
            "SENTRY_DSN is set but invalid (must start with https://). "
            "Sentry disabled — fix or remove SENTRY_DSN in Railway."
        )
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:
        logger.warning("sentry-sdk not installed — Sentry disabled")
        return False

    environment = (
        os.getenv("SENTRY_ENVIRONMENT") or os.getenv("ENVIRONMENT") or "development"
    ).strip()
    is_production = environment.lower() == "production"

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=environment,
            integrations=[
                StarletteIntegration(),
                FastApiIntegration(),
                LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
            ],
            traces_sample_rate=0.2 if is_production else 1.0,
            enable_logs=True,
            profile_session_sample_rate=0.1 if is_production else 1.0,
            profile_lifecycle="trace",
            send_default_pii=False,
        )
    except Exception as exc:
        logger.warning("Sentry init failed (%s) — continuing without Sentry", exc)
        return False

    return True
