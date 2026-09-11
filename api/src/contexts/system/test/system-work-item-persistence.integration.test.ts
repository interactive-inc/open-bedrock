import { expect, test } from "bun:test"
import { createSystemWorkTestFixture } from "@system/test/create-system-work-test-fixture.test-support"
import { SystemWorkItemEntity } from "@system/domain/entities/system-work-item.entity"
import { SystemWorkItemError } from "@system/domain/errors"

async function fixture() {
  const f = await createSystemWorkTestFixture()
  const owner = await f.authorized("owner", "system:work:create")
  const worker = await f.authorized("worker", "system:work:perform")
  const command = {
    kind: "create",
    id: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    expectedRevision: 0,
    reason: "依頼する",
    title: "資料の確認",
    instructions: "根拠をまとめる",
    acceptanceCriteria: "人が根拠と結論を確認する",
    assigneeAccountId: "worker",
    dueAt: null,
    previousRevisionId: null,
  }
  const recipient = await f.adapter("owner").recipient("worker")
  if (recipient instanceof Error) throw recipient
  const entity = await SystemWorkItemEntity.create({
    command,
    actor: owner.authorization.actor,
    authentication: owner.authorization.authentication,
    now: f.clock.now,
    recipient,
  })
  if (entity instanceof Error) throw entity
  expect(await owner.repository.append(entity, null)).toBeUndefined()
  async function transition(
    previous: SystemWorkItemEntity,
    kind: string,
    account = "worker",
    props: Record<string, unknown> = {},
  ) {
    const current = await f.authorized(
      account,
      kind === "accept" || kind === "submit" ? "system:work:perform" : "system:work:manage",
      kind !== "accept" && kind !== "submit",
    )
    const to =
      kind === "request_handover"
        ? await f.adapter(account).recipient(String(props.toAccountId))
        : undefined
    if (to instanceof Error) throw to
    const next = await previous.transition({
      command: {
        id: command.id,
        commandId: crypto.randomUUID(),
        expectedRevision: previous.snapshot.revision,
        reason: "確認する",
        kind,
        ...props,
      },
      actor: current.authorization.actor,
      authentication: current.authorization.authentication,
      now: f.clock.now,
      recipient: to,
      recovery: current.authorization.isAdmin,
    })
    if (next instanceof Error) throw next
    return { next, repository: current.repository }
  }
  return { ...f, owner, worker, command, entity, transition }
}

test("依頼、受領、成果、人の承認を監査付きで保存し、参加者だけが読む", async () => {
  const f = await fixture()
  const accepted = await f.transition(f.entity, "accept")
  expect(await accepted.repository.append(accepted.next, f.entity)).toBeUndefined()
  const submitted = await f.transition(accepted.next, "submit", "worker", {
    result: { summary: "確認用の成果", evidence: [] },
  })
  expect(await submitted.repository.append(submitted.next, accepted.next)).toBeUndefined()
  const approved = await f.transition(submitted.next, "approve", "owner", {
    resultId: submitted.next.snapshot.result?.id,
    resultDigest: submitted.next.snapshot.result?.digest,
  })
  expect(await approved.repository.append(approved.next, submitted.next)).toBeUndefined()
  const current = await f.owner.repository.findCurrent(f.command.id)
  if (current instanceof Error) throw current
  expect(current?.snapshot.state).toBe("completed")
  expect(await (await f.authorized("other")).repository.findCurrent(f.command.id)).toBeNull()
  expect(await (await f.authorized("other")).repository.findCommand(f.command.commandId)).toBeNull()
  const history = await f.owner.repository.history({ id: f.command.id, after: 0, limit: 100 })
  if (history instanceof Error) throw history
  expect(history.length).toBe(4)
  expect(
    f.sqlite
      .query("SELECT count(*) AS total FROM system_audit_events WHERE target_id=?1")
      .get(f.command.id),
  ).toEqual({ total: 4 })
  f.sqlite.close()
})

test("同じ版への競合、保存途中の失権、監査無視は全変更をrollbackする", async () => {
  const f = await fixture()
  const first = await f.transition(f.entity, "accept")
  const second = await f.transition(f.entity, "accept")
  expect(await first.repository.append(first.next, f.entity)).toBeUndefined()
  expect(await second.repository.append(second.next, f.entity)).toMatchObject({ kind: "conflict" })
  const submitted = await f.transition(first.next, "submit", "worker", {
    result: { summary: "結果", evidence: [] },
  })
  f.sqlite
    .exec(`CREATE TRIGGER revoke_on_work AFTER INSERT ON system_work_item_revisions WHEN NEW.action='submit'
    BEGIN UPDATE system_accounts SET token_version=token_version+1 WHERE id='worker'; END;`)
  expect(await submitted.repository.append(submitted.next, first.next)).toMatchObject({
    kind: "forbidden",
  })
  expect(
    f.sqlite.query("SELECT token_version FROM system_accounts WHERE id='worker'").get(),
  ).toEqual({ token_version: 0 })
  f.sqlite.exec("DROP TRIGGER revoke_on_work")
  f.sqlite.exec(
    "CREATE TRIGGER ignore_work_audit BEFORE INSERT ON system_audit_events BEGIN SELECT RAISE(IGNORE); END;",
  )
  expect(await submitted.repository.append(submitted.next, first.next)).toBeInstanceOf(
    SystemWorkItemError,
  )
  expect(f.sqlite.query("SELECT count(*) AS total FROM system_work_item_revisions").get()).toEqual({
    total: 2,
  })
  expect(
    f.sqlite
      .query("SELECT count(*) AS total FROM system_audit_events WHERE target_id=?1")
      .get(f.command.id),
  ).toEqual({ total: 2 })
  f.sqlite.close()
})

test("受領で責任者と閲覧資格が切り替わり、管理者も人の受領を省略できない", async () => {
  const f = await fixture()
  const requested = await f.transition(f.entity, "request_handover", "admin", {
    toAccountId: "recipient",
  })
  expect(await requested.repository.append(requested.next, f.entity)).toBeUndefined()
  expect(String(requested.next.snapshot.accountable.accountId)).toBe("owner")
  expect(requested.next.snapshot.recovery).toBe(true)
  const accepted = await f.transition(requested.next, "accept_handover", "recipient", {
    handoverId: requested.next.snapshot.handover?.id,
  })
  expect(await accepted.repository.append(accepted.next, requested.next)).toBeUndefined()
  expect(await f.owner.repository.findCurrent(f.command.id)).toBeNull()
  const current = await (await f.authorized("recipient")).repository.findCurrent(f.command.id)
  if (current instanceof Error) throw current
  expect(String(current?.snapshot.accountable.accountId)).toBe("recipient")
  f.sqlite.close()
})

test("証拠のclaimと添付linkが成果と同時に保存され、部分成功を許さない", async () => {
  const f = await fixture()
  const accepted = await f.transition(f.entity, "accept")
  expect(await accepted.repository.append(accepted.next, f.entity)).toBeUndefined()
  f.sqlite
    .query(`INSERT INTO system_attachments (id,owner_account_id,object_key,status,content_type,byte_size,file_name,plaintext_sha256,
    wrapped_dek,wrapped_dek_iv,content_iv,kek_version,created_at)
    VALUES ('evidence','worker','att/evidence','pending','text/plain',5,'evidence.txt',?1,'wrapped','iv','iv',1,100)`)
    .run("b".repeat(64))
  const submitted = await f.transition(accepted.next, "submit", "worker", {
    result: {
      summary: "添付を参照",
      evidence: [{ attachmentId: "evidence", sha256: "b".repeat(64) }],
    },
  })
  f.sqlite.exec(
    "CREATE TRIGGER ignore_evidence BEFORE INSERT ON system_work_evidence BEGIN SELECT RAISE(IGNORE); END;",
  )
  expect(await submitted.repository.append(submitted.next, accepted.next)).toMatchObject({
    kind: "invalid",
  })
  expect(f.sqlite.query("SELECT status FROM system_attachments").get()).toEqual({
    status: "pending",
  })
  f.sqlite.exec("DROP TRIGGER ignore_evidence")
  expect(await submitted.repository.append(submitted.next, accepted.next)).toBeUndefined()
  expect(f.sqlite.query("SELECT status FROM system_attachments").get()).toEqual({
    status: "linked",
  })
  expect(f.sqlite.query("SELECT work_item_id FROM system_work_evidence").get()).toEqual({
    work_item_id: f.command.id,
  })
  expect(() => f.sqlite.exec("DELETE FROM system_work_evidence")).toThrow("immutable")
  expect(() => f.sqlite.exec("UPDATE system_work_item_revisions SET state='completed'")).toThrow(
    "immutable",
  )
  expect(() => f.sqlite.exec("DELETE FROM system_work_items")).toThrow("immutable")
  f.sqlite.close()
})

test("現在のpermission、credential、step-upを失った主体を拒否する", async () => {
  const f = await fixture()
  f.sqlite.exec(
    "DELETE FROM system_iam_role_permissions WHERE role_id='role:worker' AND permission_key='system:work:perform'",
  )
  expect(
    await f.adapter("worker").prepare({ permission: "system:work:perform", stepUpToken: null }),
  ).toMatchObject({ kind: "forbidden" })
  expect(
    await f.adapter("owner").prepare({ permission: "system:work:review", stepUpToken: "invalid" }),
  ).toMatchObject({ kind: "forbidden" })
  f.sqlite
    .query(
      "UPDATE system_machine_credentials SET status='revoked',revoked_at=?1,updated_at=?1 WHERE id='credential:worker'",
    )
    .run(f.clock.now.getTime())
  expect(await f.worker.repository.findCurrent(f.command.id)).toMatchObject({ kind: "forbidden" })
  f.sqlite.close()
})

test("domainを迂回する直接SQLでも不正な遷移、主体の差替え、欠落した状態を拒否する", async () => {
  const f = await fixture()
  const accepted = await f.transition(f.entity, "accept")
  const value = accepted.next.snapshot
  const corruptions = [
    { ...value, state: "completed", action: "approve" },
    {
      ...value,
      assignee: { accountId: "other", principalId: "principal:other", kind: "human" },
      actor: { accountId: "other", principalId: "principal:other", kind: "human" },
      authentication: { tokenVersion: 0, credentialId: null, stepUpGrantId: null },
    },
    { ...value, revision: 3 },
    { ...value, recordedAt: new Date(Date.parse(value.createdAt) - 1).toISOString() },
    { ...value, result: undefined },
    { ...value, recovery: true },
    {
      ...value,
      authentication: { tokenVersion: 1, credentialId: "credential:worker", stepUpGrantId: null },
    },
  ]
  for (const corrupted of corruptions) {
    const snapshot = JSON.stringify(corrupted)
    const transaction = f.db.batch([
      f.db
        .prepare(`INSERT INTO system_audit_events (event_id,actor_account_id,action,target_type,target_id,outcome,
        authorization_json,before_json,after_json,occurred_at)
        SELECT json_extract(?1,'$.auditEventId'),json_extract(?1,'$.actor.accountId'),'system.work.'||json_extract(?1,'$.action'),
          'system:work-item',json_extract(?1,'$.id'),'succeeded',
          json_object('principal_id',json_extract(?1,'$.actor.principalId'),'principal_kind',json_extract(?1,'$.actor.kind'),
            'token_version',json_extract(?1,'$.authentication.tokenVersion'),'credential_id',json_extract(?1,'$.authentication.credentialId'),
            'step_up_grant_id',json_extract(?1,'$.authentication.stepUpGrantId'),'recovery',json_extract(?1,'$.recovery')),
          ?2,?1,?3`)
        .bind(snapshot, JSON.stringify(f.entity.snapshot), Date.parse(corrupted.recordedAt)),
      f.db
        .prepare(`INSERT INTO system_work_item_revisions (work_item_id,revision,command_id,action,state,actor_account_id,actor_principal_id,
        accountable_account_id,accountable_principal_id,assignee_account_id,assignee_principal_id,recorded_at,snapshot_json,audit_event_id)
        SELECT json_extract(?1,'$.id'),json_extract(?1,'$.revision'),json_extract(?1,'$.commandId'),json_extract(?1,'$.action'),json_extract(?1,'$.state'),
          json_extract(?1,'$.actor.accountId'),json_extract(?1,'$.actor.principalId'),json_extract(?1,'$.accountable.accountId'),json_extract(?1,'$.accountable.principalId'),
          json_extract(?1,'$.assignee.accountId'),json_extract(?1,'$.assignee.principalId'),?2,?1,json_extract(?1,'$.auditEventId')`)
        .bind(snapshot, Date.parse(corrupted.recordedAt)),
    ])
    await expect(transaction).rejects.toThrow("work_item_")
  }
  expect(f.sqlite.query("SELECT count(*) AS total FROM system_work_item_revisions").get()).toEqual({
    total: 1,
  })
  expect(f.sqlite.query("SELECT count(*) AS total FROM system_audit_events").get()).toEqual({
    total: 1,
  })
  f.sqlite.close()
})

test("外部Identityで準備した作業認可は保存直前のIdentity失効と差替えを拒否する", async () => {
  const f = await createSystemWorkTestFixture()
  f.sqlite
    .query(`INSERT INTO system_identity_bindings
    (id,account_id,provider,subject,created_at,activated_at,revoked_at)
    VALUES ('identity:owner','owner','oidc','external-owner',0,0,NULL)`)
    .run()
  const adapter = f.adapter("owner", "identity:owner")
  const authorization = await adapter.prepare({
    permission: "system:work:create",
    stepUpToken: null,
  })
  if (authorization instanceof Error) throw authorization
  const assertions = authorization.assertions()
  if (assertions instanceof Error) throw assertions
  await f.db.batch([...assertions])
  expect(() =>
    f.sqlite
      .query(
        "UPDATE system_identity_bindings SET subject='replacement-owner' WHERE id='identity:owner'",
      )
      .run(),
  ).toThrow("identity binding identity is immutable")
  f.sqlite
    .query("UPDATE system_identity_bindings SET revoked_at=?1 WHERE id='identity:owner'")
    .run(f.clock.now.getTime())
  await expect(f.db.batch([...assertions])).rejects.toThrow()
  expect(
    await adapter.prepare({ permission: "system:work:create", stepUpToken: null }),
  ).toBeInstanceOf(SystemWorkItemError)
})
