-- Grant satpam access to input perizinan and kedisiplinan.
INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('satpam', 'izin'),
('satpam', 'kedisiplinan');
