-- 最強のシステムロールの key を admin から root へ改名する。表示名(name)は「システム管理者」のまま。
-- roles は 0003 で作成済みのため、この migration がどの順序で適用されても安全。
-- WHERE で対象を絞るため、既に root へ移行済みの DB では 0 行更新(冪等)。
UPDATE roles
SET key = 'root'
WHERE key = 'admin' AND is_system = 1;
