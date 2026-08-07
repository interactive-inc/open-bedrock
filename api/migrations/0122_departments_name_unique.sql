-- 部署マスタの同名重複を防ぐ UNIQUE 制約を追加する。
CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_name ON departments (name);
