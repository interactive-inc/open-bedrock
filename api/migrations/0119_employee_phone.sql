-- 従業員本人が自己申告する電話番号。ライフイベント届出などの入力補助に使う（記録のみ、検証・必須化はしない）。
ALTER TABLE employees ADD COLUMN phone TEXT;
