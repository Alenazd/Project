-- Create database if not exists
CREATE DATABASE testing_system;

-- Connect to the database
\c testing_system;

-- Create extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
