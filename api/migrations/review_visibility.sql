-- 評価フォームの開示制御。既存行は disclosed で互換維持し、新規作成は hidden をアプリ側で指定する。
ALTER TABLE review_forms ADD COLUMN visibility TEXT NOT NULL DEFAULT 'disclosed';
