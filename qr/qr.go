package qr

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

// Структура для хранения данных о коде авторизации
type CodeAuthData struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// Структура для хранения данных об авторизации
type AuthServerData struct {
	ExpiresAt    time.Time `json:"expires_at"`
	Status       string    `json:"status"`
	AccessToken  string    `json:"access_token,omitempty"`
	RefreshToken string    `json:"refresh_token,omitempty"`
}

// Глобальные переменные для хранения данных и синхронизации
var (
	codeStore = make(map[string]CodeAuthData)   // key: code, value: CodeAuthData
	authStore = make(map[string]AuthServerData) // key: token, value: AuthServerData
	lock      sync.Mutex
)

// Генерация случайного 5-6-значного кода
func GenerateCode() string {
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}

// Обработчик для генерации кода авторизации
func CodeAuthenticationHandler(w http.ResponseWriter, r *http.Request) {
	lock.Lock()
	defer lock.Unlock()

	// Получение токена из запроса
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Токен отсутствует", http.StatusBadRequest)
		return
	}

	// Генерация случайного кода
	code := GenerateCode()
	codeData := CodeAuthData{
		Token:     token,
		ExpiresAt: time.Now().Add(1 * time.Minute), // Код действителен в течение 1 минуты
	}

	// Сохранение кода в словаре
	codeStore[code] = codeData

	// Ответ сгенерированным кодом
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"code": code})
}

// Обработчик для обработки запросов авторизации
func AuthorizationServerHandler(w http.ResponseWriter, r *http.Request) {
	lock.Lock()
	defer lock.Unlock()

	// Чтение параметров из запроса
	requestType := r.URL.Query().Get("type")
	token := r.URL.Query().Get("token")
	code := r.URL.Query().Get("code")
	refreshToken := r.URL.Query().Get("refresh_token")

	if requestType == "code" && token != "" {
		// Запрос на получение кода
		code, err := requestCodeFromCodeAuth(token)
		if err != nil {
			http.Error(w, "Не удалось сгенерировать код", http.StatusInternalServerError)
			return
		}

		// Сохранение структуры авторизации
		authStore[token] = AuthServerData{
			ExpiresAt: time.Now().Add(5 * time.Minute), // Устанавливаем срок действия 5 минут
			Status:    "ожидание",
		}

		// Ответ с кодом
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"code": code})
		return
	}

	if requestType == "validate" && code != "" && refreshToken != "" {
		// Проверка кода и токена обновления
		codeData, exists := codeStore[code]
		if !exists || time.Now().After(codeData.ExpiresAt) {
			http.Error(w, "Неверный или истекший код", http.StatusUnauthorized)
			return
		}

		// Проверка токена обновления (упрощенная проверка)
		if refreshToken != "valid-refresh-token" {
			http.Error(w, "Неверный токен обновления", http.StatusUnauthorized)
			return
		}

		// Эмуляция получения email пользователя
		email := "user@example.com"
		accessToken := fmt.Sprintf("access-%d", time.Now().UnixNano())
		newRefreshToken := fmt.Sprintf("refresh-%d", time.Now().UnixNano())

		// Сохранение обновленных данных авторизации
		authStore[codeData.Token] = AuthServerData{
			ExpiresAt:    time.Now().Add(5 * time.Minute),
			Status:       "доступ предоставлен",
			AccessToken:  accessToken,
			RefreshToken: newRefreshToken,
		}

		// Ответ с данными пользователя
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"email":         email,
			"access_token":  accessToken,
			"refresh_token": newRefreshToken,
		})
		return
	}

	http.Error(w, "Неверный запрос", http.StatusBadRequest)
}

// Запрос на получение кода от компонента Code Authentication
func requestCodeFromCodeAuth(token string) (string, error) {
	// Формирование URL запроса
	url := fmt.Sprintf("http://localhost:8080/code_auth?token=%s", token)
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// Чтение ответа
	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result["code"], nil
}
