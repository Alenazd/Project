import logging
import os
from datetime import datetime
from functools import wraps
import json
import traceback

# Настройка логгера
def setup_logger():
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
        
    current_date = datetime.now().strftime("%Y-%m-%d")
    log_file = os.path.join(log_dir, f"web_client_{current_date}.log")
    
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(formatter)
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    
    logger = logging.getLogger('web_client')
    logger.setLevel(logging.INFO)
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

logger = setup_logger()

def log_request(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        request = args[0] if args else None
        
        # Логируем информацию о запросе
        request_info = {
            'method': request.method if request else 'Unknown',
            'path': request.path if request else 'Unknown',
            'remote_addr': request.remote_addr if request else 'Unknown',
            'user_agent': request.headers.get('User-Agent', 'Unknown'),
        }
        
        logger.info(f"Request: {json.dumps(request_info)}")
        
        try:
            result = func(*args, **kwargs)
            # Логируем успешный ответ
            logger.info(f"Response: Success - {request.path}")
            return result
        except Exception as e:
            # Логируем ошибку с полным стектрейсом
            error_info = {
                'error': str(e),
                'traceback': traceback.format_exc()
            }
            logger.error(f"Error in {func.__name__}: {json.dumps(error_info)}")
            raise
            
    return wrapper
