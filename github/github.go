package github

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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

// Конфигурация OAuth2 для GitHub
var githubOauth2Config = oauth2.Config{
	ClientID:     "Ov23liPyVH7q656rTDJ6",
	ClientSecret: "8532313915e4b2f338a3cf115ce5a13adff0b747",
	Scopes:       []string{"user:email"},
	RedirectURL:  "http://localhost:8080/auth/github/callback",
	Endpoint: oauth2.Endpoint{
		AuthURL:  "https://github.com/login/oauth/authorize",
		TokenURL: "https://github.com/login/oauth/access_token",
	},
}

// Структура для хранения информации о токене
type TokenInfo struct {
	TokenTime time.Time
	State     string
}

// Структура для хранения данных пользователя
type UserData struct {
	Email        string    `bson:"email"`
	Login        string    `bson:"login"`
	FirstName    string    `bson:"first_name"`
	LastName     string    `bson:"last_name"`
	Role         string    `bson:"role"`
	TokenInfo    TokenInfo `bson:"token_info"`
	AccessToken  string    `bson:"access_token"`
	RefreshToken string    `bson:"refresh_token"`
	Tokens       []string  `bson:"tokens"`
}

// Структура для генерации JWT
type JWTClaims struct {
	Email       string   `json:"email"`
	Permissions []string `json:"permissions"`
	Expiration  int64    `json:"exp"`
	jwt.RegisteredClaims
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

// Обработчик для начала авторизации с GitHub
func GitHubLogin(w http.ResponseWriter, r *http.Request) {
	// Генерируем токен входа (state)
	loginToken := fmt.Sprintf("%d", time.Now().UnixNano())

	// Устанавливаем время истечения токена через 5 минут
	authStates[loginToken] = &AuthState{
		ExpiresAt: time.Now().Add(5 * time.Minute),
		Status:    "not received",
	}

	// Формируем URL авторизации с параметрами client_id и state
	authURL := githubOauth2Config.AuthCodeURL(loginToken, oauth2.AccessTypeOffline)
	http.Redirect(w, r, authURL, http.StatusFound)
}

// Callback для GitHub
func GitHubCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if state == "" || code == "" {
		http.Error(w, "Missing parameters", http.StatusBadRequest)
		return
	}

	// Проверяем, существует ли state в словаре
	authState, exists := authStates[state]
	if !exists || time.Now().After(authState.ExpiresAt) {
		http.Error(w, "Authorization expired or invalid", http.StatusForbidden)
		return
	}

	// Обмениваем код на токен
	token, err := githubOauth2Config.Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "Failed to exchange authorization code for token", http.StatusInternalServerError)
		return
	}

	// Получаем данные пользователя
	req, _ := http.NewRequest("GET", "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	client := http.DefaultClient
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		http.Error(w, "Failed to fetch user info", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var userInfo map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		http.Error(w, "Failed to decode user info", http.StatusInternalServerError)
		return
	}

	// Отладочная информация
	log.Printf("GitHub user info: %v", userInfo)

	email, ok := userInfo["email"].(string)
	if !ok || email == "" {
		// Если email отсутствует, делаем дополнительный запрос к /user/emails
		req, _ = http.NewRequest("GET", "https://api.github.com/user/emails", nil)
		req.Header.Set("Authorization", "Bearer "+token.AccessToken)
		resp, err = client.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			http.Error(w, "Failed to fetch user emails", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		var emails []struct {
			Email    string `json:"email"`
			Primary  bool   `json:"primary"`
			Verified bool   `json:"verified"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
			http.Error(w, "Failed to decode user emails", http.StatusInternalServerError)
			return
		}

		// Отладочная информация
		log.Printf("GitHub user emails: %v", emails)

		for _, e := range emails {
			if e.Primary && e.Verified {
				email = e.Email
				break
			}
		}
	}

	if email == "" {
		http.Error(w, "Email not found in user info", http.StatusInternalServerError)
		return
	}

	// Работа с базой данных
	collection := db.MongoDB.Database("authDB").Collection("users")
	var user UserData
	err = collection.FindOne(context.Background(), bson.M{"email": email}).Decode(&user)

	if err != nil {
		// Если пользователь не найден, создаём нового
		user = UserData{
			Login:     fmt.Sprintf("Аноним_%d", time.Now().UnixNano()), // Логин с номером
			Email:     email,
			FirstName: "Аноним",
			LastName:  "Пользователь",
			Role:      "Студент",
			TokenInfo: TokenInfo{TokenTime: time.Now(), State: "active"},
			Tokens:    []string{}, // Пустой список токенов
		}
		_, err = collection.InsertOne(context.Background(), user)
		if err != nil {
			http.Error(w, "Failed to create new user", http.StatusInternalServerError)
			return
		}
	}

	// Получаем список разрешений для пользователя на основе его роли
	permissions := getPermissionsByRole(user.Role)

	// Генерация JWT токенов с использованием разрешений, соответствующих роли
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

	// Сохраняем токены в базу данных
	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"email": user.Email},
		bson.M{"$push": bson.M{"tokens": refreshToken}},
	)
	if err != nil {
		http.Error(w, "Failed to save refresh token", http.StatusInternalServerError)
		return
	}

	// Обновляем статус авторизации
	authState.Status = "approved"
	authState.ExpiresAt = time.Now()

	// Ответ пользователю
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
