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
ENV PORT=8080

RUN mkdir -p /app/uploads

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
