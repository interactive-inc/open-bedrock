-- 既存の有効なrefresh tokenを失効させず、秒epochをcanonical millisecondへ変換する。
INSERT INTO system_sessions (
  id, account_id, family_id, token_hash, token_version,
  created_at, expires_at, rotated_at, revoked_at
)
SELECT
  'legacy:' || id,
  CAST(account_id AS TEXT),
  family_id,
  token_hash,
  token_version,
  created_at * 1000,
  expires_at * 1000,
  NULL,
  CASE WHEN revoked_at IS NULL THEN NULL ELSE revoked_at * 1000 END
FROM refresh_tokens;

SELECT CASE WHEN
  (SELECT count(*) FROM refresh_tokens) =
  (SELECT count(*) FROM system_sessions WHERE id LIKE 'legacy:%')
THEN 1 ELSE json_extract('', '$') END AS canonical_session_backfill_complete;

DROP TABLE refresh_tokens;
