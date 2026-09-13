import { expect, test } from "bun:test"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { PreparePreservedRecordDossierAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-dossier-authorization.adapter"
import { SystemAuditDisclosurePolicyRepository } from "@system/infrastructure/repositories/audit/system-audit-disclosure-policy.repository"
import { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { auditDisclosureFieldSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

test("監査出力資格は期限の1ms前まで有効で、期限ちょうどの最終transactionを拒否する", async () => {
  const db = createSystemAttachmentTestDatabase()
  await db.exec(`INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('operator','active',0,100,100);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES ('principal:operator','operator','human','Test operator',1,100,100);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES ('role:operator','role:operator','custom','Test role',100,100);
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('binding:operator','operator','role:operator',100);
    INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES
      ('role:operator','system:admin'),('role:operator','system:record:export'),('role:operator','system:procedure:read');`)
  const at = new Date()
  const expiresAt = new Date(Math.floor(at.getTime() / 1000) * 1000 + 60007)
  const policy = SystemAuditDisclosurePolicyEntity.create({
    scope: "operator",
    commandId: crypto.randomUUID(),
    revision: 1,
    enabled: true,
    allowedFields: auditDisclosureFieldSchema.options,
    allowedTargetTypes: null,
    allowedPurposes: ["archive"],
    expiresAt: expiresAt.toISOString(),
    reason: "Temporary archive access",
    actorAccountId: "operator",
    recordedAt: at.toISOString(),
    auditEventId: crypto.randomUUID(),
  })
  if (policy instanceof Error) throw policy
  const appended = await new SystemAuditDisclosurePolicyRepository({
    env: { DB: db },
    assertions: [db.prepare("SELECT 1")],
  }).append(policy, null)
  if (appended instanceof Error) throw appended
  const reader = new PreparePreservedRecordDossierAuthorizationAdapter({
    env: { DB: db },
    purpose: "archive",
    authentication: {
      accountId: zAccountId.parse("operator"),
      tokenVersion: 0,
      issuedAtMs: at.getTime() - 1000,
      expiresAtMs: expiresAt.getTime() + 60000,
      machineCredentialId: null,
      identityBindingId: null,
    },
  })
  const proof = await reader.prepare(at)
  if (proof instanceof Error) throw proof
  const before = proof.assertions(new Date(expiresAt.getTime() - 1))
  if (before instanceof Error) throw before
  await db.batch(before)
  for (const offset of [0, 1]) {
    const expired = proof.assertions(new Date(expiresAt.getTime() + offset))
    if (expired instanceof Error) throw expired
    expect(await db.batch(expired).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
    expect(await reader.prepare(new Date(expiresAt.getTime() + offset))).toBeInstanceOf(Error)
  }
  await db.exec(
    "DELETE FROM system_iam_role_permissions WHERE role_id = 'role:operator' AND permission_key = 'system:admin'",
  )
  const revoked = proof.assertions(at)
  if (revoked instanceof Error) throw revoked
  expect(await db.batch(revoked).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
  expect(await reader.prepare(at)).toBeInstanceOf(Error)
})
