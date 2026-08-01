-- announcement ドメインの seed
-- 全社お知らせ（公開・下書き・アーカイブの3状態を含む）
-- 値は src/infrastructure/seed/seed-announcements.ts と一致させること。

INSERT INTO announcements (id, title, body_md, published_on, author_employee_id, status, created_at) VALUES
  (1, 'オフィス移転のお知らせ', '10階の新オフィスへ移転します。', '2026-02-01', 1, 'published', '2026-02-01T09:00:00Z'),
  (2, '夏季休暇のスケジュール', '夏季休暇は8月12日から16日までです。', '2026-06-15', 1, 'published', '2026-06-15T09:00:00Z'),
  (3, '下書き: 新経費規程', '近日改定予定の経費規程の詳細です。', NULL, 1, 'draft', '2026-06-20T09:00:00Z'),
  (4, 'アーカイブ: 旧駐車場ルール', '現在は適用されない旧駐車場ルールです。', '2025-01-10', 1, 'archived', '2025-01-10T09:00:00Z');
