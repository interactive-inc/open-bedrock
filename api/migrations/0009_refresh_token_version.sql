-- Refresh token を発行時の account.token_version に固定する。
-- パスワード再設定・ロール変更・状態変更後に旧 refresh token から再発行される経路を塞ぐ。
ALTER TABLE refresh_tokens ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
