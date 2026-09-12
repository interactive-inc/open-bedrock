import { DefinitionResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/definition-resource-adoption-snapshot.value"

/** 旧定義と会社版を一度に読み、保存直前にも同じ記録であることを検査する。 */
export class DefinitionResourceAdoptionSnapshotAdapter {
  constructor(private readonly database: D1Database) {
    Object.freeze(this)
  }

  async find(
    type: "grade" | "position",
    id: number,
  ): Promise<DefinitionResourceAdoptionSnapshotValue | null | Error> {
    try {
      const row = await this.database
        .prepare(this.query(type))
        .bind(id, type)
        .first<{ snapshot_json: string }>()
      if (row === null) return null
      return DefinitionResourceAdoptionSnapshotValue.create(row.snapshot_json)
    } catch (cause) {
      return new Error("failed to read definition adoption snapshot", { cause })
    }
  }

  prepareGuard(snapshot: DefinitionResourceAdoptionSnapshotValue): D1PreparedStatement {
    const definition = snapshot.props.value.definition
    return this.database
      .prepare(
        `SELECT CASE WHEN coalesce((${this.query(definition.type)}), '') = ?3
          THEN 1 ELSE json_extract('', '$') END`,
      )
      .bind(definition.id, definition.type, snapshot.props.sourceJson)
  }

  private query(type: "grade" | "position"): string {
    const table = type === "grade" ? "company_grade_definitions" : "company_position_definitions"
    return `SELECT json_object(
      'organizationRevision', (SELECT revision FROM company_organizations WHERE id = 'organization:default'),
      'definition', json_object('type', ?2, 'id', definition.id, 'code', definition.code,
        'name', definition.name, 'rank', definition.rank, 'description', definition.description,
        'createdAt', definition.created_at)
    ) AS snapshot_json FROM ${table} AS definition WHERE definition.id = ?1`
  }
}
