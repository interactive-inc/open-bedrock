-- 目標ツリー(全社→部門→個人)のための goals 拡張。
-- owner_type で目標の所有主体(個人/部門/全社)を区別し、parent_goal_id で階層を、
-- department_code で部門目標の所属を表す。既存行はすべて個人目標として個人(individual)に寄せる。
ALTER TABLE goals ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'individual';

ALTER TABLE goals ADD COLUMN parent_goal_id INTEGER;

ALTER TABLE goals ADD COLUMN department_code TEXT;

CREATE INDEX IF NOT EXISTS idx_goals_owner_type ON goals (owner_type);

CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals (parent_goal_id);

CREATE INDEX IF NOT EXISTS idx_goals_department ON goals (department_code);
