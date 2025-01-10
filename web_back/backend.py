from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis
from jose import jwt, JWTError
import uuid
from typing import Optional, List
from contextlib import asynccontextmanager
from pydantic import BaseModel
import os
import httpx
from datetime import datetime, timedelta
from utils.logger import logger, log_request
from utils.rate_limiter import RateLimiter
from utils.token_cache import TokenCache
from utils.database import init_db, get_db

# Инициализация Redis
redis = Redis(host='localhost', port=6379, decode_responses=True)

# Настройки JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Модели данных
class TokenData(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class Question(BaseModel):
    question: str
    answers: List[str]
    correct_answer: str

class Test(BaseModel):
    id: str
    title: str
    questions: List[Question]

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await redis.ping()
        init_db()  # Initialize database (no longer async)
        logger.info("Database initialized successfully")
    except Exception as e:
        raise RuntimeError(f"Error during startup: {e}")
    yield
    await redis.close()

app = FastAPI(lifespan=lifespan)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Функции для работы с токенами
async def validate_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = auth_header.split(" ")[1]
    try:
        payload = await validate_token(token)
        return payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

# API эндпоинты
@app.get("/")
async def home(current_user: dict = Depends(get_current_user)):
    return {
        "status": "authorized",
        "message": f"Welcome, {current_user.get('email')}",
        "permissions": current_user.get('permissions', [])
    }

@app.get("/user")
async def get_user_info(current_user: dict = Depends(get_current_user)):
    user_data = await redis.hgetall(f"user:{current_user['email']}")
    if not user_data:
        return {
            "email": current_user['email'],
            "permissions": current_user.get('permissions', [])
        }
    return user_data

@app.post("/tests")
async def add_test(
    test: Test,
    current_user: dict = Depends(get_current_user)
):
    if "tests:create" not in current_user.get('permissions', []):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    test_key = f"test:{test.id}"
    await redis.hset(test_key, mapping={
        "title": test.title,
        "questions": str(test.questions),
        "creator": current_user['email'],
        "created_at": str(datetime.now())
    })
    return {"message": "Test created successfully"}

@app.get("/tests")
async def get_tests(current_user: dict = Depends(get_current_user)):
    if "tests:read" not in current_user.get('permissions', []):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    tests = []
    async for key in redis.scan_iter("test:*"):
        test_data = await redis.hgetall(key)
        tests.append({
            "id": key.split(":")[1],
            **test_data
        })
    return tests

@app.delete("/tests/{test_id}")
async def delete_test(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    if "tests:delete" not in current_user.get('permissions', []):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    test_key = f"test:{test_id}"
    test_exists = await redis.exists(test_key)
    if not test_exists:
        raise HTTPException(status_code=404, detail="Test not found")
    
    await redis.delete(test_key)
    return {"message": "Test deleted successfully"}

@app.get("/tests/{test_id}")
async def get_test(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    if "tests:read" not in current_user.get('permissions', []):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    test_key = f"test:{test_id}"
    test_data = await redis.hgetall(test_key)
    if not test_data:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return {
        "id": test_id,
        **test_data
    }

@app.get("/auth/login")
async def login(type: Optional[str] = None):
    if not type:
        raise HTTPException(status_code=400, detail="Auth type is required")
    
    auth_service_url = os.getenv("AUTH_SERVICE_URL", "http://localhost:8080")
    return RedirectResponse(f"{auth_service_url}/auth/{type}/login")

@app.post("/auth/refresh")
async def refresh_token(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing refresh token")
    
    refresh_token = auth_header.split(" ")[1]
    auth_service_url = os.getenv("AUTH_SERVICE_URL", "http://localhost:8080")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{auth_service_url}/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "Failed to refresh token")
            )
        
        return response.json()

@app.post("/auth/logout")
async def logout(
    request: Request,
    logout_all: Optional[bool] = False,
    current_user: dict = Depends(get_current_user)
):
    auth_service_url = os.getenv("AUTH_SERVICE_URL", "http://localhost:8080")
    auth_header = request.headers.get("Authorization")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{auth_service_url}/auth/logout{'?all=true' if logout_all else ''}",
            headers={"Authorization": auth_header}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "Failed to logout")
            )
        
        return {"message": "Logged out successfully"}

# Rate Limiter и Middleware
rate_limiter = RateLimiter()

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    try:
        # Получаем IP адрес клиента
        client_ip = request.client.host
        
        # Формируем ключ для Redis
        key = f"rate_limit:{client_ip}:{request.url.path}"
        
        # Проверяем лимит запросов
        if not rate_limiter.check_rate_limit(key):
            return JSONResponse(
                status_code=429,
                content={"error": "Too many requests. Please try again later."}
            )
        
        # Если лимит не превышен, продолжаем обработку запроса
        response = await call_next(request)
        return response
        
    except Exception as e:
        logger.error(f"Error in rate limit middleware: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    # Логируем все входящие запросы
    logger.info(f"Incoming request: {request.method} {request.url.path} from {request.client.host}")
    response = await call_next(request)
    return response

# API эндпоинты для аутентификации
@app.post("/auth/login")
async def login(request: Request):
    try:
        body = await request.json()
        username = body.get('username')
        password = body.get('password')
        
        # Здесь ваша логика аутентификации
        
        # Логируем попытку входа
        logger.info(f"Login attempt for user: {username}")
        
        # Проверяем лимит попыток входа
        key = f"login_attempts:{username}"
        if not rate_limiter.check_rate_limit(key, requests=5, window=300):
            return JSONResponse(
                status_code=429,
                content={"error": "Too many login attempts. Please try again later."}
            )
            
        # Ваша существующая логика входа
        auth_result = authenticate_user(username, password)
        
        if auth_result['success']:
            # Кэшируем токены
            token_cache = TokenCache()
            token_cache.cache_tokens(
                auth_result['user_id'],
                auth_result['access_token'],
                auth_result['refresh_token'],
                auth_result['access_exp'],
                auth_result['refresh_exp']
            )
            return JSONResponse(content=auth_result, status_code=200)
        else:
            logger.warning(f"Failed login attempt for user: {username}")
            return JSONResponse(content={'error': 'Invalid credentials'}, status_code=401)
            
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return JSONResponse(content={'error': 'Internal server error'}, status_code=500)

@app.post("/auth/refresh")
async def refresh_token(request: Request):
    try:
        body = await request.json()
        refresh_token = body.get('refresh_token')
        user_id = body.get('user_id')
        
        # Проверяем, не в черном ли списке токен
        token_cache = TokenCache()
        if token_cache.is_token_blacklisted(refresh_token):
            logger.warning(f"Attempt to use blacklisted token for user: {user_id}")
            return JSONResponse(content={'error': 'Token is blacklisted'}, status_code=401)
            
        # Получаем новые токены
        new_tokens = get_new_tokens(refresh_token)
        
        if new_tokens['success']:
            # Обновляем кэш токенов
            token_cache.cache_tokens(
                user_id,
                new_tokens['access_token'],
                new_tokens['refresh_token'],
                new_tokens['access_exp'],
                new_tokens['refresh_exp']
            )
            return JSONResponse(content=new_tokens, status_code=200)
        else:
            logger.warning(f"Token refresh failed for user: {user_id}")
            return JSONResponse(content={'error': 'Invalid refresh token'}, status_code=401)
            
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        return JSONResponse(content={'error': 'Internal server error'}, status_code=500)

@app.post("/auth/logout")
async def logout(request: Request):
    try:
        body = await request.json()
        user_id = body.get('user_id')
        access_token = body.get('access_token')
        refresh_token = body.get('refresh_token')
        
        # Добавляем токены в черный список
        token_cache = TokenCache()
        token_cache.blacklist_token(access_token, 3600)  # на 1 час
        token_cache.blacklist_token(refresh_token, 7*24*3600)  # на 7 дней
        
        # Инвалидируем токены в кэше
        token_cache.invalidate_tokens(user_id)
        
        logger.info(f"User logged out successfully: {user_id}")
        return JSONResponse(content={'message': 'Logged out successfully'}, status_code=200)
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return JSONResponse(content={'error': 'Internal server error'}, status_code=500)

# Периодическая очистка устаревших токенов
@app.on_event("startup")
async def setup_token_cleanup():
    import atexit
    from apscheduler.schedulers.background import BackgroundScheduler
    
    scheduler = BackgroundScheduler()
    token_cache = TokenCache()
    scheduler.add_job(func=token_cache.cleanup_expired_tokens, 
                     trigger="interval", 
                     hours=1)
    scheduler.start()
    
    # Shutdown the scheduler when exiting the app
    atexit.register(lambda: scheduler.shutdown())