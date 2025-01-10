import redis
import json
from datetime import datetime, timedelta
from .logger import logger

class TokenCache:
    def __init__(self, redis_host='localhost', redis_port=6379):
        self.redis = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        
    def cache_tokens(self, user_id, access_token, refresh_token, access_exp, refresh_exp):
        """Кэширование токенов в Redis"""
        try:
            token_data = {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'access_exp': access_exp,
                'refresh_exp': refresh_exp
            }
            
            # Сохраняем токены с временем жизни
            self.redis.setex(
                f"tokens:{user_id}",
                refresh_exp - int(datetime.now().timestamp()),
                json.dumps(token_data)
            )
            
            logger.info(f"Tokens cached for user: {user_id}")
        except redis.RedisError as e:
            logger.error(f"Error caching tokens: {str(e)}")
            
    def get_cached_tokens(self, user_id):
        """Получение токенов из кэша"""
        try:
            token_data = self.redis.get(f"tokens:{user_id}")
            if token_data:
                return json.loads(token_data)
            return None
        except redis.RedisError as e:
            logger.error(f"Error getting cached tokens: {str(e)}")
            return None
            
    def invalidate_tokens(self, user_id):
        """Инвалидация токенов пользователя"""
        try:
            self.redis.delete(f"tokens:{user_id}")
            logger.info(f"Tokens invalidated for user: {user_id}")
        except redis.RedisError as e:
            logger.error(f"Error invalidating tokens: {str(e)}")
            
    def is_token_blacklisted(self, token):
        """Проверка токена на наличие в черном списке"""
        try:
            return bool(self.redis.get(f"blacklist:{token}"))
        except redis.RedisError as e:
            logger.error(f"Error checking token blacklist: {str(e)}")
            return False
            
    def blacklist_token(self, token, expires_in):
        """Добавление токена в черный список"""
        try:
            self.redis.setex(f"blacklist:{token}", expires_in, 1)
            logger.info(f"Token blacklisted")
        except redis.RedisError as e:
            logger.error(f"Error blacklisting token: {str(e)}")
            
    def cleanup_expired_tokens(self):
        """Очистка просроченных токенов"""
        try:
            # Redis автоматически удаляет просроченные ключи
            logger.info("Expired tokens cleanup completed")
        except redis.RedisError as e:
            logger.error(f"Error during tokens cleanup: {str(e)}")
