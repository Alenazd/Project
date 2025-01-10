from functools import wraps
from datetime import datetime, timedelta
import redis
from fastapi import Request
from fastapi.responses import JSONResponse
from .logger import logger

class RateLimiter:
    def __init__(self, redis_host='localhost', redis_port=6379):
        self.redis = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        
    def limit_requests(self, requests=100, window=60):
        def decorator(f):
            @wraps(f)
            def wrapped(*args, **kwargs):
                # Получаем IP адрес клиента
                client_ip = Request().client.host
                
                # Формируем ключ для Redis
                key = f"rate_limit:{client_ip}:{Request().url.path}"
                
                if not self.check_rate_limit(key, requests, window):
                    logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                    return JSONResponse({
                        'error': 'Too many requests',
                        'retry_after': self.redis.ttl(key)
                    }, status_code=429)
                    
                return f(*args, **kwargs)
            return wrapped
        return decorator
        
    def limit_login_attempts(self, max_attempts=5, window=300):
        def decorator(f):
            @wraps(f)
            def wrapped(*args, **kwargs):
                username = Request().json().get('username', '')
                client_ip = Request().client.host
                
                # Формируем ключ для Redis
                key = f"login_attempts:{username}:{client_ip}"
                
                try:
                    # Получаем количество неудачных попыток
                    attempts = self.redis.get(key)
                    
                    if attempts is not None and int(attempts) >= max_attempts:
                        logger.warning(f"Login attempts exceeded for user: {username}, IP: {client_ip}")
                        return JSONResponse({
                            'error': 'Too many login attempts',
                            'retry_after': self.redis.ttl(key)
                        }, status_code=429)
                        
                    result = f(*args, **kwargs)
                    
                    # Если логин неуспешный
                    if result.status_code == 401:
                        if attempts is None:
                            self.redis.setex(key, window, 1)
                        else:
                            self.redis.incr(key)
                            
                    return result
                except redis.RedisError as e:
                    logger.error(f"Redis error in login rate limiter: {str(e)}")
                    return f(*args, **kwargs)
                    
            return wrapped
        return decorator

    def check_rate_limit(self, key, requests=100, window=60):
        try:
            # Получаем текущее количество запросов
            current = self.redis.get(key)
            
            if current is None:
                # Если ключ не существует, создаем его
                self.redis.setex(key, window, 1)
                return True
                
            current = int(current)
            
            if current >= requests:
                return False
                
            # Увеличиваем счетчик
            self.redis.incr(key)
            return True
            
        except Exception as e:
            logger.error(f"Error in rate limiter: {str(e)}")
            # В случае ошибки пропускаем запрос
            return True
