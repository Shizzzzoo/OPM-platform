FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

RUN echo '#!/bin/bash\nalembic upgrade head\nuvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}' > /start.sh && chmod +x /start.sh

CMD ["/start.sh"]
