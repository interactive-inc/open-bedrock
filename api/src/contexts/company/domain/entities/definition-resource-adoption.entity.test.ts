import { expect, test } from "bun:test"
import { DefinitionResourceAdoptionEntity } from "@/contexts/company/domain/entities/definition-resource-adoption.entity"
import { DefinitionResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/definition-resource-adoption-snapshot.value"

async function fixture(type: "grade" | "position" = "grade") {
  const source = {
    organizationRevision: 7,
    definition: {
      type,
      id: 3,
      code: "SENIOR",
      name: "Current title",
      rank: 4,
      description: "Current description",
      createdAt: "2020-01-01T00:00:00Z",
    },
  }
  const sourceJson = JSON.stringify(source, null, 2)
  const snapshot = await DefinitionResourceAdoptionSnapshotValue.create(sourceJson)
  if (snapshot instanceof Error) throw snapshot
  const props = {
    commandId: "definition:adopt:3",
    type,
    definitionId: 3,
    resourceId: "definition:3",
    expectedRevision: 7,
    snapshotDigest: snapshot.props.digest,
    observedOn: "2030-06-01",
    reason: "Confirm current definition",
    actorAccountId: "account:reviewer",
    recordedAt: Date.parse("2030-06-01T12:00:00Z"),
  }
  const command = DefinitionResourceAdoptionEntity.create(props)
  if (command instanceof Error) throw command
  return { source, sourceJson, snapshot, props, command }
}

test.each(["grade", "position"] as const)(
  "%sの現在名を旧作成日へ遡及せず、元の記録と確認者を保つ",
  async (type) => {
    const f = await fixture(type)
    const change = f.command.toChange(f.snapshot)
    if (change instanceof Error) throw change
    expect(f.snapshot.props.sourceJson).toBe(f.sourceJson)
    expect(f.snapshot.props.value.definition.createdAt).toBe("2020-01-01T00:00:00Z")
    expect(change.actorAccountId).toBe("account:reviewer")
    expect(change.recordedAt).toBe(f.props.recordedAt)
    expect(change.resources).toHaveLength(1)
    expect(change.resources[0]).toMatchObject({
      type,
      revision: 1,
      effectiveFrom: "2030-06-01",
      effectiveTo: null,
      attributes: {
        code: "SENIOR",
        officialName: "Current title",
        rank: 4,
        description: "Current description",
      },
    })
    if (type === "position") expect(change.resources[0]?.attributes.jobId).toBeNull()
  },
)

test("確認後の旧台帳・会社版・対象IDの変化を同じ確認として受け入れない", async () => {
  const f = await fixture()
  for (const source of [
    { ...f.source, organizationRevision: 8 },
    { ...f.source, definition: { ...f.source.definition, name: "Revised title" } },
    { ...f.source, definition: { ...f.source.definition, description: null } },
    { ...f.source, definition: { ...f.source.definition, rank: 5 } },
    { ...f.source, definition: { ...f.source.definition, id: 4 } },
    { ...f.source, definition: { ...f.source.definition, type: "position" } },
  ]) {
    const snapshot = await DefinitionResourceAdoptionSnapshotValue.create(JSON.stringify(source))
    if (snapshot instanceof Error) throw snapshot
    expect(f.command.toChange(snapshot)).toMatchObject({
      code: "definition_resource_adoption_conflict",
    })
  }
})

test("移行証跡の未定義項目や欠落を黙って捨てず、不正な確認日も拒否する", async () => {
  const f = await fixture()
  for (const source of [
    { ...f.source, definition: { ...f.source.definition, previousName: "Lost name" } },
    { ...f.source, definition: { ...f.source.definition, rank: undefined } },
    { ...f.source, definition: { ...f.source.definition, createdAt: "unknown" } },
  ])
    expect(
      await DefinitionResourceAdoptionSnapshotValue.create(JSON.stringify(source)),
    ).toBeInstanceOf(Error)
  expect(
    DefinitionResourceAdoptionEntity.create({ ...f.props, observedOn: "2030-02-30" }),
  ).toMatchObject({ code: "invalid_definition_adoption" })
})
