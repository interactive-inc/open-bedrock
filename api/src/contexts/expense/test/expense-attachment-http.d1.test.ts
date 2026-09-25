import { PrepareRecordRetirementPageKeysAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-page-keys.adapter"
import { prepareSystemRecordRetirementStorageKeys } from "@system/interface/operations/prepare-system-record-retirement-storage-keys"
import { prepareSystemRecordRetirementSourceAttachments } from "@system/interface/operations/prepare-system-record-retirement-source-attachments"
import { PrepareExpenseRetirementPageAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-retirement-page.adapter"
import {
  zAppExpenseRetirementPlan,
  zAppExpenseRetirementVerificationReceipt,
} from "@/contexts/expense/interface/http/response-schemas"
import { PrepareExpenseRetirementCurrentStateAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-retirement-current-state.adapter"
import { RecordCoveragePageRepository } from "@system/infrastructure/repositories/records/record-coverage-page.repository"
import { VerifyExpenseCoveragePage } from "@/contexts/expense/application/verify-expense-coverage-page"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { drizzle } from "drizzle-orm/d1"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { GET as preservedContent } from "@system/interface/routes/system.preserved-records.$recordId.content"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { CaptureExpenseSourceAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-source.adapter"
import { RevalidateExpenseRecordSourceAdapter } from "@/contexts/expense/infrastructure/adapters/revalidate-expense-record-source.adapter"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureFrozenExpenseRecordPageAdapter } from "@/contexts/expense/infrastructure/adapters/capture-frozen-expense-record-page.adapter"
import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import { ListFrozenExpenseRecordPageAdapter } from "@/contexts/expense/infrastructure/adapters/list-frozen-expense-record-page.adapter"
import { expenseRecordKindSchema } from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { ReleaseRecordSourceFreeze } from "@system/application/records/release-record-source-freeze"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { ExpenseAttachmentRecordSourceAdapter } from "@/contexts/expense/infrastructure/adapters/expense-attachment-record-source.adapter"
import { CaptureExpenseAttachmentLinkAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-attachment-link.adapter"
import { CaptureExpenseProcedureBindingAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-procedure-binding.adapter"
import { AttachmentRecordContentValue } from "@system/domain/values/records/attachment-record-content.value"
import { afterAll, beforeAll, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { app } from "@/api/app"
import type { Bindings } from "@/env"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { z } from "zod"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { createSystemIdentityTestKey } from "@system/test/create-system-identity-test-key.test-support"
import { SignJWT } from "jose"
import { CancelExpenseProcedure } from "@/contexts/expense/application/cancel-expense-procedure"
import { RecordExpenseDecision } from "@/contexts/expense/application/record-expense-decision"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(24)
})

afterAll(async () => {
  await pool.dispose()
})

async function fixture(rejectionBehavior: "reject" | "return" = "reject") {
  // System infrastructureのprototypeを差し替えて失敗を注入するため、System公開操作で置き換えられるまで互換DBで検証する。
  const c = await createExpenseProcedureTestContext(await pool.next(), rejectionBehavior)
  const bucket = new SystemAttachmentTestBucket()
  const secret = "expense-attachment-http-test-secret"
  const bindings: Bindings = {
    DB: c.database,
    JWT_SECRET: secret,
    PEPPER_SECRET: "expense-attachment-test-pepper",
    AUDIT_HMAC_SECRET: "expense-attachment-test-audit",
    NOW: c.at.toISOString(),
    COMPANY_TIME_ZONE: "Asia/Tokyo",
    ATTACHMENTS: bucket as unknown as R2Bucket,
    ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
  }
  const request = async (person: typeof c.requester, path: string, body?: FormData) => {
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: person.accountId,
      tokenVersion: 0,
      now: c.at,
    })
    if (token instanceof Error) throw token
    return app.request(
      path,
      {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      },
      bindings,
    )
  }
  const content = "%PDF-1.4\nReceipt evidence\n%%EOF"
  const form = new FormData()
  form.set("file", new File([content], "receipt.pdf", { type: "application/pdf" }))
  const uploaded = await request(c.requester, "/system/attachments", form)
  expect(uploaded.status).toBe(201)
  const { id: attachmentId } = z.object({ id: z.string() }).parse(await uploaded.json())
  const submitted = await c.submit.run({ ...c.command, attachmentIds: [attachmentId] })
  if (submitted instanceof Error) throw submitted
  const path = `/expense/expenses/${submitted.request.id}/attachments/${attachmentId}`
  const auditCount = () =>
    c.database
      .prepare(
        "SELECT count(*) AS total FROM system_audit_events WHERE action = 'expense.attachment.read'",
      )
      .first<number>("total")
  return {
    ...c,
    bindings,
    request,
    bucket,
    attachmentId,
    path,
    content,
    auditCount,
    expenseId: submitted.request.id,
  }
}

test("経費の添付は現在の判断資格で復号し、資格失効・改変・監査失敗では返さない", async () => {
  const c = await fixture()
  const downloaded = await c.request(c.first, c.path)
  expect(downloaded.status).toBe(200)
  expect(downloaded.headers.get("cache-control")).toBe("no-store")
  expect(await downloaded.text()).toBe(c.content)
  expect(await c.auditCount()).toBe(1)
  await c.revokeFirstVoting()
  expect((await c.request(c.first, c.path)).status).toBe(403)
  await execSql(
    c.database,
    "CREATE TRIGGER fail_expense_attachment_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'expense.attachment.read' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  const failedAudit = await c.request(c.requester, c.path)
  expect(failedAudit.status).toBe(500)
  expect(await failedAudit.text()).not.toContain(c.content)
  expect(await c.auditCount()).toBe(1)
  await execSql(c.database, "DROP TRIGGER fail_expense_attachment_audit")
  await c.database
    .prepare("UPDATE system_attachments SET plaintext_sha256 = ?1 WHERE id = ?2")
    .bind("b".repeat(64), c.attachmentId)
    .run()
  const changed = await c.request(c.requester, c.path)
  expect(changed.status).toBe(422)
  expect(await changed.text()).not.toContain(c.content)
  expect(await c.auditCount()).toBe(1)
})

test("復号中に消去された領収書を本人にも返さず、成功監査を残さない", async () => {
  const c = await fixture()
  const get = c.bucket.get.bind(c.bucket)
  const interception = spyOn(c.bucket, "get").mockImplementation(async (key) => {
    const object = await get(key)
    await c.database
      .prepare(
        "UPDATE system_attachments SET status = 'erased', wrapped_dek = NULL, wrapped_dek_iv = NULL WHERE id = ?1",
      )
      .bind(c.attachmentId)
      .run()
    return object
  })
  try {
    const response = await c.request(c.requester, c.path)
    expect(response.status).toBe(422)
    expect(await response.text()).not.toContain(c.content)
  } finally {
    interception.mockRestore()
  }
  expect(await c.auditCount()).toBe(0)
})

test.each(["download", "audit"])("%s 中のAccount失効は内容と成功監査を返さない", async (stage) => {
  const c = await fixture()
  const revoke = () =>
    c.database
      .prepare("UPDATE system_accounts SET token_version=1 WHERE id=?1")
      .bind(c.requester.accountId)
      .run()
  const get = c.bucket.get.bind(c.bucket)
  const append = SystemAuditEventRepository.prototype.append
  const interception =
    stage === "download"
      ? spyOn(c.bucket, "get").mockImplementation(async (key) => {
          const object = await get(key)
          await revoke()
          return object
        })
      : spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(async function (
          this: SystemAuditEventRepository,
          ...args
        ) {
          if (args[0].action === "expense.attachment.read") await revoke()
          return append.apply(this, args)
        })
  try {
    const response = await c.request(c.requester, c.path)
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain(c.content)
  } finally {
    interception.mockRestore()
  }
  expect(await c.auditCount()).toBe(0)
})

test.each(["before-prepare", "download", "audit"])(
  "全件閲覧権限を %s に失っても、古いsessionで領収書を返さない",
  async (stage) => {
    const c = await fixture()
    const reader = c.people[3]
    if (reader === undefined) throw new Error("reader missing")
    await execSql(
      c.database,
      "INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('receipt-reader','receipt:reader','custom','Receipt reader',0,0); INSERT INTO system_iam_role_permissions VALUES ('receipt-reader','expense:read:all');",
    )
    await c.database
      .prepare(
        "INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('receipt-reader',?1,'receipt-reader',0)",
      )
      .bind(reader.accountId)
      .run()
    expect((await c.request(reader, c.path)).status).toBe(200)
    const revoke = () =>
      c.database
        .prepare("DELETE FROM system_iam_role_permissions WHERE role_id='receipt-reader'")
        .run()
    const get = c.bucket.get.bind(c.bucket)
    const append = SystemAuditEventRepository.prototype.append
    const prepare = PrepareSystemReadAuthorizationAdapter.prototype.prepare
    const interception =
      stage === "before-prepare"
        ? spyOn(PrepareSystemReadAuthorizationAdapter.prototype, "prepare").mockImplementation(
            async function (this: PrepareSystemReadAuthorizationAdapter, ...args) {
              await revoke()
              return prepare.apply(this, args)
            },
          )
        : stage === "download"
          ? spyOn(c.bucket, "get").mockImplementation(async (key) => {
              const object = await get(key)
              await revoke()
              return object
            })
          : spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
              async function (this: SystemAuditEventRepository, ...args) {
                if (args[0].action === "expense.attachment.read") await revoke()
                return append.apply(this, args)
              },
            )
    try {
      const response = await c.request(reader, c.path)
      expect(response.status).toBe(403)
      expect(await response.text()).not.toContain(c.content)
    } finally {
      interception.mockRestore()
    }
    expect(await c.auditCount()).toBe(1)
  },
)

test.each(["file_name", "content_type", "object_key", "wrapped_dek", "kek_version"])(
  "監査保存直前の %s の変更で確認した添付を開示しない",
  async (field) => {
    const c = await fixture()
    const append = SystemAuditEventRepository.prototype.append
    const interception = spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
      async function (this: SystemAuditEventRepository, ...args) {
        if (args[0].action === "expense.attachment.read")
          await c.database
            .prepare(`UPDATE system_attachments SET ${field}=?1 WHERE id=?2`)
            .bind(
              field === "kek_version" ? 2 : field === "object_key" ? "att/changed" : "changed",
              c.attachmentId,
            )
            .run()
        return append.apply(this, args)
      },
    )
    try {
      const response = await c.request(c.requester, c.path)
      expect(response.status).toBe(422)
      expect(await response.text()).not.toContain(c.content)
    } finally {
      interception.mockRestore()
    }
    expect(await c.auditCount()).toBe(0)
  },
)

test("監査INSERTの副作用でも失効を検出し、監査と副作用を同時に取り消す", async () => {
  const c = await fixture()
  await execSql(
    c.database,
    "CREATE TRIGGER revoke_reader_with_audit AFTER INSERT ON system_audit_events WHEN NEW.action='expense.attachment.read' BEGIN UPDATE system_accounts SET token_version=token_version+1 WHERE id=NEW.actor_account_id; END",
  )
  const response = await c.request(c.requester, c.path)
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain(c.content)
  expect(await c.auditCount()).toBe(0)
  expect(
    await c.database
      .prepare("SELECT token_version FROM system_accounts WHERE id=?1")
      .bind(c.requester.accountId)
      .first<number>("token_version"),
  ).toBe(0)
  await execSql(c.database, "DROP TRIGGER revoke_reader_with_audit")
  expect((await c.request(c.requester, c.path)).status).toBe(200)
  expect(await c.auditCount()).toBe(1)
})

test("案件の取消と領収書の閲覧が競合した場合、以前の判断資格では返さない", async () => {
  const c = await fixture()
  if (c.expenseId === null) throw new Error("expense missing")
  const expenseId = c.expenseId
  const binding = await c.repository.findProcedure(expenseId)
  if (binding === null || binding instanceof Error)
    throw new Error("binding missing", { cause: binding })
  const append = SystemAuditEventRepository.prototype.append
  const interception = spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
    async function (this: SystemAuditEventRepository, ...args) {
      if (args[0].action === "expense.attachment.read")
        expect(
          await new CancelExpenseProcedure(c.context).run({
            expenseId,
            session: c.session(c.requester),
            tokenVersion: 0,
            decisionTarget: {
              proposalVersion: 1,
              proposalDigest: binding.proposalDigest,
              taskKey: c.step.key,
              taskRound: 1,
            },
            cancelledAt: c.at,
          }),
        ).toMatchObject({ status: "cancelled" })
      return append.apply(this, args)
    },
  )
  try {
    const response = await c.request(c.first, c.path)
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain(c.content)
  } finally {
    interception.mockRestore()
  }
  expect(await c.auditCount()).toBe(0)
  expect((await c.request(c.requester, c.path)).status).toBe(200)
})

test("外部IdPのBearerも確認したidentityを最終監査まで要求する", async () => {
  const c = await fixture()
  const identity = await c.database
    .prepare(
      "SELECT id,subject FROM system_identity_bindings WHERE account_id=?1 AND provider='oidc' AND revoked_at IS NULL",
    )
    .bind(c.requester.accountId)
    .first<{ id: string; subject: string }>()
  if (identity === null) throw new Error("identity missing")
  const key = await createSystemIdentityTestKey("expense-read-key")
  const issuer = "https://identity-provider.example"
  const audience = "https://api.example.com"
  const issuedAt = Math.floor(c.at.getTime() / 1000)
  const token = await new SignJWT({
    email: "reader@example.com",
    email_verified: true,
    name: "Reader",
    client_id: "test-client",
    scope: "openid profile",
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "at+jwt", kid: key.keyId })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(identity.subject)
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 300)
    .sign(key.signingKey)
  const request = () =>
    app.request(
      c.path,
      { headers: { authorization: `Bearer ${token}` } },
      {
        ...c.bindings,
        IDENTITY_ACCESS_TOKEN_ISSUER: issuer,
        IDENTITY_ACCESS_TOKEN_AUDIENCE: audience,
        IDENTITY_JWKS: key.jwks,
      },
    )
  expect((await request()).status).toBe(200)
  const append = SystemAuditEventRepository.prototype.append
  const interception = spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
    async function (this: SystemAuditEventRepository, ...args) {
      if (args[0].action === "expense.attachment.read")
        await c.database
          .prepare("UPDATE system_identity_bindings SET revoked_at=?1 WHERE id=?2")
          .bind(c.at.getTime(), identity.id)
          .run()
      return append.apply(this, args)
    },
  )
  try {
    const response = await request()
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain(c.content)
  } finally {
    interception.mockRestore()
  }
  expect(await c.auditCount()).toBe(1)
})

test("閲覧監査の直前に失った会社資格では領収書を返さず、成功監査を残さない", async () => {
  const c = await fixture()
  const append = SystemAuditEventRepository.prototype.append
  const interception = spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
    async function (this: SystemAuditEventRepository, ...args) {
      if (args[0].action === "expense.attachment.read") await c.revokeFirstVoting()
      return append.apply(this, args)
    },
  )
  try {
    const response = await c.request(c.first, c.path)
    expect(response.status).not.toBe(200)
    expect(await response.text()).not.toContain(c.content)
  } finally {
    interception.mockRestore()
  }
  expect(await c.auditCount()).toBe(0)
})

test("経費の添付保全候補も現在の判断資格と親の添付対応を要求する", async () => {
  const c = await fixture()
  if (c.expenseId === null) throw new Error("経費の作成を確認できません")
  const source = new ExpenseAttachmentRecordSourceAdapter({
    ...c.context,
    env: c.bindings,
    now: () => c.at,
  })
  const input = {
    expenseId: c.expenseId,
    attachmentId: c.attachmentId,
    sourceNamespace: "example-source",
    session: c.session(c.first),
    authentication: {
      accountId: c.first.accountId,
      tokenVersion: 0,
      issuedAtMs: c.at.getTime() - 1000,
      expiresAtMs: c.at.getTime() + 60000,
      identityBindingId: null,
      machineCredentialId: null,
    },
  }
  expect(await source.capture({ ...input, expenseId: c.expenseId + 1000 })).toBeInstanceOf(Error)
  const captured = await source.capture(input)
  if (captured instanceof Error) throw captured
  expect(captured.source.props).toMatchObject({
    ownerContext: "expense",
    recordKind: "expense-attachment",
    recordId: c.attachmentId,
    formatId: "system-attachment-record",
  })
  expect(captured.sourceAuthorizationRef.id).toBe(`${c.expenseId}:${c.attachmentId}`)
  const original = await AttachmentRecordContentValue.restore(captured.content)
  if (original instanceof Error) throw original
  expect(original.metadata.fileName).toBe("receipt.pdf")
  expect(new TextDecoder().decode(original.contentBytes())).toBe(c.content)
  await c.revokeFirstVoting()
  expect(await source.authorize(input)).toBeInstanceOf(Error)
  expect(await source.capture(input)).toBeInstanceOf(Error)
  await execSql(
    c.database,
    "CREATE TABLE expense_attachment_capture_test_receipts (id TEXT PRIMARY KEY)",
  )
  expect(
    await c.database
      .batch([
        c.database.prepare("INSERT INTO expense_attachment_capture_test_receipts VALUES ('stale')"),
        ...captured.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await c.database
      .prepare("SELECT count(*) AS n FROM expense_attachment_capture_test_receipts")
      .first<number>("n"),
  ).toBe(0)
})

test("添付対応の保全は元の全列を残し、対応の変更不能性と資格取消を維持する", async () => {
  const c = await fixture()
  if (c.expenseId === null) throw new Error("経費の作成を確認できません")
  const source = new CaptureExpenseAttachmentLinkAdapter({ ...c.context, now: () => c.at })
  const input = {
    expenseId: c.expenseId,
    attachmentId: c.attachmentId,
    sourceNamespace: "example-source",
    session: c.session(c.first),
    authentication: {
      accountId: c.first.accountId,
      tokenVersion: 0,
      issuedAtMs: c.at.getTime() - 1000,
      expiresAtMs: c.at.getTime() + 60000,
      identityBindingId: null,
      machineCredentialId: null,
    },
  }
  expect(await source.prepare({ ...input, expenseId: c.expenseId + 1000 })).toBeInstanceOf(Error)
  const captured = await source.prepare(input)
  if (captured instanceof Error) throw captured
  const original = await c.database
    .prepare(
      "SELECT expense_id,attachment_id,created_at FROM expense_attachments WHERE expense_id=?1 AND attachment_id=?2",
    )
    .bind(c.expenseId, c.attachmentId)
    .first()
  expect(JSON.parse(new TextDecoder().decode(captured.content))).toEqual({
    format: "expense-attachment-link",
    version: 1,
    record: original,
  })
  expect(captured.source.props).toMatchObject({
    recordKind: "expense-attachment-link",
    recordId: `${c.expenseId}:${c.attachmentId}`,
    sourceRevision: null,
    sourceRecordedAt: null,
  })
  await execSql(c.database, "CREATE TABLE expense_link_capture_receipts (id TEXT PRIMARY KEY)")
  expect(
    await c.database
      .prepare(
        "UPDATE expense_attachments SET created_at=?1 WHERE expense_id=?2 AND attachment_id=?3",
      )
      .bind("2026-01-01T00:00:00.000Z", c.expenseId, c.attachmentId)
      .run()
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  const repeated = await source.prepare(input)
  if (repeated instanceof Error) throw repeated
  expect(repeated.source.props.contentDigest).toBe(captured.source.props.contentDigest)
  await c.revokeFirstVoting()
  expect(await source.prepare(input)).toBeInstanceOf(Error)
  expect(
    await c.database
      .batch([
        c.database.prepare("INSERT INTO expense_link_capture_receipts VALUES ('stale-authority')"),
        ...captured.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await c.database
      .prepare("SELECT count(*) AS n FROM expense_link_capture_receipts")
      .first<number>("n"),
  ).toBe(0)
})

test("再申請で同じ原添付を使っても、元申請と修正版の対応記録を別々に取得する", async () => {
  const c = await fixture("return")
  if (c.expenseId === null) throw new Error("経費の作成を確認できません")
  const binding = await c.repository.findProcedure(c.expenseId)
  if (binding instanceof Error || binding === null) throw new Error("案件が見つかりません")
  const returned = await new RecordExpenseDecision(c.context).run({
    expenseId: c.expenseId,
    session: c.session(c.first),
    tokenVersion: 0,
    decisionTarget: {
      proposalVersion: 1,
      proposalDigest: binding.proposalDigest,
      taskKey: c.step.key,
      taskRound: 1,
    },
    action: "reject",
    comment: "Revise the reason",
    decidedAt: c.at,
  })
  if (returned instanceof Error) throw returned
  const revised = await c.submit.run({
    ...c.command,
    requestKey: crypto.randomUUID(),
    previousExpenseId: c.expenseId,
    attachmentIds: [c.attachmentId],
    note: "Revised reason",
  })
  if (revised instanceof Error) throw revised
  const revisedId = revised.request.id
  if (revisedId === null) throw new Error("再申請を確認できません")
  const source = new CaptureExpenseAttachmentLinkAdapter({ ...c.context, now: () => c.at })
  const input = {
    attachmentId: c.attachmentId,
    sourceNamespace: "example-source",
    session: c.session(c.requester),
    authentication: {
      accountId: c.requester.accountId,
      tokenVersion: 0,
      issuedAtMs: c.at.getTime() - 1000,
      expiresAtMs: c.at.getTime() + 60000,
      identityBindingId: null,
      machineCredentialId: null,
    },
  }
  const original = await source.prepare({ ...input, expenseId: c.expenseId })
  const replacement = await source.prepare({ ...input, expenseId: revisedId })
  if (original instanceof Error) throw original
  if (replacement instanceof Error) throw replacement
  expect(original.source.props.recordId).toBe(`${c.expenseId}:${c.attachmentId}`)
  expect(replacement.source.props.recordId).toBe(`${revisedId}:${c.attachmentId}`)
  expect(replacement.source.props.recordId).not.toBe(original.source.props.recordId)
  expect(replacement.source.props.contentDigest).not.toBe(original.source.props.contentDigest)
  expect(JSON.parse(new TextDecoder().decode(original.content)).record).toMatchObject({
    expense_id: c.expenseId,
    attachment_id: c.attachmentId,
  })
  expect(JSON.parse(new TextDecoder().decode(replacement.content)).record).toMatchObject({
    expense_id: revisedId,
    attachment_id: c.attachmentId,
  })
  const bindings = new CaptureExpenseProcedureBindingAdapter({ ...c.context, now: () => c.at })
  for (const expenseId of [c.expenseId, revisedId]) {
    const captured = await bindings.prepare({ ...input, expenseId })
    if (captured instanceof Error) throw captured
    const originalBinding = await c.database
      .prepare("SELECT * FROM expense_procedure_bindings WHERE expense_id=?1")
      .bind(expenseId)
      .first()
    expect(JSON.parse(new TextDecoder().decode(captured.content))).toEqual({
      format: "expense-procedure-binding",
      version: 1,
      record: originalBinding,
    })
    expect(captured.source.props).toMatchObject({
      recordKind: "expense-procedure-binding",
      recordId: String(expenseId),
      sourceRevision: null,
      sourceRecordedAt: null,
    })
  }
  const revisedBinding = await c.database
    .prepare(
      "SELECT previous_expense_id,attachment_evidence_json FROM expense_procedure_bindings WHERE expense_id=?1",
    )
    .bind(revisedId)
    .first<{ previous_expense_id: number; attachment_evidence_json: string }>()
  expect(revisedBinding?.previous_expense_id).toBe(c.expenseId)
  expect(revisedBinding?.attachment_evidence_json).toContain(c.attachmentId)
  await c.database
    .prepare(`INSERT OR IGNORE INTO system_iam_role_permissions (role_id,permission_key)
    SELECT role_id,'expense:read:all' FROM system_role_bindings WHERE account_id=?1`)
    .bind(c.requester.accountId)
    .run()
  const freezeId = crypto.randomUUID()
  const frozen = await new CreateRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({ env: c.context.env, assertions: [] }),
  }).execute(
    {
      id: freezeId,
      sourceNamespace: input.sourceNamespace,
      ownerContext: "expense",
      actorAccountId: c.requester.accountId,
      reason: "Preserve both submissions",
    },
    c.at,
  )
  expect(frozen).toMatchObject({ kind: "created" })
  const inventory = new ListFrozenExpenseRecordPageAdapter({ ...c.context, now: () => c.at })
  const pageInput = {
    freezeId,
    sourceNamespace: input.sourceNamespace,
    recordKind: "expense-attachment-link",
    afterCursor: null,
    limit: 1,
  }
  const first = await inventory.prepare(pageInput, input)
  if (first instanceof Error) throw first
  expect(first.nextCursor).not.toBeNull()
  const second = await inventory.prepare({ ...pageInput, afterCursor: first.nextCursor }, input)
  if (second instanceof Error) throw second
  expect(second.nextCursor).toBeNull()
  expect([...first.records, ...second.records].map((record) => record.recordId)).toEqual(
    [`${c.expenseId}:${c.attachmentId}`, `${revisedId}:${c.attachmentId}`].sort(),
  )
  const files = await inventory.prepare({ ...pageInput, recordKind: "expense-attachment" }, input)
  if (files instanceof Error) throw files
  expect(files.records).toEqual([
    { recordId: c.attachmentId, expenseId: c.expenseId, attachmentId: c.attachmentId },
  ])
  expect(files.nextCursor).toBeNull()
})

test("停止世代の経費全種別をページ分割し、権限取消・停止解除後の確定を拒否する", async () => {
  const c = await fixture()
  await c.database
    .prepare(`INSERT INTO expense_approvals
    (id,expense_id,approver_id,action,comment,created_at)
    SELECT 901,id,?1,'approve',NULL,created_at FROM expenses WHERE id=?2`)
    .bind(c.first.employeeId, c.expenseId)
    .run()
  await c.database
    .prepare(`INSERT INTO expense_budgets
    (id,organization_unit_id,fiscal_period,period_start,period_end,amount,name,note,created_at)
    SELECT 901,organization_unit_id,'2026','2026-04-01','2027-03-31',100000,'Annual budget',NULL,created_at
    FROM expenses WHERE id=?1`)
    .bind(c.expenseId)
    .run()
  await execSql(
    c.database,
    `INSERT INTO expense_budgets (id,organization_unit_id,fiscal_period,period_start,period_end,amount,name,note,created_at) SELECT 902,organization_unit_id,'2027',period_start,period_end,amount,name,note,created_at
    FROM expense_budgets WHERE id=901`,
  )
  await execSql(
    c.database,
    `INSERT INTO expense_budgets (id,organization_unit_id,fiscal_period,period_start,period_end,amount,name,note,created_at)
    SELECT 10,organization_unit_id,'2028',period_start,period_end,amount,name,note,created_at FROM expense_budgets WHERE id=901`,
  )
  const grant = (permission: string) =>
    c.database
      .prepare(`INSERT OR IGNORE INTO system_iam_role_permissions
    (role_id,permission_key) SELECT role_id,?1 FROM system_role_bindings WHERE account_id=?2`)
      .bind(permission, c.requester.accountId)
      .run()
  await grant("expense:read:all")
  await grant("budget:manage")
  const adapter = new ListFrozenExpenseRecordPageAdapter({ ...c.context, now: () => c.at })
  const capturePage = new CaptureFrozenExpenseRecordPageAdapter({
    ...c.context,
    env: { ...c.context.env, ...c.bindings },
    now: () => c.at,
  })
  const revalidationClock = { now: new Date(c.at.getTime() + 1000) }
  const revalidate = new RevalidateExpenseRecordSourceAdapter({
    ...c.context,
    env: { ...c.context.env, ...c.bindings },
    now: () => revalidationClock.now,
    sourceNamespace: "example-source",
  })
  const reader = {
    session: c.session(c.requester),
    authentication: {
      accountId: c.requester.accountId,
      tokenVersion: 0,
      issuedAtMs: c.at.getTime() - 1000,
      expiresAtMs: c.at.getTime() + 60000,
      identityBindingId: null,
      machineCredentialId: null,
    },
  }
  const repository = openSystemRecordSourceFreezes({ env: c.context.env, assertions: [] })
  const command = {
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "expense",
    actorAccountId: c.requester.accountId,
    reason: "Preserve all expense records",
  }
  const input = {
    freezeId: command.id,
    sourceNamespace: command.sourceNamespace,
    recordKind: "expense-record",
    afterCursor: null,
    limit: 1,
  }
  expect(await adapter.prepare(input, reader)).toBeInstanceOf(Error)
  expect(await new CreateRecordSourceFreeze({ repository }).execute(command, c.at)).toMatchObject({
    kind: "created",
  })
  const expected = {
    "expense-record": [String(c.expenseId)],
    "expense-approval": ["901"],
    "expense-procedure-binding": [String(c.expenseId)],
    "expense-attachment-link": [`${c.expenseId}:${c.attachmentId}`],
    "expense-budget": ["10", "901", "902"],
    "expense-attachment": [c.attachmentId],
  }
  for (const recordKind of expenseRecordKindSchema.options) {
    let afterCursor: string | null = null
    const seen: string[] = []
    do {
      const page = await adapter.prepare({ ...input, recordKind, afterCursor }, reader)
      if (page instanceof Error) throw page
      expect(page.records).toHaveLength(1)
      seen.push(...page.records.map((record) => record.recordId))
      const captured = await capturePage.prepare({ ...input, recordKind, afterCursor }, reader)
      if (captured instanceof Error) throw captured
      expect(captured.records.map((record) => record.source.props.recordId)).toEqual(
        page.records.map((record) => record.recordId),
      )
      expect(captured.contentByteLength).toBe(
        captured.records.reduce((total, record) => total + record.content.byteLength, 0),
      )
      for (const record of captured.records) {
        expect(
          await PreservedRecordContentValue.create(record.source, record.content),
        ).not.toBeInstanceOf(Error)
        const current = await revalidate.prepare(record.source, reader)
        if (current instanceof Error) throw current
        expect(current.source.props).toEqual(record.source.props)
        expect(current.content).toEqual(record.content)
      }
      const captureGuards = captured.assertions(c.at)
      if (captureGuards instanceof Error) throw captureGuards
      await c.database.batch([...captureGuards])
      const guards = page.assertions(c.at)
      if (guards instanceof Error) throw guards
      await c.database.batch([...guards])
      afterCursor = page.nextCursor
    } while (afterCursor !== null)
    expect(seen).toEqual(expected[recordKind])
  }
  const empty = await adapter.prepare(
    { ...input, recordKind: "expense-budget", afterCursor: "902" },
    reader,
  )
  if (empty instanceof Error) throw empty
  expect(empty.records).toEqual([])
  expect(empty.nextCursor).toBeNull()
  expect(
    await capturePage.prepare({ ...input, recordKind: "expense-attachment", limit: 2 }, reader),
  ).toBeInstanceOf(Error)
  expect(await capturePage.prepare({ ...input, limit: 11 }, reader)).toBeInstanceOf(Error)
  const budgetSource = await new CaptureExpenseSourceAdapter({
    ...c.context,
    env: { ...c.context.env, ...c.bindings },
    now: () => c.at,
  }).prepare(
    {
      recordKind: "expense-budget",
      recordId: "901",
      sourceNamespace: "example-source",
    },
    reader,
  )
  if (budgetSource instanceof Error) throw budgetSource
  for (const replacement of [
    { ownerContext: "other-context" },
    { sourceNamespace: "other-source" },
    { recordKind: "unknown-record" },
    { recordId: "0901" },
    { formatId: "other-format" },
    { formatVersion: 2 },
    { sourceRevision: "1" },
    { sourceRecordedAt: c.at.toISOString() },
    { capturedAt: new Date(revalidationClock.now.getTime() + 1000).toISOString() },
    { contentDigest: "0".repeat(64) },
  ]) {
    const changed = PreservedRecordSourceValue.create({
      ...budgetSource.source.props,
      ...replacement,
    })
    if (changed instanceof Error) throw changed
    expect(await revalidate.prepare(changed, reader)).toBeInstanceOf(Error)
  }
  const page = await adapter.prepare(input, reader)
  if (page instanceof Error) throw page
  expect(await adapter.prepare({ ...input, limit: 101 }, reader)).toBeInstanceOf(Error)
  expect(await adapter.prepare({ ...input, recordKind: "unknown" }, reader)).toBeInstanceOf(Error)
  expect(
    await adapter.prepare({ ...input, sourceNamespace: "other-source" }, reader),
  ).toBeInstanceOf(Error)
  expect(await adapter.prepare(input, { ...reader, session: c.session(c.first) })).toBeInstanceOf(
    Error,
  )
  await execSql(
    c.database,
    "DELETE FROM system_iam_role_permissions WHERE permission_key='expense:read:all'",
  )
  expect(await adapter.prepare(input, reader)).toBeInstanceOf(Error)
  const revoked = page.assertions(c.at)
  if (revoked instanceof Error) throw revoked
  expect(await c.database.batch([...revoked]).catch((cause: unknown) => cause)).toBeInstanceOf(
    Error,
  )
  expect(
    await adapter.prepare({ ...input, recordKind: "expense-budget" }, reader),
  ).not.toBeInstanceOf(Error)
  await grant("expense:read:all")
  expect(
    await new ReleaseRecordSourceFreeze({ repository }).execute(
      { ...command, reason: "Resume writes" },
      c.at,
    ),
  ).toMatchObject({ kind: "released" })
  expect(await adapter.prepare(input, reader)).toBeInstanceOf(Error)
  const released = page.assertions(c.at)
  if (released instanceof Error) throw released
  expect(await c.database.batch([...released]).catch((cause: unknown) => cause)).toBeInstanceOf(
    Error,
  )
  await execSql(c.database, "UPDATE expense_budgets SET amount=amount+1 WHERE id=901")
  expect(await revalidate.prepare(budgetSource.source, reader)).toBeInstanceOf(Error)
  const nextId = crypto.randomUUID()
  expect(
    await new CreateRecordSourceFreeze({ repository }).execute({ ...command, id: nextId }, c.at),
  ).toMatchObject({ kind: "created" })
  expect(await adapter.prepare(input, reader)).toBeInstanceOf(Error)
  expect(await adapter.prepare({ ...input, freezeId: nextId }, reader)).not.toBeInstanceOf(Error)
  expect(await c.database.batch([...released]).catch((cause: unknown) => cause)).toBeInstanceOf(
    Error,
  )
})

test.each(["release", "permission", "erasure"])(
  "原添付の取得後に%sが変わると、ページ全体を返さない",
  async (mutation) => {
    const c = await fixture()
    await c.database
      .prepare(`INSERT OR IGNORE INTO system_iam_role_permissions (role_id,permission_key)
    SELECT role_id,'expense:read:all' FROM system_role_bindings WHERE account_id=?1`)
      .bind(c.requester.accountId)
      .run()
    const repository = openSystemRecordSourceFreezes({ env: c.context.env, assertions: [] })
    const command = {
      id: crypto.randomUUID(),
      sourceNamespace: "example-source",
      ownerContext: "expense",
      actorAccountId: c.requester.accountId,
      reason: "Capture original file",
    }
    expect(await new CreateRecordSourceFreeze({ repository }).execute(command, c.at)).toMatchObject(
      { kind: "created" },
    )
    const context = { ...c.context, env: { ...c.context.env, ...c.bindings }, now: () => c.at }
    const original = new ExpenseAttachmentRecordSourceAdapter(context)
    const capture = original.capture.bind(original)
    const interception = spyOn(
      ExpenseAttachmentRecordSourceAdapter.prototype,
      "capture",
    ).mockImplementation(async (input) => {
      const result = await capture(input)
      if (result instanceof Error) throw result
      if (mutation === "release") {
        expect(
          await new ReleaseRecordSourceFreeze({ repository }).execute(
            { ...command, reason: "Resume writes" },
            c.at,
          ),
        ).toMatchObject({ kind: "released" })
      } else if (mutation === "permission") {
        await execSql(
          c.database,
          "DELETE FROM system_iam_role_permissions WHERE permission_key='expense:read:all'",
        )
      } else {
        await c.database
          .prepare(
            "UPDATE system_attachments SET status='erased',wrapped_dek=NULL,wrapped_dek_iv=NULL WHERE id=?1",
          )
          .bind(c.attachmentId)
          .run()
      }
      return result
    })
    try {
      expect(
        await new CaptureFrozenExpenseRecordPageAdapter(context).prepare(
          {
            freezeId: command.id,
            sourceNamespace: command.sourceNamespace,
            recordKind: "expense-attachment",
            afterCursor: null,
            limit: 1,
          },
          {
            session: c.session(c.requester),
            authentication: {
              accountId: c.requester.accountId,
              tokenVersion: 0,
              issuedAtMs: c.at.getTime() - 1000,
              expiresAtMs: c.at.getTime() + 60000,
              identityBindingId: null,
              machineCredentialId: null,
            },
          },
        ),
      ).toBeInstanceOf(Error)
    } finally {
      interception.mockRestore()
    }
  },
)

// 全件保全から撤去後の取得まで実HTTP・DBで検査するため、CIの実行時間を個別に確保する。
test("経費の全6種別を実認証で保全し、業務全テーブル撤去後も元の列と領収書原文を取得できる", async () => {
  const c = await fixture()
  const keyMap = (version: number) =>
    z
      .record(z.string(), z.string())
      .parse(JSON.parse(createSystemAttachmentTestKekEnvironment(version)))
  const verificationKeys = { ...keyMap(1), ...keyMap(2) }
  c.bindings.ATTACHMENT_KEKS = JSON.stringify(verificationKeys)
  const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
  if (assignment === undefined) throw new Error("approval assignment missing")
  const change = CompanyResourceChangeEntity.create({
    commandId: crypto.randomUUID(),
    expectedRevision: await c.companyRevision(),
    actorAccountId: c.requester.accountId,
    reason: "Assign archive reviewer",
    recordedAt: c.at.getTime(),
    resources: [
      {
        ...assignment,
        revision: 2,
        attributes: {
          ...assignment.attributes,
          holderType: "employee",
          holderId: c.first.employeeId,
          authorityScopeId: null,
        },
      },
    ],
  })
  if (change instanceof Error) throw change
  expect((await new D1CompanyResourceRepository({ database: c.database }).write(change)).kind).toBe(
    "applied",
  )
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: {
      version: 1,
      steps: [
        {
          ...c.step,
          governance_authority: {
            organization_id: "organization:default",
            responsibility_code: "APPROVE",
            scope: null,
          },
        },
      ],
    },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "expense-record-archive",
    revision: 1,
    title: "Preserve expense records",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "system.record.preserve",
    createdByAccountId: c.requester.accountId,
    createdAt: c.at,
  })
  if (definition instanceof Error) throw definition
  expect(await openSystemProcedures(c.context).publish(definition, 0)).toBe(true)
  await execSql(
    c.database,
    `INSERT INTO system_iam_role_permissions VALUES
    ('expense-test-role','expense:read:all'),('expense-test-role','budget:manage'),
    ('expense-test-role','system:record:preserve'),('expense-test-role','system:procedure:read'),
    ('expense-test-role','system:record:export'),('expense-test-role','system:record:read')`,
  )
  await c.database
    .prepare(`INSERT INTO expense_approvals (id,expense_id,approver_id,action,comment,created_at)
    SELECT 901,id,?1,'approve',NULL,created_at FROM expenses WHERE id=?2`)
    .bind(c.first.employeeId, c.expenseId)
    .run()
  await c.database
    .prepare(`INSERT INTO expense_budgets
    (id,organization_unit_id,fiscal_period,period_start,period_end,amount,name,note,created_at)
    SELECT 901,organization_unit_id,'2026','2026-04-01','2027-03-31',100000,'Annual budget',NULL,created_at
    FROM expenses WHERE id=?1`)
    .bind(c.expenseId)
    .run()
  const targets = [
    { kind: "expense-record", id: String(c.expenseId), table: "expenses" },
    {
      kind: "expense-procedure-binding",
      id: String(c.expenseId),
      table: "expense_procedure_bindings",
    },
    { kind: "expense-approval", id: "901", table: "expense_approvals" },
    {
      kind: "expense-attachment-link",
      id: `${c.expenseId}:${c.attachmentId}`,
      table: "expense_attachments",
    },
    { kind: "expense-budget", id: "901", table: "expense_budgets" },
    { kind: "expense-attachment", id: c.attachmentId, table: null },
  ]
  const request = async (path: string, accountId = c.requester.accountId, body?: unknown) => {
    const token = await new SystemAccessTokenIssuer(c.bindings.JWT_SECRET).issue({
      accountId,
      tokenVersion: 0,
      now: c.at,
    })
    if (token instanceof Error) throw token
    return app.request(
      path,
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      },
      { ...c.bindings, RECORD_SOURCE_NAMESPACE: "example-source" },
    )
  }
  const archived: Array<{ id: string; sourceRecordId: string; kind: string; original: unknown }> =
    []
  for (const target of targets) {
    const original =
      target.table === null
        ? null
        : await c.database.prepare(`SELECT * FROM ${target.table}`).first()
    const path = `/expense/records/${target.kind}/${target.id}/preservation-requests`
    const submitted = await request(path, c.requester.accountId, {
      procedure_key: definition.key,
      conditions: {
        reason: "Preserve source",
        preservation: { kind: "hold", retainUntil: null, reason: "Retain source" },
        disclosure: {
          reason: "Archive access",
          grants: [
            {
              accountId: c.requester.accountId,
              actions: ["read", "export"],
              purposes: ["archive"],
              validFrom: c.at.toISOString(),
              validUntil: null,
            },
          ],
        },
      },
    })
    if (submitted.status !== 201)
      throw new Error(`${target.kind} submit ${submitted.status}: ${await submitted.text()}`)
    const receipt = z
      .object({ number: z.number(), record_id: z.string() })
      .parse(await submitted.json())
    const proposalPath = `${path}/${receipt.number}`
    const reviewed = await request(proposalPath, c.first.accountId)
    expect(reviewed.status).toBe(200)
    const review = z
      .object({
        decision_target: z.object({
          proposal_version: z.number(),
          proposal_digest: z.string(),
          task_key: z.string(),
          task_round: z.number(),
        }),
      })
      .parse(await reviewed.json())
    const approved = await request(`${proposalPath}/approve`, c.first.accountId, {
      comment: null,
      decision_target: review.decision_target,
    })
    expect(approved.status).toBe(200)
    const executed = await request(`${proposalPath}/execute`, c.requester.accountId, {
      proposal_digest: review.decision_target.proposal_digest,
    })
    if (executed.status !== 200)
      throw new Error(`${target.kind} execute ${executed.status}: ${await executed.text()}`)
    archived.push({ id: receipt.record_id, sourceRecordId: target.id, kind: target.kind, original })
  }
  await execSql(
    c.database,
    "INSERT INTO system_iam_role_permissions VALUES ('expense-test-role','system:admin')",
  )
  const stepUpToken = "f".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  await c.database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at,last_used_at)
    VALUES ('coverage-grant',?1,?2,'external_identity',?3,?4,?3)`)
    .bind(c.requester.accountId, hash, c.at.getTime(), c.at.getTime() + 60000)
    .run()
  const freezeId = crypto.randomUUID()
  const frozen = await new CreateRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({
      env: c.context.env,
      assertions: [c.database.prepare("SELECT 1")],
    }),
  }).execute(
    {
      id: freezeId,
      sourceNamespace: "example-source",
      ownerContext: "expense",
      actorAccountId: c.requester.accountId,
      reason: "Verify archived source",
    },
    c.at,
  )
  if (frozen instanceof Error) throw frozen
  const coverage = new VerifyExpenseCoveragePage({
    env: { ...c.context.env, ...c.bindings },
    var: {
      ...c.context.var,
      now: () => c.at,
      bearerReadAuthentication: {
        accountId: c.requester.accountId,
        tokenVersion: 0,
        issuedAtMs: c.at.getTime() - 1000,
        expiresAtMs: c.at.getTime() + 60000,
        identityBindingId: null,
        machineCredentialId: null,
      },
    },
  })
  for (const record of archived) {
    const command = {
      id: crypto.randomUUID(),
      freezeId,
      sourceNamespace: "example-source",
      recordKind: record.kind,
      purpose: "archive",
      records: [{ sourceRecordId: record.sourceRecordId, preservedRecordId: record.id }],
    }
    expect(await coverage.execute({ ...command, afterCursor: "skip" }, stepUpToken)).toBeInstanceOf(
      Error,
    )
    expect(await coverage.execute({ ...command, records: [] }, stepUpToken)).toBeInstanceOf(Error)
    const permission = record.kind === "expense-budget" ? "budget:manage" : "expense:read:all"
    // oxlint-disable-next-line typescript/unbound-method -- 下の置換メソッドからcall(this)で元の受信先を維持する。
    const append = RecordCoveragePageRepository.prototype.append
    const revoked = spyOn(RecordCoveragePageRepository.prototype, "append").mockImplementationOnce(
      async function (this: RecordCoveragePageRepository, page, audit) {
        await c.database
          .prepare(
            "DELETE FROM system_iam_role_permissions WHERE role_id='expense-test-role' AND permission_key=?1",
          )
          .bind(permission)
          .run()
        return append.call(this, page, audit)
      },
    )
    try {
      expect(await coverage.execute(command, stepUpToken)).toBeInstanceOf(Error)
      expect(revoked).toHaveBeenCalledTimes(1)
      expect(
        await c.database
          .prepare("SELECT count(*) AS n FROM system_record_coverage_pages WHERE id=?1")
          .bind(command.id)
          .first<number>("n"),
      ).toBe(0)
      expect(
        await c.database
          .prepare(
            "SELECT count(*) AS n FROM system_audit_events WHERE target_id=?1 AND action='system.record.coverage.page.verified'",
          )
          .bind(command.id)
          .first<number>("n"),
      ).toBe(0)
    } finally {
      revoked.mockRestore()
      await c.database
        .prepare(
          "INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES ('expense-test-role',?1)",
        )
        .bind(permission)
        .run()
    }
    const page = await coverage.execute(command, stepUpToken)
    if (page instanceof Error) throw page
    expect(page.snapshot.recordKind).toBe(record.kind)
    expect(page.snapshot.records).toHaveLength(1)
    expect(page.snapshot.nextCursor).toBeNull()
    const replay = await coverage.execute(command, stepUpToken)
    if (replay instanceof Error) throw replay
    expect(replay.digest).toBe(page.digest)
    const coverageToken = await new SystemAccessTokenIssuer(c.bindings.JWT_SECRET).issue({
      accountId: c.requester.accountId,
      tokenVersion: 0,
      now: c.at,
    })
    if (coverageToken instanceof Error) throw coverageToken
    const coveragePath = `/expense/record-source-freezes/${freezeId}/coverage-pages`
    const httpRequest = {
      method: "POST",
      headers: {
        authorization: `Bearer ${coverageToken}`,
        "content-type": "application/json",
        "idempotency-key": command.id,
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({
        recordKind: command.recordKind,
        purpose: command.purpose,
        records: command.records,
      }),
    }
    const bindings = { ...c.bindings, RECORD_SOURCE_NAMESPACE: "example-source" }
    const httpReplay = await app.request(coveragePath, httpRequest, bindings)
    expect(httpReplay.status).toBe(200)
    expect(await httpReplay.json()).toMatchObject({
      digest: page.digest,
      recordKind: command.recordKind,
    })
    expect(
      (
        await app.request(coveragePath, httpRequest, {
          ...bindings,
          DISABLED_DEFAULT_APPS: "expenses",
        })
      ).status,
    ).toBe(404)
    expect(
      await coverage.execute({ ...command, id: crypto.randomUUID() }, stepUpToken),
    ).toBeInstanceOf(Error)
    const retirement = new PrepareExpenseRetirementCurrentStateAdapter({
      env: { ...c.context.env, ...c.bindings },
      var: {
        ...c.context.var,
        now: () => c.at,
        bearerReadAuthentication: {
          accountId: c.requester.accountId,
          tokenVersion: 0,
          issuedAtMs: c.at.getTime() - 1000,
          expiresAtMs: c.at.getTime() + 60000,
          identityBindingId: null,
          machineCredentialId: null,
        },
      },
    })
    if (record.kind === "expense-attachment") {
      const planResponse = await app.request(
        `/expense/record-source-freezes/${freezeId}/retirement-plans`,
        {
          ...httpRequest,
          headers: { ...httpRequest.headers, "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify({ purpose: "archive" }),
        },
        bindings,
      )
      expect(planResponse.status).toBe(200)
      const plan = zAppExpenseRetirementPlan.parse(await planResponse.json())
      expect(plan.totalPages).toBe(6)
      const retirementInput = {
        planId: plan.id,
        planDigest: plan.digest,
        sourceNamespace: "example-source",
      }
      expect(await retirement.prepare(retirementInput, stepUpToken)).toBeInstanceOf(Error)
      const verifyPath = `/expense/retirement-plans/${plan.id}/verification-receipts`
      for (const ordinal of [1, 2, 3, 4, 5, 6]) {
        const nextRequest = {
          ...httpRequest,
          headers: { ...httpRequest.headers, "idempotency-key": crypto.randomUUID() },
          body: "{}",
        }
        if (ordinal === 6) {
          for (const missingVersion of [1, 2]) {
            // oxlint-disable-next-line typescript/unbound-method -- 元のadapterをthisとしてcallする。
            const originalKeys = PrepareRecordRetirementPageKeysAdapter.prototype.prepare
            const incompleteKeys = spyOn(
              PrepareRecordRetirementPageKeysAdapter.prototype,
              "prepare",
            ).mockImplementationOnce(
              async function (this: PrepareRecordRetirementPageKeysAdapter, pageId) {
                const prepared = await originalKeys.call(this, pageId)
                if (prepared instanceof Error) return prepared
                return {
                  ...prepared,
                  storageKeys: prepared.storageKeys.filter((key) => key.version !== missingVersion),
                }
              },
            )
            try {
              expect((await app.request(verifyPath, nextRequest, bindings)).status).toBe(503)
            } finally {
              incompleteKeys.mockRestore()
            }
          }
          // oxlint-disable-next-line typescript/unbound-method -- 元のadapterをthisとしてcallする。
          const originalPrepare = PrepareExpenseRetirementPageAdapter.prototype.prepare
          const interrupted = spyOn(
            PrepareExpenseRetirementPageAdapter.prototype,
            "prepare",
          ).mockImplementationOnce(
            async function (this: PrepareExpenseRetirementPageAdapter, input, token) {
              const prepared = await originalPrepare.call(this, input, token)
              if (prepared instanceof Error) return prepared
              return Object.freeze({
                ...prepared,
                assertions: Object.freeze([
                  ...prepared.assertions,
                  c.database
                    .prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM system_record_retirement_attachment_pins)
                THEN json_extract('{}','retirement_pin_commit_interrupted') ELSE 1 END`),
                ]),
              })
            },
          )
          try {
            expect((await app.request(verifyPath, nextRequest, bindings)).status).toBe(503)
          } finally {
            interrupted.mockRestore()
          }
          expect(
            z
              .number()
              .parse(
                await c.database
                  .prepare("SELECT count(*) AS n FROM system_record_retirement_attachment_pins")
                  .first("n"),
              ),
          ).toBe(0)
          expect(
            z
              .number()
              .parse(
                await c.database
                  .prepare(
                    "SELECT count(*) AS n FROM system_record_retirement_receipts WHERE plan_id=?1",
                  )
                  .bind(plan.id)
                  .first("n"),
              ),
          ).toBe(5)
          expect(
            z
              .number()
              .parse(
                await c.database
                  .prepare(
                    "SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.retirement.page.verified'",
                  )
                  .first("n"),
              ),
          ).toBe(5)
        }
        const response = await app.request(verifyPath, nextRequest, bindings)
        expect(response.status).toBe(200)
        const receipt = zAppExpenseRetirementVerificationReceipt.parse(await response.json())
        expect(receipt.ordinal).toBe(ordinal)
        expect(await (await app.request(verifyPath, nextRequest, bindings)).json()).toEqual(receipt)
      }
      expect(
        z
          .number()
          .parse(
            await c.database
              .prepare(
                "SELECT count(*) AS n FROM system_record_retirement_attachment_pins WHERE attachment_id=?1",
              )
              .bind(c.attachmentId)
              .first("n"),
          ),
      ).toBe(1)
      const verifiedRetirement = await retirement.prepare(retirementInput, stepUpToken)
      if (verifiedRetirement instanceof Error) throw verifiedRetirement
      expect(verifiedRetirement.kinds).toHaveLength(6)
      expect(verifiedRetirement.kinds.every((kind) => kind.recordCount === 1)).toBe(true)
      const originalsContext = {
        env: c.context.env,
        assertions: [c.database.prepare("SELECT 1")],
      }
      const originalInput = { planId: plan.id, planDigest: plan.digest }
      const protectedOriginals = await prepareSystemRecordRetirementSourceAttachments(
        originalsContext,
        originalInput,
      )
      if (protectedOriginals instanceof Error) throw protectedOriginals
      const storageKeysContext = {
        env: { ...c.context.env, ATTACHMENT_KEKS: JSON.stringify(verificationKeys) },
        assertions: [c.database.prepare("SELECT 1")],
      }
      expect(
        await prepareSystemRecordRetirementStorageKeys(storageKeysContext, originalInput),
      ).not.toBeInstanceOf(Error)
      const persistedKeys = z.array(z.object({ version: z.number() })).parse(
        JSON.parse(
          z.string().parse(
            await c.database
              .prepare(`SELECT json_extract(receipt.snapshot_json,'$.storageKeys') AS keys
        FROM system_record_retirement_receipts receipt JOIN system_record_retirement_attachment_pins pin ON pin.receipt_id=receipt.id
        WHERE receipt.plan_id=?1`)
              .bind(plan.id)
              .first("keys"),
          ),
        ),
      )
      expect(persistedKeys.map((key) => key.version)).toEqual([1, 2])
      for (const configuredKeys of [
        keyMap(1),
        keyMap(2),
        { ...verificationKeys, "1": keyMap(3)["3"] },
        { ...verificationKeys, "2": keyMap(3)["3"] },
      ]) {
        expect(
          await prepareSystemRecordRetirementStorageKeys(
            {
              env: { ...c.context.env, ATTACHMENT_KEKS: JSON.stringify(configuredKeys) },
              assertions: [c.database.prepare("SELECT 1")],
            },
            originalInput,
          ),
        ).toBeInstanceOf(Error)
      }
      expect(
        await prepareSystemRecordRetirementStorageKeys(
          {
            env: {
              ...c.context.env,
              ATTACHMENT_KEKS: JSON.stringify({ ...verificationKeys, ...keyMap(3) }),
            },
            assertions: [c.database.prepare("SELECT 1")],
          },
          originalInput,
        ),
      ).not.toBeInstanceOf(Error)
      for (const sql of [
        "UPDATE system_attachments SET file_name='changed' WHERE id=?1",
        "UPDATE system_attachments SET status='erased',wrapped_dek=NULL,wrapped_dek_iv=NULL WHERE id=?1",
        "DELETE FROM system_attachments WHERE id=?1",
        "INSERT OR REPLACE INTO system_attachments SELECT * FROM system_attachments WHERE id=?1",
        "INSERT OR REPLACE INTO system_attachments SELECT 'replacement-original',owner_account_id,object_key,status,content_type,byte_size,file_name,plaintext_sha256,wrapped_dek,wrapped_dek_iv,content_iv,kek_version,created_at,linked_at,erased_at FROM system_attachments WHERE id=?1",
      ]) {
        const rejected = await c.database
          .prepare(sql)
          .bind(c.attachmentId)
          .run()
          .catch((cause: unknown) => cause)
        expect(rejected).toBeInstanceOf(Error)
        if (rejected instanceof Error)
          expect(rejected.message).toContain("record_retirement_source_attachment_frozen")
      }
      const unrelatedId = crypto.randomUUID()
      await c.database
        .prepare(`INSERT INTO system_attachments
        SELECT ?1,owner_account_id,?2,status,content_type,byte_size,file_name,plaintext_sha256,
          wrapped_dek,wrapped_dek_iv,content_iv,kek_version,created_at,linked_at,erased_at
        FROM system_attachments WHERE id=?3`)
        .bind(unrelatedId, `att/${unrelatedId}`, c.attachmentId)
        .run()
      const replaced = await c.database
        .prepare(`UPDATE OR REPLACE system_attachments
        SET object_key=(SELECT object_key FROM system_attachments WHERE id=?1) WHERE id=?2`)
        .bind(c.attachmentId, unrelatedId)
        .run()
        .catch((cause: unknown) => cause)
      expect(replaced).toBeInstanceOf(Error)
      if (replaced instanceof Error)
        expect(replaced.message).toContain("record_retirement_source_attachment_frozen")
      expect(
        await c.database
          .prepare(`INSERT INTO system_record_retirement_attachment_pins
        SELECT receipt_id,?1 FROM system_record_retirement_attachment_pins LIMIT 1`)
          .bind(unrelatedId)
          .run()
          .catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
      for (const sql of [
        "DELETE FROM system_record_retirement_attachment_pins",
        "UPDATE system_record_retirement_attachment_pins SET attachment_id='different'",
        "INSERT OR REPLACE INTO system_record_retirement_attachment_pins SELECT * FROM system_record_retirement_attachment_pins",
      ])
        expect(
          await c.database
            .prepare(sql)
            .run()
            .catch((cause: unknown) => cause),
        ).toBeInstanceOf(Error)
      expect(
        await prepareSystemRecordRetirementSourceAttachments(originalsContext, originalInput),
      ).not.toBeInstanceOf(Error)
      expect(
        await new ReleaseRecordSourceFreeze({
          repository: openSystemRecordSourceFreezes({
            env: c.context.env,
            assertions: [c.database.prepare("SELECT 1")],
          }),
        }).execute(
          {
            id: freezeId,
            sourceNamespace: "example-source",
            ownerContext: "expense",
            actorAccountId: c.requester.accountId,
            reason: "Resume source writes",
          },
          new Date(),
        ),
      ).toMatchObject({ kind: "released" })
      expect(
        await prepareSystemRecordRetirementSourceAttachments(originalsContext, originalInput),
      ).toBeInstanceOf(Error)
      expect(
        await c.database.batch([...protectedOriginals.assertions]).catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
      await c.database
        .prepare(
          "UPDATE system_attachments SET status='erased',wrapped_dek=NULL,wrapped_dek_iv=NULL WHERE id=?1",
        )
        .bind(c.attachmentId)
        .run()
      expect(await coverage.execute(command, stepUpToken)).toBeInstanceOf(Error)
      expect(await retirement.prepare(retirementInput, stepUpToken)).toBeInstanceOf(Error)
      expect(
        await c.database.batch([...verifiedRetirement.assertions]).catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
      expect(
        await c.database
          .prepare("SELECT count(*) AS n FROM system_record_coverage_pages WHERE id=?1")
          .bind(command.id)
          .first<number>("n"),
      ).toBe(1)
      expect(
        await c.database
          .prepare(
            "SELECT count(*) AS n FROM system_audit_events WHERE target_id=?1 AND action='system.record.coverage.page.verified'",
          )
          .bind(command.id)
          .first<number>("n"),
      ).toBe(1)
    }
  }
  await execSql(
    c.database,
    `DROP TABLE expense_approvals; DROP TABLE expense_attachments;
    DROP TABLE expense_procedure_bindings; DROP TABLE expense_budgets; DROP TABLE expenses`,
  )
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => c.at)
      context.set("database", drizzle(c.database))
      await next()
    })
    .get("/system/preserved-records/:recordId/content", ...preservedContent)
  const token = await new SystemAccessTokenIssuer(c.bindings.JWT_SECRET).issue({
    accountId: c.requester.accountId,
    tokenVersion: 0,
    now: c.at,
  })
  if (token instanceof Error) throw token
  const headers = { authorization: `Bearer ${token}` }
  expect((await core.request(c.path, { headers }, c.bindings)).status).toBe(404)
  for (const record of archived) {
    const format = record.kind === "expense-attachment" ? "attachment" : "package"
    const response = await core.request(
      `/system/preserved-records/${record.id}/content?action=export&purpose=archive&format=${format}`,
      { headers },
      c.bindings,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    if (record.kind === "expense-attachment") {
      expect(response.headers.get("content-disposition")).toContain("receipt.pdf")
      expect(await response.text()).toBe(c.content)
    } else {
      const body = z.object({ contentBase64: z.string() }).parse(await response.json())
      const content = JSON.parse(Buffer.from(body.contentBase64, "base64").toString("utf8"))
      expect(content.record).toEqual(record.original)
    }
  }
  // ローカルD1は問い合わせごとにworkerdへ往復するため、6種別の保全と取得に手元で10秒ほどかかる。
}, 90_000)
