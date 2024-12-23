package db

import (
	"context"

	"log"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var MongoDB *mongo.Client
var UserCollection *mongo.Collection

func InitMongo(mongoURL string) {
	var err error
	MongoDB, err = mongo.Connect(context.TODO(), options.Client().ApplyURI(mongoURL))
	if err != nil {
		log.Fatalf("Error connecting to MongoDB: %v", err)
	}

	err = MongoDB.Ping(context.TODO(), nil)
	if err != nil {
		log.Fatalf("Error pinging MongoDB: %v", err)
	}
	log.Println("Successfully connected to MongoDB")

	UserCollection = MongoDB.Database("authDB").Collection("users")
}
