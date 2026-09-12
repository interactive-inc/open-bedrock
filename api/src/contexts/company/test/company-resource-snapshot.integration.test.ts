import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

const schema =
  readFileSync(
    new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8")
const organizationId = "organization:default"

async function fixture() {
  const repository = new D1CompanyResourceRepository(createCompanyD1TestDatabase(schema))
  const revisions = [
    { date: "2026-01-01", name: "Original", state: "active" },
    { date: "2026-07-01", name: "Future", state: "active" },
    { date: "2026-01-01", name: "Corrected", state: "active" },
    { date: "2026-09-01", name: "Withdrawn", state: "void" },
  ] as const
  for (const [index, revision] of revisions.entries()) {
    const command = CompanyResourceChangeEntity.create({
      commandId: `snapshot:${index}`,
      expectedRevision: index,
      actorAccountId: "account:operator",
      reason: "Confirmed definition",
      recordedAt: index + 1,
      resources: [
        {
          organizationId,
          type: "grade",
          id: "grade:one",
          revision: index + 1,
          state: revision.state,
          effectiveFrom: restoreCalendarDate(revision.date),
          effectiveTo: null,
          attributes: {
            code: index === 1 || index === 3 ? "RENAMED" : "GRADE",
            officialName: revision.name,
          },
        },
      ],
    })
    if (command instanceof Error) throw command
    expect(await repository.write(command)).toMatchObject({ kind: "applied" })
  }
  return repository
}

test("同じ会社版と有効日で再読込しても将来改名・遡及訂正・取消が混ざらない", async () => {
  const repository = await fixture()
  for (const [revision, day, name] of [
    [1, "2026-08-01", "Original"],
    [2, "2026-06-01", "Original"],
    [2, "2026-08-01", "Future"],
    [3, "2026-06-01", "Corrected"],
    [3, "2026-08-01", "Future"],
    [3, "2026-10-01", "Future"],
    [4, "2026-10-01", null],
    [0, "2026-08-01", null],
  ] as const) {
    const snapshot = await repository.findMany({
      organizationId,
      organizationRevision: revision,
      types: ["grade"],
      effectiveOn: restoreCalendarDate(day),
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(snapshot.organizationRevision).toBe(revision)
    expect(
      snapshot.resources.map((resource) => resource.toProps().attributes.officialName),
    ).toEqual(name === null ? [] : [name])
  }
})

test("日付未指定でも指定会社版のheadを返し、不明な版を最新版へ置換しない", async () => {
  const repository = await fixture()
  const snapshot = await repository.findMany({
    organizationId,
    organizationRevision: 2,
    types: ["grade"],
  })
  if (!snapshot.ok) throw snapshot.cause
  expect(snapshot.organizationRevision).toBe(2)
  expect(snapshot.resources.map((resource) => resource.toProps().attributes.officialName)).toEqual([
    "Future",
  ])
  for (const revision of [-1, 0.5, 5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    expect(
      await repository.findMany({
        organizationId,
        organizationRevision: revision,
        types: ["grade"],
      }),
    ).toMatchObject({ ok: false })
  }
  expect(
    await repository.findMany({
      organizationId: "missing",
      organizationRevision: 0,
      types: ["grade"],
    }),
  ).toMatchObject({ ok: false })
})

test("コードは会社版・有効日の資源を選んだ後で照合し、改名した旧版を復活させない", async () => {
  const repository = await fixture()
  for (const [revision, day, code, expected] of [
    [1, "2026-08-01", "GRADE", "Original"],
    [2, "2026-08-01", "GRADE", null],
    [2, "2026-06-01", "GRADE", "Original"],
    [2, "2026-08-01", "RENAMED", "Future"],
    [3, "2026-08-01", "GRADE", null],
    [3, "2026-06-01", "GRADE", "Corrected"],
    [4, "2026-10-01", "RENAMED", null],
  ] as const) {
    const snapshot = await repository.findMany({
      organizationId,
      organizationRevision: revision,
      effectiveOn: restoreCalendarDate(day),
      types: ["grade"],
      codes: [code],
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(
      snapshot.resources.map((resource) => resource.toProps().attributes.officialName),
    ).toEqual(expected === null ? [] : [expected])
  }
  for (const query of [
    { organizationRevision: 2 },
    { effectiveOn: restoreCalendarDate("2026-08-01") },
    {},
  ]) {
    const snapshot = await repository.findMany({
      organizationId,
      types: ["grade"],
      codes: ["GRADE"],
      ...query,
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(snapshot.resources).toEqual([])
  }
  const quoted = await repository.findMany({
    organizationId,
    types: ["grade"],
    codes: ["GRADE' OR 1=1 --"],
    organizationRevision: 1,
  })
  expect(quoted).toMatchObject({ ok: true, resources: [] })
  const overLimit = await repository.findMany({
    organizationId,
    types: ["grade"],
    codes: Array.from({ length: 101 }, () => "GRADE"),
  })
  expect(overLimit).toMatchObject({ ok: false })
})
