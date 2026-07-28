-- CLI identity brokerのauthorization codeを交換するPKCE verifier。
-- 既存stateは10分で失効するため空文字で移行し、交換時に安全側へ拒否する。

ALTER TABLE cli_login_states
  ADD COLUMN code_verifier TEXT NOT NULL DEFAULT '';
