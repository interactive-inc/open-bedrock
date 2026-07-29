-- 0038 で英語のまま投入した人事変更申請テンプレートの表示文言を日本語化する。
UPDATE application_templates
SET name = '人事異動申請',
    description = '発効日付きの雇用ライフサイクル変更を申請します。'
WHERE code = 'personnel_action_request';
