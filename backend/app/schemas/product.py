from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ProductCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    quantity: int = 0
    is_active: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    is_active: Optional[bool] = None

class ProductOut(BaseModel):
    id: str
    sku: str
    name: str
    description: Optional[str]
    price: Optional[float]
    quantity: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
