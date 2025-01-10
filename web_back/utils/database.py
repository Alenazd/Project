from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from contextlib import contextmanager
from loguru import logger
import time

# Database configuration
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "maksmaster2006")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "testing_system")

DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# Create engine
engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def wait_for_db(max_attempts=5, delay_seconds=5):
    """Wait for the database to be ready."""
    for attempt in range(max_attempts):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            logger.info("Successfully connected to the database")
            return True
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt + 1}/{max_attempts} failed: {str(e)}")
            if attempt < max_attempts - 1:
                time.sleep(delay_seconds)
    raise RuntimeError("Could not connect to the database after multiple attempts")

@contextmanager
def get_db():
    """Get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize the database with required tables."""
    # Wait for the database to be ready
    wait_for_db()
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
