import { expect, test } from "bun:test"
import { ApplyDefinitionResourceAdoption } from "@/contexts/company/application/definitions/apply-definition-resource-adoption"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { DefinitionResourceAdoptionEntity } from "@/contexts/company/domain/entities/definition-resource-adoption.entity"
import { DefinitionResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/definitions/definition-resource-adoption-snapshot.adapter"
import { DefinitionResourceAdoptionRepository } from "@/contexts/company/infrastructure/repositories/definitions/definition-resource-adoption.repository"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"

async function fixture(type: "grade" | "position" = "grade") {
  const f = await createCompanyAssignmentResourceTestContext()
  const table = type === "grade" ? "company_grade_definitions" : "company_position_definitions"
  await f.database
    .prepare(`INSERT INTO ${table} (id, code, name, rank, description, created_at)
    VALUES (991, 'ADOPTED', 'Current title', 4, NULL, '2020-01-01T00:00:00Z')`)
    .run()
  const snapshots = new DefinitionResourceAdoptionSnapshotAdapter(f.database)
  const snapshot = await snapshots.find(type, 991)
  if (snapshot === null || snapshot instanceof Error) throw new Error("missing source")
  const props = {
    commandId: `adopt:${type}:991`,
    type,
    definitionId: 991,
    resourceId: `definition:${type}:991`,
    expectedRevision: snapshot.props.value.organizationRevision,
    snapshotDigest: snapshot.props.digest,
    observedOn: "2030-06-01",
    reason: "Confirm definition",
    actorAccountId: f.creator.accountId,
    recordedAt: Date.parse("2030-06-01T12:00:00Z"),
  }
  const command = DefinitionResourceAdoptionEntity.create(props)
  if (command instanceof Error) throw command
  return {
    ...f,
    type,
    table,
    snapshot,
    props,
    command,
    repository: new DefinitionResourceAdoptionRepository({
      env: { DB: f.database, COMPANY_TIME_ZONE: "UTC" },
    }),
  }
}

test.each(["grade", "position"] as const)(
  "%sを確認日から公開し、元の証跡と再送結果を保存する",
  async (type) => {
    const f = await fixture(type)
    const adopted = await f.repository.adopt(f.command)
    if (adopted instanceof Error) throw adopted
    expect(adopted).toMatchObject({
      replayed: false,
      organizationRevision: f.props.expectedRevision + 1,
    })
    expect(await f.repository.adopt(f.command)).toMatchObject({
      replayed: true,
      organizationRevision: f.props.expectedRevision + 1,
    })
    const reader = new D1CompanyResourceRepository(f.database)
    const before = await reader.findMany({
      organizationId: "organization:default",
      types: [type],
      effectiveOn: restoreCalendarDate("2030-05-31"),
    })
    const after = await reader.findMany({
      organizationId: "organization:default",
      types: [type],
      effectiveOn: restoreCalendarDate("2030-06-01"),
    })
    if (!before.ok || !after.ok) throw new Error("failed to read adopted definition")
    expect(before.resources).toEqual([])
    expect(after.resources).toHaveLength(1)
    expect(after.resources[0]).toMatchObject({
      id: f.props.resourceId,
      attributes: { officialName: "Current title", rank: 4, description: null },
    })
    expect(
      await f.database
        .prepare(
          "SELECT source_json FROM company_definition_resource_adoptions WHERE command_id = ?1",
        )
        .bind(f.props.commandId)
        .first<string>("source_json"),
    ).toBe(f.snapshot.props.sourceJson)
    expect(
      await f.database
        .prepare(`SELECT created_at FROM ${f.table} WHERE id = 991`)
        .first<string>("created_at"),
    ).toBe("2020-01-01T00:00:00Z")
    for (const sql of [
      `UPDATE ${f.table} SET name = 'Changed' WHERE id = 991`,
      `DELETE FROM ${f.table} WHERE id = 991`,
      `INSERT OR REPLACE INTO ${f.table} (id, code, name, rank, created_at) VALUES (991, 'OTHER', 'Changed', 5, '2030-06-01T00:00:00Z')`,
      "UPDATE company_definition_resource_adoptions SET reason = 'Changed'",
      "DELETE FROM company_definition_resource_adoptions",
    ])
      expect(
        await f.database
          .prepare(sql)
          .run()
          .catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
    await f.database
      .prepare(
        `INSERT INTO ${f.table} (id, code, name, rank, created_at) VALUES (992, 'OTHER', 'Other', 5, '2030-06-01T00:00:00Z')`,
      )
      .run()
    expect(
      await f.database
        .prepare(`UPDATE OR REPLACE ${f.table} SET id = 991 WHERE id = 992`)
        .run()
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    expect((await f.database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  },
)

test("保存途中の失敗は証跡・公開履歴・会社版を全取消し、同じ確認で再試行できる", async () => {
  const f = await fixture()
  await f.database
    .exec(`CREATE TRIGGER reject_definition_adoption BEFORE INSERT ON company_definition_resource_adoptions
    BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`)
  expect(await f.repository.adopt(f.command)).toBeInstanceOf(Error)
  expect(await f.companyRevision()).toBe(f.props.expectedRevision)
  expect(
    await f.database
      .prepare("SELECT count(*) AS total FROM company_resource_heads WHERE resource_id = ?1")
      .bind(f.props.resourceId)
      .first<number>("total"),
  ).toBe(0)
  expect(
    await f.database
      .prepare("SELECT count(*) AS total FROM company_command_receipts WHERE command_id = ?1")
      .bind(f.props.commandId)
      .first<number>("total"),
  ).toBe(0)
  await f.database.exec("DROP TRIGGER reject_definition_adoption")
  expect(await f.repository.adopt(f.command)).toMatchObject({ replayed: false })
})

test("読取後から保存直前までの旧定義変更を検出し、古い確認を保存しない", async () => {
  const f = await fixture()
  const database = new Proxy(f.database, {
    get(target, property, receiver) {
      if (property !== "batch") return Reflect.get(target, property, receiver)
      return async <T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> => {
        await target
          .prepare("UPDATE company_grade_definitions SET name = 'Concurrent change' WHERE id = 991")
          .run()
        return target.batch<T>(statements)
      }
    },
  })
  const repository = new DefinitionResourceAdoptionRepository({
    env: { DB: database, COMPANY_TIME_ZONE: "UTC" },
  })
  expect(await repository.adopt(f.command)).toMatchObject({
    code: "definition_resource_adoption_conflict",
  })
  expect(await f.companyRevision()).toBe(f.props.expectedRevision)
  expect(
    await f.database
      .prepare("SELECT count(*) AS total FROM company_definition_resource_adoptions")
      .first<number>("total"),
  ).toBe(0)
})

test("同じ旧定義への競合は一つだけ確定し、成功済みの依頼の対象変更も拒否する", async () => {
  const f = await fixture()
  const other = DefinitionResourceAdoptionEntity.create({
    ...f.props,
    commandId: "other:adoption",
    resourceId: "other:resource",
  })
  if (other instanceof Error) throw other
  const results = await Promise.all([f.repository.adopt(f.command), f.repository.adopt(other)])
  expect(results.filter((result) => !(result instanceof Error))).toHaveLength(1)
  expect(results.filter((result) => result instanceof Error)).toHaveLength(1)
  expect(await f.companyRevision()).toBe(f.props.expectedRevision + 1)
  const winner = results[0] instanceof Error ? other : f.command
  const changed = DefinitionResourceAdoptionEntity.create({
    ...winner.props,
    resourceId: "changed:resource",
  })
  if (changed instanceof Error) throw changed
  expect(await f.repository.adopt(changed)).toMatchObject({
    code: "definition_resource_adoption_conflict",
  })
})

test("会社範囲と接続権限を成功済みの再送にも適用し、記録者を呼出主体に固定する", async () => {
  const f = await fixture()
  const actor = CompanyActorValue.restore({
    ...f.creator,
    employeeId: null,
    organizationIds: ["organization:default"],
    capabilities: ["company:admin"],
  })
  const application = new ApplyDefinitionResourceAdoption({
    actor,
    repository: f.repository,
    now: new Date(f.props.recordedAt),
  })
  const untrusted = { ...f.props, actorAccountId: "forged:account" }
  expect(await application.execute(untrusted)).toMatchObject({ replayed: false })
  expect(
    await f.database
      .prepare("SELECT actor_account_id FROM company_definition_resource_adoptions")
      .first<string>("actor_account_id"),
  ).toBe(actor.accountId)
  for (const denied of [
    CompanyActorValue.restore({
      accountId: actor.accountId,
      employeeId: null,
      organizationIds: ["other:organization"],
      capabilities: ["company:admin"],
    }),
    CompanyActorValue.restore({
      accountId: actor.accountId,
      employeeId: null,
      organizationIds: ["organization:default"],
      capabilities: ["company:read"],
    }),
  ]) {
    expect(
      await new ApplyDefinitionResourceAdoption({
        actor: denied,
        repository: f.repository,
        now: new Date(f.props.recordedAt),
      }).execute(f.props),
    ).toMatchObject({ code: "forbidden" })
  }
  expect(await f.companyRevision()).toBe(f.props.expectedRevision + 1)
})

test("旧定義テーブルを撤去した後も移行証跡と成功済みの再送結果を保持する", async () => {
  const f = await fixture()
  const adopted = await f.repository.adopt(f.command)
  if (adopted instanceof Error) throw adopted
  await f.database.exec("DROP TABLE company_grade_definitions")
  expect(await f.repository.adopt(f.command)).toMatchObject({
    replayed: true,
    resourceId: f.props.resourceId,
  })
  expect(
    await f.database
      .prepare("SELECT source_json FROM company_definition_resource_adoptions")
      .first<string>("source_json"),
  ).toBe(f.snapshot.props.sourceJson)
  const snapshot = await new D1CompanyResourceRepository(f.database).findMany({
    organizationId: "organization:default",
    types: ["grade"],
    effectiveOn: restoreCalendarDate("2030-06-01"),
  })
  if (!snapshot.ok) throw new Error("failed to read retained definition")
  expect(snapshot.resources[0]?.attributes.officialName).toBe("Current title")
})
