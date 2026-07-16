-- システム上の権限セットと、組織図上のマネージャー関係を表示名でも区別する。
-- key は既存連携との互換性のため変更しない。
UPDATE roles
SET name = CASE key
      WHEN 'member' THEN '標準利用者'
      WHEN 'manager' THEN '業務管理者'
      WHEN 'hr' THEN '人事管理者'
      WHEN 'admin' THEN 'システム管理者'
      ELSE name
    END,
    description = CASE key
      WHEN 'member' THEN '自己操作を行う標準の権限セット。組織上の役割とは独立する'
      WHEN 'manager' THEN '管理業務の操作権限セット。対象範囲は組織関係で別に判定する'
      WHEN 'hr' THEN '全社の人事業務を扱う権限セット'
      WHEN 'admin' THEN 'IAM とアカウント管理を含むシステム管理権限セット'
      ELSE description
    END
WHERE is_system = 1 AND key IN ('member', 'manager', 'hr', 'admin');
