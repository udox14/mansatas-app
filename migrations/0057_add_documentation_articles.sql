CREATE TABLE IF NOT EXISTS documentation_articles (
  id TEXT PRIMARY KEY,
  audience TEXT NOT NULL DEFAULT 'internal' CHECK(audience IN ('internal', 'parent')),
  feature_id TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content_md TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documentation_articles_audience_feature
  ON documentation_articles(audience, feature_id, is_published, sort_order);
