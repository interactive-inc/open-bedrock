-- training ドメインの seed
-- 研修コースと社員ごとの受講登録。
-- 値は src/infrastructure/seed/seed-training-courses.ts と src/infrastructure/seed/seed-training-enrollments.ts に一致させること。

INSERT INTO training_courses (id, code, title, description, duration_minutes, category, is_required, status) VALUES
(1, 'TR-SEC-01', '情報セキュリティ基礎', '全従業員必須のセキュリティ研修', 60, 'コンプライアンス', 1, 'active'),
(2, 'TR-MGR-01', '新任管理職研修', NULL, 180, 'マネジメント', 0, 'active'),
(3, 'TR-OLD-01', '旧システム運用', NULL, NULL, 'システム', 0, 'archived');

INSERT INTO training_enrollments (id, course_id, employee_id, status, completed_at, score, due_date) VALUES
(1, 1, 5, 'enrolled', NULL, NULL, '2026-06-30'),
(2, 2, 4, 'completed', '2026-05-01T09:00:00Z', 92, NULL);
