-- Company組織変更のoperation IDを内容digestへ結び、同じcommandだけを安全に再実行する。

ALTER TABLE organization_change_operations
ADD COLUMN request_fingerprint TEXT NOT NULL
DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'
CHECK (
  length(request_fingerprint) = 64
  AND request_fingerprint NOT GLOB '*[^0-9a-f]*'
);

ALTER TABLE organization_change_operations
ADD COLUMN actor_account_id TEXT NOT NULL DEFAULT 'system:legacy'
CHECK (length(actor_account_id) BETWEEN 1 AND 255 AND trim(actor_account_id) = actor_account_id);

ALTER TABLE organization_change_operations
ADD COLUMN reason TEXT NOT NULL DEFAULT 'legacy organization change'
CHECK (length(reason) BETWEEN 1 AND 1000 AND trim(reason) = reason);

ALTER TABLE organization_change_operations
ADD COLUMN evidence_references_json TEXT NOT NULL DEFAULT '[]'
CHECK (json_valid(evidence_references_json) AND json_type(evidence_references_json) = 'array');

CREATE TRIGGER organization_change_operations_command_immutable
BEFORE UPDATE OF request_fingerprint, actor_account_id, reason, evidence_references_json
ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change command is immutable');
END;
