import os
import uuid
import asyncio
import json
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models.import_job import ImportJob
from app.tasks.csv_import import process_csv
from app.config import settings

router = APIRouter(prefix="/api/import", tags=["import"])

@router.post("")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
    job_id = str(uuid.uuid4())
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"{job_id}.csv")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    job = ImportJob(id=job_id, filename=file.filename, status="pending")
    db.add(job)
    db.commit()
    process_csv.delay(job_id, file_path)
    return {"job_id": job_id}

@router.get("/{job_id}/progress")
async def stream_progress(job_id: str):
    async def event_generator():
        while True:
            # Fresh session each tick to avoid stale cache
            db = SessionLocal()
            try:
                job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
                if not job:
                    yield f"data: {json.dumps({'error': 'job not found'})}\n\n"
                    break
                pct = 100 if job.status == "complete" else (round(job.processed_rows / job.total_rows * 100, 1) if job.total_rows else 0)
                payload = {
                    "status": job.status,
                    "progress": pct,
                    "processed": job.processed_rows,
                    "total": job.total_rows,
                    "inserted": job.inserted,
                    "updated": job.updated,
                    "failed": job.failed_rows,
                }
                yield f"data: {json.dumps(payload)}\n\n"
                if job.status in ("complete", "failed"):
                    break
            finally:
                db.close()
            await asyncio.sleep(1)
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("")
def list_jobs(db: Session = Depends(get_db)):
    from app.database import SessionLocal
    jobs = db.query(ImportJob).order_by(ImportJob.created_at.desc()).limit(10).all()
    return jobs
