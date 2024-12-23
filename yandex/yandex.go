package yandex

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Alenazd/Project/db"
	"github.com/golang-jwt/jwt/v4"
	"go.mongodb.org/mongo-driver/bson"
	"golang.org/x/oauth2"
)

// Структура для хранения данных о состоянии авторизации
type AuthState struct {
	ExpiresAt time.Time
	Status    string
}

// Мапа для хранения состояния авторизации по ключу (state)
var authStates = make(map[string]*AuthState)

// Конфигурация OAuth2 для Яндекса
var yandexOauth2Config = oauth2.Config{
	ClientID:     "75ecfe730e7146e98428f4566ddbd6de",
	ClientSecret: "8c8a3015bb07482298b89ff7810fa181",
	Scopes:       []string{"login:info", "login:email"},
	RedirectURL:  "http://localhost:8080/auth/yandex/callback",
	Endpoint: oauth2.Endpoint{
		AuthURL:  "https://oauth.yandex.ru/authorize",
		TokenURL: "https://oauth.yandex.ru/token",
	},
}

// Структура для хранения информации о токене
type TokenInfo struct {
	TokenTime time.Time
	State     string
}

// Структура для хранения данных пользователя
type UserData struct {
	ID           int       `bson:"id"`
	Login        string    `bson:"login"`
	Email        string    `bson:"email"`
	FirstName    string    `bson:"first_name"`
	LastName     string    `bson:"last_name"`
	Role         string    `bson:"role"`
	TokenInfo    TokenInfo `bson:"token_info"`
	AccessToken  string    `bson:"access_token"`
	RefreshToken string    `bson:"refresh_token"`
}

// Структура для генерации JWT
type JWTClaims struct {
	Email       string   `json:"email"`
	Permissions []string `json:"permissions"`
	Expiration  int64    `json:"exp"`
	jwt.StandardClaims
}

// Функция для генерации JWT токена
func generateJWT(email string, permissions []string, duration time.Duration) (string, error) {
	expirationTime := time.Now().Add(duration).Unix()
	claims := &JWTClaims{
		Email:       email,
		Permissions: permissions,
		Expiration:  expirationTime,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	// Подписываем токен секретным ключом
	return token.SignedString([]byte("your_secret_key"))
}

// Функция для получения разрешений на основе роли
func getPermissionsByRole(role string) []string {
	switch role {
	case "Администратор":
		return []string{"admin", "student", "teacher"} // Администратор имеет все разрешения
	case "Студент":
		return []string{"student"} // Студент имеет разрешение для студента
	case "Преподаватель":
		return []string{"teacher", "student"} // Преподаватель имеет разрешения для преподавателя и студента
	default:
		return []string{} // Если роль не определена, нет разрешений
	}
}

// Обработчик для начала авторизации с Яндексом
func YandexLogin(w http.ResponseWriter, r *http.Request) {
	// Генерируем токен входа (state)
	loginToken := fmt.Sprintf("%d", time.Now().UnixNano())

	// Устанавливаем время истечения токена через 5 минут
	authStates[loginToken] = &AuthState{
		ExpiresAt: time.Now().Add(5 * time.Minute),
		Status:    "not received",
	}

	// Формируем URL авторизации с параметрами client_id и state
	authURL := yandexOauth2Config.AuthCodeURL(loginToken, oauth2.AccessTypeOffline)
	http.Redirect(w, r, authURL, http.StatusFound)
}

// Callback для Яндекса
func YandexCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if state == "" || code == "" {
		http.Error(w, "Missing parameters", http.StatusBadRequest)
		return
	}

	// Проверяем, существует ли state в словаре
	authState, exists := authStates[state]
	if !exists || authState.Status == "denied" || time.Now().After(authState.ExpiresAt) {
		http.Error(w, "Authorization has expired or was denied", http.StatusForbidden)
		return
	}

	// Обмениваем код на токен
	token, err := yandexOauth2Config.Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "Failed to exchange authorization code for token", http.StatusInternalServerError)
		return
	}

	// Получаем информацию о пользователе
	req, err := http.NewRequest("GET", "https://login.yandex.ru/info?format=json", nil)
	if err != nil {
		http.Error(w, "Failed to create request to Yandex API", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	client := http.DefaultClient
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "Failed to fetch user info from Yandex", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, "Unexpected response from Yandex API", http.StatusInternalServerError)
		return
	}

	var userInfo map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		http.Error(w, "Failed to parse user info from Yandex API", http.StatusInternalServerError)
		return
	}

	email, ok := userInfo["default_email"].(string)
	if !ok {
		http.Error(w, "Email not found in user info", http.StatusInternalServerError)
		return
	}

	// Ищем пользователя в MongoDB по email
	collection := db.MongoDB.Database("authDB").Collection("users")
	var user UserData
	err = collection.FindOne(context.Background(), bson.M{"email": email}).Decode(&user)

	// Если пользователя нет, создаем нового
	if err != nil {
		user = UserData{
			Login:     "Aноним" + fmt.Sprintf("%d", time.Now().UnixNano()),
			Email:     email,
			FirstName: "Аноним",
			LastName:  "Пользователь",
			Role:      "Студент",
			TokenInfo: TokenInfo{TokenTime: time.Now(), State: "active"},
		}
		_, err = collection.InsertOne(context.Background(), user)
		if err != nil {
			http.Error(w, "Failed to create new user", http.StatusInternalServerError)
			return
		}
	}

	// Генерация JWT токенов
	permissions := getPermissionsByRole(user.Role)
	accessToken, err := generateJWT(user.Email, permissions, time.Minute)
	if err != nil {
		http.Error(w, "Failed to generate access token", http.StatusInternalServerError)
		return
	}

	refreshToken, err := generateJWT(user.Email, []string{"refresh"}, 7*24*time.Hour)
	if err != nil {
		http.Error(w, "Failed to generate refresh token", http.StatusInternalServerError)
		return
	}

	// Сохраняем токен обновления в базу данных
	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"email": user.Email},
		bson.M{"$push": bson.M{"tokens": refreshToken}},
	)
	if err != nil {
		http.Error(w, "Failed to save refresh token", http.StatusInternalServerError)
		return
	}

	// Обновляем статус в словаре
	authState.Status = "approved"
	authState.ExpiresAt = time.Now() // Обновляем время истечения

	// Ответ для пользователя
	fmt.Fprintf(w, `
	<html>
		<head><title>Authorization Successful</title></head>
		<body>
			<h1>Authorization Successful!</h1>
			<p>You have successfully logged in. Your access and refresh tokens are generated.</p>
			<p><a href="http://localhost:8080">Click here to return to the application</a></p>
		</body>
	</html>
`, accessToken, refreshToken)
}
