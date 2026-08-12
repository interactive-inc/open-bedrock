import { filterLiveWorkflowAccounts } from "@/lib/application/filter-live-workflow-accounts"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { describe, expect, test } from "bun:test"

describe("filterLiveWorkflowAccounts", () => {
  test("uses lifecycle state after verification and still requires an active account", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES
        (1, 'E001', 'Lifecycle Active', 'retired'),
        (2, 'E002', 'Lifecycle Future', 'active'),
        (3, 'E003', 'Inactive Account', 'active');
      INSERT INTO accounts (id, status, created_at, updated_at) VALUES
        (11, 'active', 0, 0), (12, 'active', 0, 0),
        (13, 'locked', 0, 0);
      INSERT INTO account_employee_links (account_id, employee_id) VALUES
        (11, 1), (12, 2), (13, 3);
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at) VALUES
        ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-2', 1, 2, '2027-01-01', NULL, 0, 'fixture', 1),
        ('employment-3', 1, 3, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
        ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-2', 1, 'employment-2', 2, 'active', '2027-01-01', NULL, 0, 'fixture', 1),
        ('status-3', 1, 'employment-3', 3, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
    `)

    expect(
      await filterLiveWorkflowAccounts(context, [
        { employeeId: 1, accountId: 11 },
        { employeeId: 2, accountId: 12 },
        { employeeId: 3, accountId: 13 },
      ]),
    ).toEqual([{ employeeId: 1, accountId: 11 }])
  })
})
