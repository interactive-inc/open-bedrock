-- knowledge ドメインの seed
-- ナレッジ記事（社内手続き・規程などの記事）
-- 値は src/infrastructure/seed/seed-knowledge-articles.ts と一致させること。

INSERT INTO knowledge_articles (id, title, category, tags, body_md, author_id, created_at) VALUES
(1, 'Remote Work Policy', 'Policy', 'remote,attendance,wfh', '## Remote Work Policy

Up to three days of remote work per week are allowed. Submit a remote work request in advance.', 2, '2026-01-05T00:00:00Z'),
(2, 'Expense Reimbursement Procedure', 'Accounting', 'expense,reimbursement,advance', '## Expense Reimbursement

Attach receipts and submit advanced expenses through the expense request. The cutoff is the last day of each month.', 16, '2026-01-10T00:00:00Z'),
(3, 'Onboarding Guide', 'Onboarding', 'onboarding,training,newcomer', '## Onboarding

Accounts are issued on day one, department training happens in week one, and a one-on-one is held in the first month.', 3, '2026-02-01T00:00:00Z'),
(4, 'Goal Setting and Evaluation', 'Evaluation', 'goal,evaluation,MBO', '## Goal Setting

Goals are set each half year and evaluated in three stages: self evaluation, manager evaluation, and final evaluation.', 2, '2026-02-15T00:00:00Z'),
(5, 'Meeting Room Booking Rules', 'Administration', 'meeting room,booking,facility', '## Meeting Room Booking

Book rooms with the karte room command. Restore the room to its original state after use.', 16, '2026-03-01T00:00:00Z'),
(6, 'Information Security Policy', 'Security', 'security,information management,compliance', '## Information Security

Do not take confidential information off premises and change your password regularly.', 1, '2026-03-10T00:00:00Z');
