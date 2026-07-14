-- refresh family の有効行だけを対象に、失効処理と状態不変条件の全表走査を避ける。
CREATE INDEX idx_refresh_tokens_active_family
ON refresh_tokens (family_id)
WHERE revoked_at IS NULL;
