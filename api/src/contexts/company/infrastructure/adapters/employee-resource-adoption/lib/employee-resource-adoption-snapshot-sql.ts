/** 移行の参照と保存直前の照合で、同じ行・列・順序を使用する。 */
export function employeeResourceAdoptionSnapshotSql(): string {
  return `SELECT json_object(
    'organizationRevision', (SELECT revision FROM company_organizations WHERE id = 'organization:default'),
    'employee', json_object('id', employee.id, 'officialName', employee.official_name,
      'employeeCode', employee.employee_code, 'email', employee.email, 'phone', employee.phone,
      'createdAt', employee.created_at, 'updatedAt', employee.updated_at),
    'lifecycleRevision', (SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = employee.id),
    'employments', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('id', id, 'employeeId', employee_id, 'contractName', contract_name,
        'employmentType', employment_type, 'hireDate', hire_date, 'terminationDate', termination_date,
        'status', status, 'createdAt', created_at, 'updatedAt', updated_at) AS row_json
      FROM company_employments WHERE employee_id = employee.id ORDER BY id))),
    'employmentPeriods', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('periodId', period_id, 'revision', revision, 'employeeId', employee_id,
        'startsOn', starts_on, 'endsOn', ends_on, 'isVoid', is_void,
        'recordedByActionId', recorded_by_action_id, 'recordedAt', recorded_at) AS row_json
      FROM company_employment_period_versions WHERE employee_id = employee.id
        OR period_id IN (SELECT id FROM company_employments WHERE employee_id = employee.id) ORDER BY period_id, revision))),
    'statusPeriods', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('periodId', period_id, 'revision', revision, 'employeeId', employee_id,
        'employmentPeriodId', employment_period_id, 'status', status,
        'startsOn', starts_on, 'endsOn', ends_on, 'isVoid', is_void,
        'recordedByActionId', recorded_by_action_id, 'recordedAt', recorded_at) AS row_json
      FROM company_employee_status_period_versions WHERE employee_id = employee.id
        OR employment_period_id IN (SELECT id FROM company_employments WHERE employee_id = employee.id) ORDER BY period_id, revision))),
    'accounts', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('accountId', link.account_id, 'displayName', profile.display_name,
        'createdAt', profile.created_at, 'updatedAt', profile.updated_at) AS row_json
      FROM company_account_employee_links AS link LEFT JOIN company_account_profiles AS profile
        ON profile.account_id = link.account_id AND profile.organization_id = 'organization:default'
      WHERE link.employee_id = employee.id ORDER BY link.account_id))),
    'bindings', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('resourceType', resource_type, 'resourceId', resource_id, 'organizationId', organization_id,
        'resourceRevision', resource_revision, 'lifecycleRevision', lifecycle_revision, 'lastActionId', last_action_id) AS row_json
      FROM company_workforce_resource_bindings WHERE employee_id = employee.id ORDER BY resource_type, resource_id)))
  ) AS snapshot_json FROM company_employees AS employee WHERE employee.id = ?1`
}
