from app.tasks.celery_app import celery_app

@celery_app.task(bind=True)
def dispatch_webhook(self, webhook_id: str, event: str, payload: dict):
    """Dispatch a webhook event to registered URLs."""
    import httpx
    from app.database import SessionLocal
    from app.models.webhook import Webhook

    db = SessionLocal()
    try:
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if not webhook or not webhook.is_enabled:
            return

        response = httpx.post(
            webhook.url,
            json={"event": event, "data": payload},
            timeout=10,
        )
        webhook.last_status = response.status_code
        db.commit()
    except Exception as e:
        if webhook:
            webhook.last_status = 0
            db.commit()
        raise self.retry(exc=e, countdown=60, max_retries=3)
    finally:
        db.close()
