from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    ASYNC_DATABASE_URL: str
    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    APP_ENV: str = "development"
    SECRET_KEY: str
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    UPLOAD_DIR: str = "./uploads"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

