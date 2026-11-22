-- Migration: Remove legacy permissive {public} storage.objects policies
-- Covered by owner-scoped {authenticated} policies created in 20261122140000_wave_a_security_atomic_rpcs.sql

DROP POLICY IF EXISTS "Anyone can update their own avatar." ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
