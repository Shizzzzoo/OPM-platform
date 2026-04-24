from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, asc, desc
from typing import Optional
import csv, io
from app.database import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut

router = APIRouter(prefix="/api/products", tags=["products"])

SORTABLE = {"sku": Product.sku, "name": Product.name, "price": Product.price, "quantity": Product.quantity}

@router.get("")
def list_products(
    sku: Optional[str] = None,
    name: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "sku",
    sort_dir: str = "asc",
    db: Session = Depends(get_db)
):
    q = db.query(Product)
    if sku:
        q = q.filter(func.lower(Product.sku).contains(sku.lower()))
    if name:
        q = q.filter(func.lower(Product.name).contains(name.lower()))
    if status == "active":
        q = q.filter(Product.is_active == True)
    elif status == "inactive":
        q = q.filter(Product.is_active == False)
    col = SORTABLE.get(sort_by, Product.sku)
    q = q.order_by(asc(col) if sort_dir == "asc" else desc(col))
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "items": items}

@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["sku", "name", "description", "price", "quantity", "is_active"])
    for p in products:
        w.writerow([p.sku, p.name, p.description, p.price, p.quantity, p.is_active])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"}
    )

@router.post("/bulk-delete")
def bulk_delete_products(payload: dict, db: Session = Depends(get_db)):
    ids = payload.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No ids provided")
    deleted = db.query(Product).filter(Product.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}

@router.post("", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(Product).filter(func.lower(Product.sku) == data.sku.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="SKU already exists")
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: str, data: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product

@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()

@router.delete("")
def delete_all_products(confirm: str = Query(...), db: Session = Depends(get_db)):
    if confirm != "yes":
        raise HTTPException(status_code=400, detail="Pass ?confirm=yes to delete all products")
    count = db.query(Product).count()
    db.query(Product).delete()
    db.commit()
    return {"deleted": count}

@router.get("/stats/summary")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(Product).count()
    active = db.query(Product).filter(Product.is_active == True).count()
    total_value = db.query(func.sum(Product.price * Product.quantity)).scalar() or 0
    avg_price = db.query(func.avg(Product.price)).scalar() or 0
    return {
        "total_products": total,
        "active_products": active,
        "inactive_products": total - active,
        "total_inventory_value": round(float(total_value), 2),
        "avg_price": round(float(avg_price), 2),
    }
