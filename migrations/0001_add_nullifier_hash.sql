-- Migration: Initialize schema & ensure nullifier_hash column exists
-- This migration is safe to run on both fresh and existing databases.

-- Users table with nullifier_hash to track unique World ID verifications
CREATE TABLE IF NOT EXISTS users (
  wallet_address TEXT PRIMARY KEY,
  world_id_verified INTEGER NOT NULL DEFAULT 0,
  nullifier_hash TEXT UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Daily matches table
CREATE TABLE IF NOT EXISTS daily_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT NOT NULL,
  date TEXT NOT NULL,
  match_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (wallet_address, date)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  reference_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique index on nullifier_hash to ensure uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nullifier_hash ON users(nullifier_hash);
