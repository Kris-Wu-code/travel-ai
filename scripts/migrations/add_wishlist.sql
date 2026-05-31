-- Allow 'wishlist' as a valid target_type in bookmarks table
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_target_type_check;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_target_type_check CHECK (target_type IN ('diary', 'scene', 'wishlist'));
