import os


def init_sentry() -> bool:
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False

    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    environment = (
        os.getenv("SENTRY_ENVIRONMENT") or os.getenv("ENVIRONMENT") or "development"
    ).strip()
    is_production = environment.lower() == "production"

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.2 if is_production else 1.0,
        send_default_pii=False,
    )
    return True
