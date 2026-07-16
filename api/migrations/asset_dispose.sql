-- 資産の廃棄記録用カラム（asset.sql の assets を拡張）。
-- 廃棄済みは status='disposed'。理由・日付を保持する。既存 DB への追加のため ALTER で足す。
ALTER TABLE assets ADD COLUMN disposed_on TEXT;

ALTER TABLE assets ADD COLUMN disposal_reason TEXT;
