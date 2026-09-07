import { AssignmentResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/assignment-resource-adoption-snapshot.value"
type Context = D1Database

/** 移行の確認と保存直前の検査に同じ所属履歴のSQLを使う。 */
export class AssignmentResourceAdoptionSnapshotAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(employeeId: string): Promise<AssignmentResourceAdoptionSnapshotValue | null | Error> {
    try {
      const row = await this.c
        .prepare(this.query())
        .bind(employeeId)
        .first<{ snapshot_json: string }>()
      return row === null ? null : AssignmentResourceAdoptionSnapshotValue.create(row.snapshot_json)
    } catch (cause) {
      return new Error("failed to read assignment adoption snapshot", { cause })
    }
  }

  prepareGuard(snapshot: AssignmentResourceAdoptionSnapshotValue): D1PreparedStatement {
    return this.c
      .prepare(
        `SELECT CASE WHEN coalesce((${this.query()}), '') = ?2 THEN 1 ELSE json_extract('', '$') END`,
      )
      .bind(snapshot.props.value.employeeId, snapshot.props.sourceJson)
  }

  private query(): string {
    return `SELECT json_object(
      'employeeId', employee.id,
      'organizationRevision', (SELECT revision FROM company_organizations WHERE id = 'organization:default'),
      'lifecycleRevision', (SELECT revision FROM company_organization_lifecycle_states WHERE id = 1),
      'pendingOperations', (SELECT count(*) FROM company_organization_change_operations WHERE status = 'PENDING'),
      'employeeOrganizationId', (SELECT organization_id FROM company_workforce_resource_bindings WHERE resource_type = 'employee' AND resource_id = employee.id),
      'periods', json((SELECT json_group_array(json(period_json)) FROM (
        SELECT json_object('periodId', period.period_id, 'revision', period.revision,
          'employeeId', period.employee_id, 'employmentId', period.employment_id,
          'organizationUnitId', period.organization_unit_id, 'assignmentType', period.assignment_type,
          'positionTitle', period.position_title, 'managerEmployeeId', period.manager_employee_id,
          'startsOn', period.starts_on, 'endsOn', period.ends_on, 'isVoid', period.is_void,
          'recordedByActionId', period.recorded_by_action_id, 'recordedAt', period.recorded_at,
          'actorAccountId', operation.actor_account_id, 'reason', operation.reason,
          'evidenceReferencesJson', operation.evidence_references_json,
          'requestFingerprint', operation.request_fingerprint, 'operationStatus', operation.status,
          'resourceId', binding.resource_id, 'periodRevision', binding.period_revision) AS period_json
        FROM company_organization_assignment_period_versions period
        LEFT JOIN company_organization_change_operations operation ON operation.id = period.recorded_by_action_id
        LEFT JOIN company_assignment_period_bindings binding ON binding.period_id = period.period_id
        WHERE period.employee_id = employee.id ORDER BY period.period_id, period.revision
      )))
    ) AS snapshot_json FROM company_employees employee WHERE employee.id = ?1`
  }
}
