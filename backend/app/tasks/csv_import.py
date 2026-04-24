import csv
import uuid
import logging
import io
from app.tasks.celery_app import celery_app
from app.database import SessionLocal, engine
from app.models.import_job import ImportJob
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)
CHUNK_SIZE = 5000

def update_job(db: Session, job_id: str, **kwargs):
    db.query(ImportJob).filter(ImportJob.id == job_id).update(kwargs)
    db.commit()

@celery_app.task(bind=True)
def process_csv(self, job_id: str, file_path: str):
    db = SessionLocal()
    try:
        update_job(db, job_id, status="parsing")
        with open(file_path, newline="", encoding="utf-8-sig") as f:
            total = sum(1 for _ in f) - 1
        update_job(db, job_id, total_rows=total, status="importing")

        inserted = failed = 0
        chunk = []
        seen_skus = {}  # deduplicate within chunk

        with open(file_path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            logger.info(f"CSV columns: {reader.fieldnames}")
            for row in reader:
                sku = (row.get("SKU") or row.get("sku") or "").strip()
                name = (row.get("Name") or row.get("name") or "").strip()
                if not sku or not name:
                    failed += 1
                    continue

                price_raw = (row.get("Price") or row.get("price") or "").strip()
                try:
                    price = str(float(price_raw)) if price_raw else r"\N"
                except ValueError:
                    price = r"\N"

                qty_raw = (row.get("Quantity") or row.get("quantity") or "0").strip()
                try:
                    quantity = int(float(qty_raw))
                except ValueError:
                    quantity = 0

                desc = (row.get("Description") or row.get("description") or "").strip()

                # Last-write-wins for duplicate SKUs within the same chunk
                seen_skus[sku] = (
                    str(uuid.uuid4()),
                    sku,
                    name,
                    desc,
                    price,
                    quantity,
                )

                if len(seen_skus) >= CHUNK_SIZE:
                    chunk = list(seen_skus.values())
                    bulk_upsert(chunk)
                    inserted += len(chunk)
                    seen_skus = {}
                    update_job(db, job_id,
                        processed_rows=inserted + failed,
                        inserted=inserted,
                        updated=0,
                        failed_rows=failed)
                    logger.info(f"Inserted {inserted} so far")

        if seen_skus:
            bulk_upsert(list(seen_skus.values()))
            inserted += len(seen_skus)

        update_job(db, job_id,
            status="complete",
            processed_rows=inserted + failed,
            inserted=inserted,
            updated=0,
            failed_rows=failed)
        logger.info(f"Done: {inserted} inserted, {failed} failed")

    except Exception as e:
        logger.error(f"Task failed: {e}", exc_info=True)
        try:
            update_job(db, job_id, status="failed", error_message=str(e))
        except Exception:
            pass
    finally:
        db.close()

def bulk_upsert(rows: list):
    with engine.begin() as conn:
        raw = conn.connection
        conn.execute(text("""
            CREATE TEMP TABLE IF NOT EXISTS products_staging (
                id TEXT, sku TEXT, name TEXT, description TEXT,
                price DOUBLE PRECISION, quantity INTEGER
            ) ON COMMIT DELETE ROWS
        """))
        buf = io.StringIO()
        for r in rows:
            id_, sku, name, desc, price, qty = r
            price_val = price if price != r"\N" else r"\N"
            line = "\t".join([
                id_,
                sku.replace("\t", " ").replace("\n", " "),
                name.replace("\t", " ").replace("\n", " "),
                desc.replace("\t", " ").replace("\n", " "),
                price_val,
                str(qty),
            ])
            buf.write(line + "\n")
        buf.seek(0)
        cursor = raw.cursor()
        cursor.copy_from(buf, "products_staging",
                         columns=("id", "sku", "name", "description", "price", "quantity"))
        cursor.execute("""
            INSERT INTO products (id, sku, name, description, price, quantity, is_active)
            SELECT id, sku, name, description, price, quantity, true
            FROM products_staging
            ON CONFLICT (sku) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                price = EXCLUDED.price,
                quantity = EXCLUDED.quantity,
                updated_at = NOW()
        """)
        raw.commit()
        cursor.close()
