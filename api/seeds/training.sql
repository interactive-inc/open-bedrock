-- training ドメインの seed
-- 研修コースと社員ごとの受講登録。
-- 値は src/infrastructure/seed/seed-training-courses.ts と src/infrastructure/seed/seed-training-enrollments.ts に一致させること。

INSERT INTO training_courses (id, code, title, description, duration_minutes, category, is_required, status) VALUES
('0190002c-0000-7000-8000-000000000001', 'TR-SEC-01', '情報セキュリティ基礎', '全従業員必須のセキュリティ研修', 60, 'コンプライアンス', 1, 'active'),
('0190002c-0000-7000-8000-000000000002', 'TR-MGR-01', '新任管理職研修', NULL, 180, 'マネジメント', 0, 'active'),
('0190002c-0000-7000-8000-000000000003', 'TR-OLD-01', '旧システム運用', NULL, NULL, 'システム', 0, 'archived');

INSERT INTO training_enrollments (id, course_id, employee_id, status, completed_at, score, due_date) VALUES
('0190002d-0000-7000-8000-000000000001', '0190002c-0000-7000-8000-000000000001', '01900062-0000-7000-8000-000000000005', 'enrolled', NULL, NULL, '2026-06-30'),
('0190002d-0000-7000-8000-000000000002', '0190002c-0000-7000-8000-000000000002', '01900062-0000-7000-8000-000000000004', 'completed', '2026-05-01T09:00:00Z', 92, NULL);
