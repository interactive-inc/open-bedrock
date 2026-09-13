import { preparePreservedRecordWriteAuthorization } from "@system/interface/authorization/prepare-preserved-record-write-authorization"
import { preparePreservedRecordReadAuthorization } from "@system/interface/authorization/prepare-preserved-record-read-authorization"
import { expect, test } from "bun:test"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

const at = new Date("2035-01-01T00:00:00Z")

async function fixture(kind: "human" | "agent" | "service" | "connector" | "legacy" = "human") {
  const db = createSystemAttachmentTestDatabase()
  await db.exec(
    "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES ('reader','active',0,100,100),('other','active',0,100,100); INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('reader-role','reader:role','custom','Reader',100,100); INSERT INTO system_iam_role_permissions VALUES ('reader-role','records:read'); INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('reader-binding','reader','reader-role',100);",
  )
  if (kind === "connector")
    await db.exec(
      "INSERT INTO system_connectors(id,key,name,direction,transport,status,revision,created_at,updated_at) VALUES ('connector','connector','Test connector','bidirectional','api','active',1,100,100)",
    )
  if (kind !== "legacy")
    await db
      .prepare(
        "INSERT INTO system_principals(id,account_id,kind,name,connector_id,revision,created_at,updated_at) VALUES ('principal','reader',?1,'Reader',?2,1,100,100)",
      )
      .bind(kind, kind === "connector" ? "connector" : null)
      .run()
  const machine = kind !== "human" && kind !== "legacy"
  if (machine)
    await db
      .prepare(
        "INSERT INTO system_machine_credentials(id,principal_id,name,secret_hash,status,created_at,updated_at,last_used_at,expires_at) VALUES ('credential','principal','Reader key',?1,'active',100,?2,?2,?3)",
      )
      .bind("a".repeat(64), at.getTime(), at.getTime() + 60000)
      .run()
  const authentication: SystemReadAuthentication = {
    accountId: zAccountId.parse("reader"),
    tokenVersion: 0,
    issuedAtMs: at.getTime(),
    expiresAtMs: at.getTime() + 60000,
    machineCredentialId: machine ? "credential" : null,
    identityBindingId: null,
  }
  const adapter = new PrepareSystemReadAuthorizationAdapter({ env: { DB: db } })
  const prepare = () => adapter.prepare(authentication, at)
  return { db, authentication, adapter, prepare }
}

test.each(["human", "legacy", "agent", "service", "connector"] as const)(
  "%s の現在の権限と発行元をSystemだけで検証する",
  async (kind) => {
    const f = await fixture(kind)
    const prepared = await f.prepare()
    if (prepared === null || prepared instanceof Error)
      throw new Error("authorization missing", { cause: prepared })
    expect([...prepared.permissionKeys]).toEqual(["records:read"])
    const assertions = prepared.assertions(at)
    if (assertions instanceof Error) throw assertions
    expect((await f.db.batch([...assertions])).every((row) => row.success)).toBe(true)
    expect(JSON.stringify(prepared)).not.toContain("a".repeat(64))
    const expired = prepared.assertions(new Date(at.getTime() + 60000))
    if (expired instanceof Error) throw expired
    expect(await f.db.batch([...expired]).catch((error: unknown) => error)).toBeInstanceOf(Error)
    expect(
      await f.adapter.prepare({ ...f.authentication, expiresAtMs: at.getTime() }, at),
    ).toBeInstanceOf(Error)
  },
)

test.each(["account", "grant", "role", "principal"])(
  "準備後の %s の変更をtransactionで拒否する",
  async (kind) => {
    const f = await fixture()
    const prepared = await f.prepare()
    if (prepared === null || prepared instanceof Error)
      throw new Error("authorization missing", { cause: prepared })
    const sql =
      kind === "account"
        ? "UPDATE system_accounts SET token_version=1 WHERE id='reader'"
        : kind === "grant"
          ? "DELETE FROM system_iam_role_permissions WHERE role_id='reader-role'"
          : kind === "role"
            ? "UPDATE system_iam_roles SET updated_at=101 WHERE id='reader-role'"
            : "UPDATE system_principals SET revision=2,updated_at=101 WHERE id='principal'"
    await f.db.exec(sql)
    const assertions = prepared.assertions(at)
    if (assertions instanceof Error) throw assertions
    expect(await f.db.batch([...assertions]).catch((error: unknown) => error)).toBeInstanceOf(Error)
  },
)

test.each(["agent", "service", "connector"] as const)(
  "%s のcredentialは別の発行元・人のtoken・失効で代用できない",
  async (kind) => {
    const f = await fixture(kind)
    for (const machineCredentialId of [null, "missing"])
      expect(await f.adapter.prepare({ ...f.authentication, machineCredentialId }, at)).toBeNull()
    const prepared = await f.prepare()
    if (prepared === null || prepared instanceof Error)
      throw new Error("authorization missing", { cause: prepared })
    await f.db
      .prepare(
        "UPDATE system_machine_credentials SET status='revoked',revoked_at=?1,updated_at=?1 WHERE id='credential'",
      )
      .bind(at.getTime())
      .run()
    const assertions = prepared.assertions(at)
    if (assertions instanceof Error) throw assertions
    expect(await f.db.batch([...assertions]).catch((error: unknown) => error)).toBeInstanceOf(Error)
    expect(await f.prepare()).toBeNull()
  },
)

test("connectorの停止と将来の権限失効を、時計を進めた開示でも検出する", async () => {
  const f = await fixture("connector")
  const prepared = await f.prepare()
  if (prepared === null || prepared instanceof Error)
    throw new Error("authorization missing", { cause: prepared })
  await f.db.exec(
    "UPDATE system_connectors SET status='disabled',revision=2,updated_at=101 WHERE id='connector'",
  )
  const assertions = prepared.assertions(at)
  if (assertions instanceof Error) throw assertions
  expect(await f.db.batch([...assertions]).catch((error: unknown) => error)).toBeInstanceOf(Error)
  const human = await fixture()
  await human.db
    .prepare("UPDATE system_role_bindings SET revoked_at=?1 WHERE id='reader-binding'")
    .bind(at.getTime() + 1000)
    .run()
  const active = await human.prepare()
  if (active === null || active instanceof Error)
    throw new Error("authorization missing", { cause: active })
  const later = active.assertions(new Date(at.getTime() + 1000))
  if (later instanceof Error) throw later
  expect(await human.db.batch([...later]).catch((error: unknown) => error)).toBeInstanceOf(Error)
})

test("外部認証は確認したidentityを固定し、別Accountのidentityと取消を拒否する", async () => {
  const f = await fixture()
  await f.db.exec(
    "INSERT INTO system_identity_bindings(id,account_id,provider,subject,created_at,activated_at) VALUES ('identity','reader','oidc','reader-subject',100,100),('other-identity','other','oidc','other-subject',100,100)",
  )
  expect(
    await f.adapter.prepare({ ...f.authentication, identityBindingId: "other-identity" }, at),
  ).toBeNull()
  const authentication = { ...f.authentication, identityBindingId: "identity" }
  const prepared = await f.adapter.prepare(authentication, at)
  if (prepared === null || prepared instanceof Error)
    throw new Error("authorization missing", { cause: prepared })
  await f.db
    .prepare("UPDATE system_identity_bindings SET revoked_at=?1 WHERE id='identity'")
    .bind(at.getTime())
    .run()
  const assertions = prepared.assertions(at)
  if (assertions instanceof Error) throw assertions
  expect(await f.db.batch([...assertions]).catch((error: unknown) => error)).toBeInstanceOf(Error)
  expect(await f.adapter.prepare(authentication, at)).toBeNull()
})

test.each(["human", "agent", "service", "connector"] as const)(
  "%s requires the explicit record operation permission",
  async (kind) => {
    const f = await fixture(kind)
    const input = { authentication: f.authentication, action: "read" as const, at }
    expect(await preparePreservedRecordReadAuthorization({ env: { DB: f.db } }, input)).toBeNull()
    await f.db.exec(
      "DELETE FROM system_iam_role_permissions; INSERT INTO system_iam_role_permissions VALUES ('reader-role', 'system:record:read')",
    )
    const proof = await preparePreservedRecordReadAuthorization({ env: { DB: f.db } }, input)
    if (proof === null || proof instanceof Error)
      throw new Error("missing explicit read permission")
    expect(
      await preparePreservedRecordReadAuthorization(
        { env: { DB: f.db } },
        { ...input, action: "export" },
      ),
    ).toBeNull()
    const assertions = proof.assertions(at)
    if (assertions instanceof Error) throw assertions
    await f.db.exec("DELETE FROM system_iam_role_permissions")
    expect(await f.db.batch([...assertions]).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
  },
)

test.each(["human", "agent", "service", "connector"] as const)(
  "%s needs explicit preservation permission and loses it at commit after revocation",
  async (kind) => {
    const f = await fixture(kind)
    const input = { authentication: f.authentication, at }
    const context = { env: { DB: f.db } }
    await f.db.exec(
      "DELETE FROM system_iam_role_permissions; INSERT INTO system_iam_role_permissions VALUES ('reader-role','system:record:read'),('reader-role','system:record:export')",
    )
    expect(await preparePreservedRecordWriteAuthorization(context, input)).toBeNull()
    await f.db.exec(
      "DELETE FROM system_iam_role_permissions; INSERT INTO system_iam_role_permissions VALUES ('reader-role','system:record:preserve')",
    )
    const proof = await preparePreservedRecordWriteAuthorization(context, input)
    if (proof === null || proof instanceof Error) throw new Error("missing preservation permission")
    expect(
      await preparePreservedRecordReadAuthorization(context, { ...input, action: "read" }),
    ).toBeNull()
    const guards = proof.assertions(at)
    if (guards instanceof Error) throw guards
    await f.db.batch([...guards])
    await f.db.exec("DELETE FROM system_iam_role_permissions")
    expect(await f.db.batch([...guards]).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
    expect(await preparePreservedRecordWriteAuthorization(context, input)).toBeNull()
  },
)
