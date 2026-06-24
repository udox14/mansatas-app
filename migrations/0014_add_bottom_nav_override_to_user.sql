-- Migration: Add bottom_nav_override to user table
-- Description: Stores the user's custom bottom navbar configuration (JSON string of feature IDs)

ALTER TABLE "user" ADD COLUMN bottom_nav_override TEXT;
