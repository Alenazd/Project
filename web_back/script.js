const BASE_URL = "http://127.0.0.1:8080"; // Адрес вашего backend

// Функции для работы с токенами
function getTokens() {
    return {
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken')
    };
}

function setTokens(accessToken, refreshToken) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
}

function clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
}

// Функция для обновления токена
async function refreshAccessToken() {
    const { refreshToken } = getTokens();
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    try {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${refreshToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        setTokens(data.access_token, data.refresh_token);
        return data.access_token;
    } catch (error) {
        clearTokens();
        throw error;
    }
}

// Функция для выполнения защищенных запросов
async function fetchWithAuth(url, options = {}) {
    const { accessToken } = getTokens();
    if (!accessToken) {
        throw new Error('No access token available');
    }

    // Добавляем токен к заголовкам
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`
    };

    try {
        const response = await fetch(url, { ...options, headers });
        
        if (response.status === 401) {
            // Токен истек, пробуем обновить
            const newAccessToken = await refreshAccessToken();
            
            // Повторяем запрос с новым токеном
            headers.Authorization = `Bearer ${newAccessToken}`;
            return fetch(url, { ...options, headers });
        }
        
        return response;
    } catch (error) {
        console.error('Error in fetchWithAuth:', error);
        throw error;
    }
}

// Логика управления попапами
const wrapper = document.querySelector('.wrapper');
const popup = document.getElementById("popup");
const btnPopup = document.querySelector('.btnLogin-popup');
const closePopup = document.getElementById('close-popup');

btnPopup.addEventListener('click', () => {
    wrapper.classList.add('active-popup');
    popup.classList.add('active-popup');
});

closePopup.addEventListener('click', () => {
    wrapper.classList.add('close-popup');
    popup.classList.remove('active-popup');
    setTimeout(() => {
        wrapper.classList.remove('active-popup', 'close-popup');
    }, 500);
});

// Авторизация через Yandex
document.querySelector(".btn:nth-child(1)").addEventListener("click", async () => {
    try {
        const response = await fetch(`${BASE_URL}/auth/login?type=yandex`, {
            method: "GET",
            credentials: "include",
        });
        if (response.redirected) {
            window.location.href = response.url;
        }
    } catch (error) {
        console.error("Ошибка авторизации через Yandex:", error);
    }
});

// Авторизация через GitHub
document.querySelector(".btn:nth-child(2)").addEventListener("click", async () => {
    try {
        const response = await fetch(`${BASE_URL}/auth/login?type=github`, {
            method: "GET",
            credentials: "include",
        });
        if (response.redirected) {
            window.location.href = response.url;
        }
    } catch (error) {
        console.error("Ошибка авторизации через GitHub:", error);
    }
});

// Функция выхода
async function logout(logoutAll = false) {
    try {
        const response = await fetchWithAuth(`${BASE_URL}/auth/logout${logoutAll ? '?all=true' : ''}`, {
            method: 'POST'
        });

        if (response.ok) {
            clearTokens();
            window.location.href = '/';
        } else {
            console.error('Ошибка при выходе');
        }
    } catch (error) {
        console.error('Ошибка при выходе:', error);
    }
}

// Функция для получения информации о пользователе
async function getUserInfo() {
    try {
        const response = await fetchWithAuth(`${BASE_URL}/user`);
        if (!response.ok) {
            throw new Error('Failed to fetch user info');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching user info:', error);
        throw error;
    }
}

// Проверяем авторизацию при загрузке страницы
async function checkAuth() {
    try {
        const { accessToken } = getTokens();
        if (!accessToken) {
            return false;
        }

        const response = await fetchWithAuth(`${BASE_URL}/`);
        return response.ok;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthorized = await checkAuth();
    const loginButton = document.querySelector('.btnLogin-popup');
    const logoutButton = document.querySelector('.btnlogout');
    const accountLink = document.querySelector('a[href="Account.html"]');

    if (isAuthorized) {
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
        accountLink.style.display = 'block';

        try {
            const userInfo = await getUserInfo();
            // Здесь можно обновить UI с информацией о пользователе
            console.log('User info:', userInfo);
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    } else {
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
        accountLink.style.display = 'none';
    }
});
