import { expect, spyOn, test } from "bun:test"
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

async function fixture() {
  const c = await createExpenseProcedureTestContext()
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
  await c.database.exec(
    "CREATE TRIGGER fail_expense_attachment_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'expense.attachment.read' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  const failedAudit = await c.request(c.requester, c.path)
  expect(failedAudit.status).toBe(500)
  expect(await failedAudit.text()).not.toContain(c.content)
  expect(await c.auditCount()).toBe(1)
  await c.database.exec("DROP TRIGGER fail_expense_attachment_audit")
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
  const repository = new SystemAuditEventRepository(c.context)
  const append = repository.append.bind(repository)
  const interception =
    stage === "download"
      ? spyOn(c.bucket, "get").mockImplementation(async (key) => {
          const object = await get(key)
          await revoke()
          return object
        })
      : spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
          async (...args) => {
            if (args[0].action === "expense.attachment.read") await revoke()
            return append(...args)
          },
        )
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
    await c.database.exec(
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
    const repository = new SystemAuditEventRepository(c.context)
    const append = repository.append.bind(repository)
    const authorization = new PrepareSystemReadAuthorizationAdapter(c.context)
    const prepare = authorization.prepare.bind(authorization)
    const interception =
      stage === "before-prepare"
        ? spyOn(PrepareSystemReadAuthorizationAdapter.prototype, "prepare").mockImplementation(
            async (...args) => {
              await revoke()
              return prepare(...args)
            },
          )
        : stage === "download"
          ? spyOn(c.bucket, "get").mockImplementation(async (key) => {
              const object = await get(key)
              await revoke()
              return object
            })
          : spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
              async (...args) => {
                if (args[0].action === "expense.attachment.read") await revoke()
                return append(...args)
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
    const repository = new SystemAuditEventRepository(c.context)
    const append = repository.append.bind(repository)
    const interception = spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
      async (...args) => {
        if (args[0].action === "expense.attachment.read")
          await c.database
            .prepare(`UPDATE system_attachments SET ${field}=?1 WHERE id=?2`)
            .bind(
              field === "kek_version" ? 2 : field === "object_key" ? "att/changed" : "changed",
              c.attachmentId,
            )
            .run()
        return append(...args)
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
  await c.database.exec(
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
  await c.database.exec("DROP TRIGGER revoke_reader_with_audit")
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
  const repository = new SystemAuditEventRepository(c.context)
  const append = repository.append.bind(repository)
  const interception = spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
    async (...args) => {
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
      return append(...args)
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
  const repository = new SystemAuditEventRepository(c.context)
  const append = repository.append.bind(repository)
  const interception = spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
    async (...args) => {
      if (args[0].action === "expense.attachment.read")
        await c.database
          .prepare("UPDATE system_identity_bindings SET revoked_at=?1 WHERE id=?2")
          .bind(c.at.getTime(), identity.id)
          .run()
      return append(...args)
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
  const repository = new SystemAuditEventRepository(c.context)
  const append = repository.append.bind(repository)
  const interception = spyOn(SystemAuditEventRepository.prototype, "append").mockImplementation(
    async (...args) => {
      if (args[0].action === "expense.attachment.read") await c.revokeFirstVoting()
      return append(...args)
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
