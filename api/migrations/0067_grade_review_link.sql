-- 等級割当と評価サイクルの接続。任意の紐付けのため NULL 許容。
ALTER TABLE employee_grades ADD COLUMN review_cycle_id INTEGER;
