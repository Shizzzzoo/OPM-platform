from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import products,imports

app = FastAPI(title="OPM API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(imports.router)

@app.get("/health")
def health():
    return {"status": "ok"}
