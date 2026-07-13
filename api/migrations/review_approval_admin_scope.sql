-- 組織マネージャーは部下の承認・評価実施を担うが、全社設定の変更権限は持たない。
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE key = 'manager')
  AND permission_id IN (
    SELECT id FROM permissions
    WHERE key IN ('review:administer', 'application_template:manage')
  );
