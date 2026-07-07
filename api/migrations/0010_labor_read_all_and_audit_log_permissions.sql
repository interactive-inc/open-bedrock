-- 労務系6ドメインの横断閲覧 permission と、監査ログ閲覧 permission を追加する。
-- 労務系は hr / admin / auditor に、監査ログは admin / auditor に付与。
-- 貸与品(rental)は総務(general_affairs)の職掌なので rental:read:all を追加付与する。
-- 0004_iam_seed.sql と同じく INSERT OR IGNORE で冪等に追加する。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('certificate_request:read:all', '全社の証明書発行依頼を横断で閲覧する', 'certificate-request'),
  ('resignation:read:all', '全社の退職手続きを横断で閲覧する', 'resignation'),
  ('life_event:read:all', '全社のライフイベント届を横断で閲覧する', 'life-event'),
  ('family_care_leave:read:all', '全社の産休・育休・介護休業の申出を横断で閲覧する', 'family-care-leave'),
  ('business_trip:read:all', '全社の出張申請を横断で閲覧する', 'business-trip'),
  ('rental:read:all', '全社の貸与品予約を横断で閲覧する', 'rental'),
  ('audit_log:read', '監査ログを閲覧する', 'iam');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('hr', 'admin', 'auditor')
    AND p.key IN (
      'certificate_request:read:all',
      'resignation:read:all',
      'life_event:read:all',
      'family_care_leave:read:all',
      'business_trip:read:all',
      'rental:read:all'
    );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('admin', 'auditor') AND p.key = 'audit_log:read';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'general_affairs' AND p.key = 'rental:read:all';
