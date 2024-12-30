package main

import (
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/Alenazd/Project/db"
	"github.com/Alenazd/Project/qr"
	"github.com/Alenazd/Project/yandex"

	"github.com/Alenazd/Project/github"
	"github.com/joho/godotenv"
)

func main() {
	rand.Seed(time.Now().UnixNano())
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	db.InitMongo("mongodb://localhost:27017")

	http.HandleFunc("/auth/github/login", github.GitHubLogin)
	http.HandleFunc("/auth/github/callback", github.GitHubCallback)
	http.HandleFunc("/auth/yandex/login", yandex.YandexLogin)
	http.HandleFunc("/auth/yandex/callback", yandex.YandexCallback)
	http.HandleFunc("/code_auth", qr.CodeAuthenticationHandler)
	http.HandleFunc("/auth_server", qr.AuthorizationServerHandler)

	log.Println("Server started on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
