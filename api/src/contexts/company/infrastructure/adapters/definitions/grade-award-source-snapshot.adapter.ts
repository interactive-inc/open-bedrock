import { CompanyNotFoundError } from "@/contexts/company/domain/errors"
import { GradeAwardSourceSnapshotValue } from "@/contexts/company/domain/values/grade-award-source-snapshot.value"

type Context = D1Database

/** 付与履歴の集合と確認時の定義を一つの読取で固定し、追加・変更・削除を保存前に検査する。 */
export class GradeAwardSourceSnapshotAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(employeeId: string): Promise<GradeAwardSourceSnapshotValue | Error> {
    try {
      const row = await this.c
        .prepare(this.query())
        .bind(employeeId)
        .first<{ snapshot_json: string }>()
      if (row === null)
        return new CompanyNotFoundError("従業員が見つかりません", "employee_not_found")
      return GradeAwardSourceSnapshotValue.create(row.snapshot_json)
    } catch (cause) {
      return new Error("failed to read grade award sources", { cause })
    }
  }

  prepareGuard(snapshot: GradeAwardSourceSnapshotValue): D1PreparedStatement {
    return this.c
      .prepare(`SELECT CASE WHEN (${this.query()}) = ?2 THEN 1 ELSE json_extract('', '$') END`)
      .bind(snapshot.props.value.employeeId, snapshot.props.sourceJson)
  }

  private query(): string {
    return `SELECT json_object(
      'organizationRevision', (SELECT revision FROM company_organizations WHERE id = 'organization:default'),
      'employeeId', ?1,
      'awards', json(coalesce((SELECT json_group_array(json(award_json)) FROM (
        SELECT json_object('id', CASE WHEN award.id BETWEEN -9007199254740991 AND 9007199254740991 THEN award.id ELSE CAST(award.id AS TEXT) END, 'employeeId', award.employee_id,
          'gradeId', CASE WHEN award.grade_id BETWEEN -9007199254740991 AND 9007199254740991 THEN award.grade_id ELSE CAST(award.grade_id AS TEXT) END, 'effectiveDate', award.effective_date,
          'reason', award.reason, 'createdAt', award.created_at,
          'observedDefinition', json((SELECT json_object('id', CASE WHEN definition.id BETWEEN -9007199254740991 AND 9007199254740991 THEN definition.id ELSE CAST(definition.id AS TEXT) END,
            'code', definition.code, 'name', definition.name, 'rank', CASE WHEN definition.rank BETWEEN -9007199254740991 AND 9007199254740991 THEN definition.rank ELSE CAST(definition.rank AS TEXT) END,
            'description', definition.description, 'createdAt', definition.created_at)
            FROM company_grade_definitions definition WHERE definition.id = award.grade_id))) AS award_json
        FROM company_employee_grades award WHERE award.employee_id = ?1
        ORDER BY award.effective_date, award.id LIMIT 1001
      )), '[]'))
    ) AS snapshot_json
    WHERE EXISTS (SELECT 1 FROM company_employees WHERE id = ?1)`
  }
}
