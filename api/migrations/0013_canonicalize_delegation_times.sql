-- 0010 でオフセット付きの入力値をそのまま保存していた委任時刻を UTC へ正規化する。
-- 解釈不能または逆転した期間は、将来の認可根拠にならないよう作成時刻で取消済みにする。
UPDATE approval_delegations
SET cancelled_at = COALESCE(cancelled_at, created_at)
WHERE julianday(starts_at) IS NULL
   OR julianday(ends_at) IS NULL
   OR julianday(starts_at) >= julianday(ends_at);

UPDATE approval_delegations
SET starts_at = strftime('%Y-%m-%dT%H:%M:%fZ', starts_at),
    ends_at = strftime('%Y-%m-%dT%H:%M:%fZ', ends_at)
WHERE julianday(starts_at) IS NOT NULL
  AND julianday(ends_at) IS NOT NULL
  AND julianday(starts_at) < julianday(ends_at);
