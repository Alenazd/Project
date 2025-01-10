const BASE_URL = "http://127.0.0.1:8080";

// Получение информации о пользователе
async function fetchUserInfo() {
    try {
        const response = await fetch(`${BASE_URL}/user`, {
            method: "GET",
            credentials: "include",
        });
        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();

        if (data.error) {
            console.error(data.error);
        } else {
            document.getElementById("user-info").style.display = "block";
            document.getElementById("username").textContent = data.username || "Неизвестный пользователь";
            document.getElementById("email").textContent = data.email || "Не указан";
            if (data.avatar) {
                document.getElementById("avatar").src = data.avatar;
            }
        }
    } catch (error) {
        console.error("Ошибка при получении данных пользователя:", error);
        alert("Ошибка соединения с сервером.");
    }
}

// Логика управления попапом для логина
const wrapper = document.querySelector('.wrapper');
const btnPopup = document.querySelector('.btnLogin-popup');
const closePopup = document.getElementById('close-popup');

btnPopup.addEventListener('click', () => {
    wrapper.classList.add('active-popup');
});

closePopup.addEventListener('click', () => {
    wrapper.classList.add('close-popup');
    setTimeout(() => {
        wrapper.classList.remove('active-popup', 'close-popup');
    }, 500);
});

async function updateUIBasedOnRole() {
    try {
        const response = await fetch(`${BASE_URL}/user`, {
            method: "GET",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }

        const userData = await response.json();

        if (userData.role === "teacher") {
            document.getElementById("teacherSection").style.display = "block";
            document.getElementById("studentSection").style.display = "none";
        } else if (userData.role === "student") {
            document.getElementById("teacherSection").style.display = "none";
            document.getElementById("studentSection").style.display = "block";
        }
    } catch (error) {
        console.error("Ошибка при обновлении интерфейса:", error);
        alert("Ошибка соединения с сервером.");
    }
}

// Открытие окна для поиска пользователей
document.getElementById('findUsersBtn').addEventListener('click', () => {
    const findUsersPopup = document.getElementById('findUsersPopup');
    findUsersPopup.style.display = 'flex'; // Показываем попап
    document.getElementById('userResultsList').innerHTML = ''; // Очищаем предыдущие результаты
});

// Закрытие окна поиска пользователей
document.getElementById('close-find-users-popup').addEventListener('click', () => {
    document.getElementById('findUsersPopup').style.display = 'none';
});

// Поиск пользователей и отображение результатов в том же окне
document.getElementById('searchUserBtn').addEventListener('click', async () => {
    const nickname = document.getElementById('searchUserInput').value;

    try {
        const response = await fetch(`${BASE_URL}/users?nickname=${nickname}`);
        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }

        const users = await response.json();
        const userResultsList = document.getElementById('userResultsList');
        userResultsList.innerHTML = ''; // Очищаем предыдущие результаты

        if (users.length === 0) {
            userResultsList.innerHTML = '<li>Пользователи не найдены</li>';
        } else {
            users.forEach(user => {
                const li = document.createElement('li');
                li.textContent = `Nickname: ${user.nickname}, Role: ${user.role}`;
                userResultsList.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        alert('Ошибка соединения с сервером.');
    }
});

// Открытие окна для изменения nickname
document.getElementById('accountSettingsBtn').addEventListener('click', () => {
    document.getElementById('accountSettingsPopup').style.display = 'flex';
});

// Закрытие окна для изменения nickname
document.getElementById('close-account-settings-popup').addEventListener('click', () => {
    document.getElementById('accountSettingsPopup').style.display = 'none';
});

// Сохранение нового nickname
document.getElementById('saveNicknameBtn').addEventListener('click', async () => {
    const newNickname = document.getElementById('newNicknameInput').value;

    try {
        const response = await fetch(`${BASE_URL}/updateNickname`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nickname: newNickname })
        });

        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }

        if (response.ok) {
            alert('Nickname успешно изменен!');
            document.getElementById('accountSettingsPopup').style.display = 'none';
        } else {
            const error = await response.json();
            alert('Ошибка при изменении nickname: ' + error.message);
        }
    } catch (error) {
        console.error('Ошибка при изменении nickname:', error);
        alert('Ошибка соединения с сервером.');
    }
});

// Функция авторизации
async function login() {
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;

    try {
        const response = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
            alert(data.error);
        } else {
            alert('Авторизация успешна!');
            document.getElementById('loginPopup').style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        alert('Ошибка соединения с сервером.');
    }
}

// Функция выхода из системы
async function logout() {
    try {
        const response = await fetch(`${BASE_URL}/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }

        alert('Выход из системы успешен!');
        document.getElementById('logoutPopup').style.display = 'none';
    } catch (error) {
        console.error('Ошибка выхода из системы:', error);
        alert('Ошибка соединения с сервером.');
    }
}

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('logoutBtn').addEventListener('click', logout);

// Функции для работы с UI
function showAccountSettings() {
    const popup = document.getElementById('accountSettingsPopup');
    popup.style.display = 'flex';
}

function closeAccountSettings() {
    const popup = document.getElementById('accountSettingsPopup');
    popup.style.display = 'none';
}

function showFindUsers() {
    const popup = document.getElementById('findUsersPopup');
    popup.style.display = 'flex';
}

function closeFindUsers() {
    const popup = document.getElementById('findUsersPopup');
    popup.style.display = 'none';
}

// Функция для обновления информации о пользователе на странице
async function updateUserInfo() {
    try {
        const userInfo = await getUserInfo();
        
        document.getElementById('userName').textContent = userInfo.username || 'Anonymous';
        document.getElementById('userEmail').textContent = userInfo.email || 'No email';
        document.getElementById('userNickname').textContent = userInfo.nickname || 'No nickname';
        
        if (userInfo.avatar) {
            document.getElementById('userAvatar').src = userInfo.avatar;
        }
    } catch (error) {
        console.error('Failed to update user info:', error);
        // Перенаправляем на главную страницу, если пользователь не авторизован
        window.location.href = '/';
    }
}

// Функция для обновления настроек аккаунта
async function updateAccountSettings(event) {
    event.preventDefault();
    
    const nickname = document.getElementById('newNickname').value;
    if (!nickname) {
        alert('Please enter a nickname');
        return;
    }

    try {
        const response = await fetchWithAuth(`${BASE_URL}/user/nickname`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nickname })
        });

        if (response.ok) {
            await updateUserInfo();
            closeAccountSettings();
            alert('Nickname updated successfully!');
        } else {
            const error = await response.json();
            alert(error.detail || 'Failed to update nickname');
        }
    } catch (error) {
        console.error('Error updating nickname:', error);
        alert('Failed to update nickname. Please try again later.');
    }
}

// Функция для поиска пользователей
async function searchUsers() {
    const searchInput = document.getElementById('searchUserInput').value;
    if (!searchInput) {
        alert('Please enter a search term');
        return;
    }

    try {
        const response = await fetchWithAuth(`${BASE_URL}/users/search?q=${encodeURIComponent(searchInput)}`);
        if (!response.ok) {
            throw new Error('Failed to search users');
        }

        const users = await response.json();
        const usersList = document.getElementById('userResultsList');
        usersList.innerHTML = ''; // Очищаем предыдущие результаты

        users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'user-result-item';
            li.innerHTML = `
                <img src="${user.avatar || 'IMG_3532.jpg'}" alt="Avatar" class="user-avatar">
                <div class="user-info">
                    <h3>${user.username || 'Anonymous'}</h3>
                    <p>${user.nickname || 'No nickname'}</p>
                </div>
            `;
            usersList.appendChild(li);
        });
    } catch (error) {
        console.error('Error searching users:', error);
        alert('Failed to search users. Please try again later.');
    }
}

// Загрузка активности пользователя
async function loadUserActivity() {
    try {
        const response = await fetchWithAuth(`${BASE_URL}/user/activity`);
        if (!response.ok) {
            throw new Error('Failed to load activity');
        }

        const activities = await response.json();
        const activityList = document.getElementById('activityList');
        activityList.innerHTML = ''; // Очищаем предыдущие результаты

        activities.forEach(activity => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `
                <div class="activity-time">${new Date(activity.timestamp).toLocaleString()}</div>
                <div class="activity-description">${activity.description}</div>
            `;
            activityList.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading activity:', error);
        const activityList = document.getElementById('activityList');
        activityList.innerHTML = '<p class="error-message">Failed to load activity</p>';
    }
}

// Инициализация страницы
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Проверяем авторизацию
        const isAuthorized = await checkAuth();
        if (!isAuthorized) {
            window.location.href = '/';
            return;
        }

        // Загружаем информацию о пользователе
        await updateUserInfo();
        
        // Загружаем активность пользователя
        await loadUserActivity();
    } catch (error) {
        console.error('Error initializing account page:', error);
        window.location.href = '/';
    }
});

window.onload = async () => {
    await fetchUserInfo();
    await updateUIBasedOnRole();
};
