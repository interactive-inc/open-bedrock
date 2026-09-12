import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import { expect, test, spyOn } from "bun:test"
import { readFileSync } from "node:fs"
import { drizzle } from "drizzle-orm/d1"
import { createSystemWorkTestFixture } from "@system/test/create-system-work-test-fixture.test-support"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { SystemHTTPException } from "@system/interface/errors"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"
import { GET } from "@system/interface/routes/system.proposals.$number.versions.$version"

async function fixture() {
  const f = await createSystemWorkTestFixture()
  for (const name of [
    "system-workflow",
    "system-decision-policy",
    "system-procedure",
    "system-procedure-delegation",
  ])
    f.sqlite.exec(
      readFileSync(new URL(`../infrastructure/schema/${name}.sql`, import.meta.url), "utf8"),
    )
  f.sqlite.exec(`
    INSERT INTO system_procedure_definitions(key,current_revision,status,created_at,updated_at) VALUES ('change',1,'active',100,100);
    INSERT INTO system_procedure_definition_revisions(procedure_key,revision,title,category,input_schema_json,decision_policy_json,created_by_account_id,created_at)
      VALUES ('change',1,'Change','operation','{}','{}','owner',100);
    INSERT INTO system_procedure_numbers(procedure_key) VALUES ('change');
    INSERT INTO system_iam_role_permissions VALUES ('role:owner','system:procedure:read'),('role:other','system:procedure:read'),
      ('role:recipient','system:procedure:read'),('role:recipient','system:procedure:read:all');
  `)
  const start = new StartSystemProcedure({
    writer: new SystemD1WorkflowAdapter({ env: { DB: f.db } }),
  })
  const firstTask = {
    key: "review",
    requiredApprovals: 1,
    openedAt: f.clock.now,
    dueAt: null,
    candidates: [
      {
        accountId: zAccountId.parse("recipient"),
        source: "primary" as const,
        evidenceContext: "authority",
        evidenceKind: "qualification",
        evidenceId: "qualification:1",
        evidenceVersion: "1",
        eligibilityDigest: proposalDigestSchema.parse("a".repeat(64)),
        eligibleFrom: null,
        resolvedAt: f.clock.now,
      },
    ],
    excludedAccountIds: [],
  }
  const first = await start.run({
    seriesId: "history-series",
    version: 1,
    procedureKey: "change",
    procedureRevision: 1,
    body: { original: "retained" },
    createdByAccountId: zAccountId.parse("owner"),
    supersedesProposalId: null,
    createdAt: f.clock.now,
    firstTask,
  })
  if (first instanceof Error) throw first
  const second = await start.run({
    seriesId: first.proposal.seriesId,
    version: 2,
    procedureKey: "change",
    procedureRevision: 1,
    body: { revised: "retained" },
    createdByAccountId: zAccountId.parse("owner"),
    supersedesProposalId: first.proposal.id,
    createdAt: new Date(f.clock.now.getTime() + 1),
    firstTask: { ...firstTask, openedAt: new Date(f.clock.now.getTime() + 1) },
  })
  if (second instanceof Error) throw second
  f.clock.now = new Date(f.clock.now.getTime() + 2)
  const secret = "proposal-history-test-secret"
  const app = systemFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => f.clock.now)
      c.set("database", drizzle(f.db))
      await next()
    })
    .onError((error, c) =>
      error instanceof SystemHTTPException
        ? c.json({ error: error.code }, error.status)
        : c.json({ error: "internal", message: error.message }, 500),
    )
    .get("/system/proposals/:number/versions/:version", ...GET)
  const headers = new Map<string, Record<string, string>>()
  for (const account of ["owner", "other", "recipient", "admin"]) {
    const token = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
      { accountId: account, tokenVersion: 0 },
      secret,
      new Date(f.claims(account).issuedAtMs),
    )
    if (token instanceof Error) throw token
    headers.set(account, { authorization: `Bearer ${token}` })
  }
  const request = (account: string, version = 1) =>
    app.request(
      `/system/proposals/${first.number}/versions/${version}`,
      { headers: headers.get(account) },
      { DB: f.db, JWT_SECRET: secret },
    )
  return { ...f, first, second, request }
}

test("Company・業務コードなしで取消済み原版と再提出版を読み、退職相当の停止主体も履歴に残す", async () => {
  const f = await fixture()
  const original = await f.request("owner")
  expect(original.status).toBe(200)
  expect(await original.json()).toMatchObject({
    version: 1,
    body_json: '{"original":"retained"}',
    digest: f.first.proposal.digest,
    supersedes_proposal_id: null,
    case: { status: "cancelled" },
  })
  const revised = await f.request("owner", 2)
  expect(revised.status).toBe(200)
  expect(await revised.json()).toMatchObject({
    version: 2,
    supersedes_proposal_id: f.first.proposal.id,
  })
  expect((await f.request("owner", 3)).status).toBe(404)
  expect((await f.request("owner", 0)).status).toBe(400)
  f.sqlite.exec(
    "UPDATE system_accounts SET status='suspended', token_version=token_version+1, updated_at=updated_at+1 WHERE id='owner'",
  )
  expect((await f.request("recipient")).status).toBe(200)
})

test("手続きの現行版を変更しても提案時の定義原文を返す", async () => {
  const f = await fixture()
  f.sqlite.exec(`
    INSERT INTO system_procedure_definition_revisions
      (procedure_key,revision,title,category,input_schema_json,decision_policy_json,created_by_account_id,created_at)
      VALUES ('change',2,'Changed definition','revised','{"type":"object"}','{"revised":true}','owner',101);
    UPDATE system_procedure_definitions SET current_revision=2,updated_at=101 WHERE key='change';
  `)
  const response = await f.request("owner")
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    procedure_key: "change",
    procedure_revision: 1,
    procedure_definition: {
      key: "change",
      revision: 1,
      title: "Change",
      category: "operation",
      description: null,
      input_schema_json: "{}",
      decision_policy_json: "{}",
      completion_operation_key: null,
    },
  })
})

test("関係のない主体と管理者だけの権限を拒否し、関係による拒否を監査する", async () => {
  const f = await fixture()
  expect((await f.request("other")).status).toBe(403)
  expect((await f.request("admin")).status).toBe(403)
  expect((await f.request("anonymous")).status).toBe(401)
  expect(
    f.sqlite
      .query(
        "SELECT outcome,reason_code FROM system_audit_events WHERE action='system.proposal.history.read'",
      )
      .all(),
  ).toEqual([{ outcome: "denied", reason_code: "not_participant" }])
})

test("参照中の権限取消は本文の開示と成功監査を拒否する", async () => {
  const f = await fixture()
  const original = SystemD1ProposalAdapter.prototype.listTasks.bind(
    new SystemD1ProposalAdapter({ env: { DB: f.db } }),
  )
  const spy = spyOn(SystemD1ProposalAdapter.prototype, "listTasks").mockImplementationOnce(
    async (caseId) => {
      const tasks = await original(caseId)
      f.sqlite.exec("UPDATE system_role_bindings SET revoked_at=1000 WHERE id='binding:owner'")
      return tasks
    },
  )
  try {
    expect((await f.request("owner")).status).toBe(503)
  } finally {
    spy.mockRestore()
  }
  expect(
    f.sqlite
      .query(
        "SELECT count(*) AS count FROM system_audit_events WHERE action='system.proposal.history.read'",
      )
      .get(),
  ).toEqual({ count: 0 })
})

test("開示監査の保存失敗では本文を返さない", async () => {
  const f = await fixture()
  f.sqlite.exec(
    "CREATE TRIGGER fail_disclosure BEFORE INSERT ON system_audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END",
  )
  expect((await f.request("owner")).status).toBe(503)
  f.sqlite.exec("DROP TRIGGER fail_disclosure")
  expect((await f.request("owner")).status).toBe(200)
})

test("保存済み本文とdigestが一致しない場合は履歴を開示しない", async () => {
  const f = await fixture()
  f.sqlite.exec("DROP TRIGGER system_proposals_prevent_update")
  f.sqlite
    .query("UPDATE system_proposals SET body_json=?1 WHERE id=?2")
    .run('{"original":"corrupt"}', f.first.proposal.id)
  expect((await f.request("owner")).status).toBe(503)
  expect(
    f.sqlite
      .query(
        "SELECT count(*) AS count FROM system_audit_events WHERE action='system.proposal.history.read'",
      )
      .get(),
  ).toEqual({ count: 0 })
})

test("参照中の案件変更は開示を拒否し、再試行で新しい状態を読む", async () => {
  const f = await fixture()
  const original = SystemD1ProposalAdapter.prototype.listTasks.bind(
    new SystemD1ProposalAdapter({ env: { DB: f.db } }),
  )
  const spy = spyOn(SystemD1ProposalAdapter.prototype, "listTasks").mockImplementationOnce(
    async (caseId) => {
      const tasks = await original(caseId)
      expect(
        await new CancelSystemProcedure(new SystemD1WorkflowAdapter({ env: { DB: f.db } })).run({
          number: f.second.number,
          createdByAccountId: zAccountId.parse("owner"),
          cancelledAt: f.clock.now,
        }),
      ).toBe(true)
      return tasks
    },
  )
  try {
    const response = await f.request("owner", 2)
    expect({ status: response.status, body: await response.json() }).toMatchObject({ status: 503 })
  } finally {
    spy.mockRestore()
  }
  expect((await f.request("owner", 2)).status).toBe(200)
})
