import { describe, expect, test } from "bun:test"
import { seedDepartments } from "@/contexts/company/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedOrgDepartments } from "@/contexts/company/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/contexts/company/infrastructure/seed/seed-org-memberships"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "governance-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )
  await seedD1(
    db,
    "departments",
    seedDepartments.map((department) => ({ id: department.id, name: department.name })),
  )
  await seedD1(
    db,
    "org_departments",
    seedOrgDepartments.map((department) => ({
      code: department.code,
      department_id: department.departmentId,
      parent_code: department.parentCode,
      manager_employee_code: department.managerEmployeeCode,
      sort_order: department.order,
    })),
  )
  await seedD1(
    db,
    "org_memberships",
    seedOrgMemberships.map((membership) => ({
      department_code: membership.departmentCode,
      employee_code: membership.employeeCode,
      manager_employee_code: membership.managerEmployeeCode,
    })),
  )
  await seedIamForEmployees(db)
  return db
}

function token(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, { employeeId })
}

function markdown(options?: { version?: string; title?: string; publication?: string }) {
  return `---
id: policy.information-security
title: ${options?.title ?? "情報セキュリティ規程"}
kind: policy
version: ${options?.version ?? "1.0.0"}
classification: internal
owner_capability: information-security
steward_org_role: ciso
effective_from: 2026-02-01
review_due_on: 2027-01-31
publication:
${options?.publication ?? "  mode: direct"}
acknowledgement:
  required: true
  renew_on_change: true
audience:
  all_employees: true
controls:
  - key: annual-training
    owner_org_role: ciso
    trigger: schedule
    cadence: P1Y
    evidence: 研修受講記録
---
# 情報セキュリティ規程

責任者は [[org-role:ciso]] とする。`
}

async function request(props: {
  db: D1Database
  path: string
  employeeId: number
  method?: string
  body?: unknown
}) {
  return requestWithContext({
    db: props.db,
    jwtSecret,
    path: props.path,
    token: await token(props.employeeId),
    method: props.method,
    body: props.body,
  })
}

describe("governance documents", () => {
  test("syncs a draft, publishes it, exposes it to members, and records acknowledgement", async () => {
    const db = await createTestDb()
    const sync = await request({
      db,
      path: "/governance-documents/sync",
      employeeId: 1,
      method: "POST",
      body: {
        documents: [
          { source_path: ".docs/governance/information-security.md", markdown: markdown() },
        ],
      },
    })
    expect(sync.status).toBe(200)
    const syncBody = z
      .object({ data: z.array(z.object({ code: z.string(), outcome: z.string() })) })
      .parse(await sync.json())
    expect(syncBody.data[0]).toMatchObject({
      code: "policy.information-security",
      outcome: "created",
    })

    const memberDraftList = await request({
      db,
      path: "/governance-documents",
      employeeId: 5,
    })
    expect(memberDraftList.status).toBe(200)
    expect((await memberDraftList.json()) as { total: number }).toMatchObject({ total: 0 })

    const publish = await request({
      db,
      path: "/governance-documents/policy.information-security/versions/1.0.0/publish",
      employeeId: 1,
      method: "POST",
    })
    expect(publish.status).toBe(200)

    const memberDetail = await request({
      db,
      path: "/governance-documents/policy.information-security",
      employeeId: 5,
    })
    expect(memberDetail.status).toBe(200)
    const detail = z
      .object({ code: z.string(), version_state: z.string(), acknowledged: z.boolean() })
      .parse(await memberDetail.json())
    expect(detail).toMatchObject({
      code: "policy.information-security",
      version_state: "published",
      acknowledged: false,
    })

    const acknowledge = await request({
      db,
      path: "/governance-documents/policy.information-security/acknowledge",
      employeeId: 5,
      method: "POST",
    })
    expect(acknowledge.status).toBe(200)
    const acknowledgedDetail = await request({
      db,
      path: "/governance-documents/policy.information-security",
      employeeId: 5,
    })
    expect((await acknowledgedDetail.json()) as { acknowledged: boolean }).toMatchObject({
      acknowledged: true,
    })
    const audits = await db
      .prepare("SELECT action FROM audit_events WHERE action LIKE 'governance.%' ORDER BY id")
      .all<{ action: string }>()
    expect(audits.results.map((row) => row.action)).toEqual([
      "governance.document.synced",
      "governance.document.published",
      "governance.document.acknowledged",
    ])
  })

  test("keeps published versions immutable", async () => {
    const db = await createTestDb()
    await request({
      db,
      path: "/governance-documents/sync",
      employeeId: 1,
      method: "POST",
      body: {
        documents: [{ source_path: ".docs/governance/security.md", markdown: markdown() }],
      },
    })
    await request({
      db,
      path: "/governance-documents/policy.information-security/versions/1.0.0/publish",
      employeeId: 1,
      method: "POST",
    })
    const changed = await request({
      db,
      path: "/governance-documents/sync",
      employeeId: 1,
      method: "POST",
      body: {
        documents: [
          {
            source_path: ".docs/governance/security.md",
            markdown: markdown({ title: "変更後の規程" }),
          },
        ],
      },
    })
    expect(changed.status).toBe(409)
    expect((await changed.json()) as { code: string }).toMatchObject({
      code: "governance_published_immutable",
    })
  })

  test("prevents overlapping role assignments and preserves revoked history", async () => {
    const db = await createTestDb()
    const first = await request({
      db,
      path: "/governance-org-roles/ciso/assignments",
      employeeId: 1,
      method: "POST",
      body: { employee_code: "E001", starts_on: "2026-01-01" },
    })
    expect(first.status).toBe(201)
    const assignment = z.object({ id: z.number() }).parse(await first.json())

    const overlapping = await request({
      db,
      path: "/governance-org-roles/ciso/assignments",
      employeeId: 1,
      method: "POST",
      body: { employee_code: "E002", starts_on: "2026-02-01" },
    })
    expect(overlapping.status).toBe(409)

    const revoked = await request({
      db,
      path: `/governance-org-roles/assignments/${assignment.id}`,
      employeeId: 1,
      method: "DELETE",
    })
    expect(revoked.status).toBe(204)
    const stored = await db
      .prepare(
        "SELECT revoked_by_account_id, revoked_at FROM governance_org_role_assignments WHERE id = ?1",
      )
      .bind(assignment.id)
      .first<{ revoked_by_account_id: number; revoked_at: string }>()
    expect(stored?.revoked_by_account_id).toBe(1)
    expect(stored?.revoked_at).toBeString()

    const replacement = await request({
      db,
      path: "/governance-org-roles/ciso/assignments",
      employeeId: 1,
      method: "POST",
      body: { employee_code: "E002", starts_on: "2026-02-01" },
    })
    expect(replacement.status).toBe(201)
  })

  test("requires both system permission and current organization role for review", async () => {
    const db = await createTestDb()
    await db
      .prepare(
        `INSERT INTO governance_org_role_assignments
          (org_role_code, employee_id, starts_on, ends_on, created_by_account_id, created_at)
         VALUES ('board', 1, '2025-01-01', NULL, 1, '2025-01-01T00:00:00.000Z')`,
      )
      .run()
    await db
      .prepare(
        `INSERT INTO governance_org_role_assignments
          (org_role_code, employee_id, starts_on, ends_on, created_by_account_id, created_at)
         VALUES ('ciso', 2, '2025-01-01', NULL, 1, '2025-01-01T00:00:00.000Z')`,
      )
      .run()
    const approval = `  mode: approval
  approver_org_roles:
    - board
    - ciso`
    await request({
      db,
      path: "/governance-documents/sync",
      employeeId: 1,
      method: "POST",
      body: {
        documents: [
          {
            source_path: ".docs/governance/security.md",
            markdown: markdown({ publication: approval }),
          },
        ],
      },
    })
    const submit = await request({
      db,
      path: "/governance-documents/policy.information-security/versions/1.0.0/submit-review",
      employeeId: 1,
      method: "POST",
    })
    expect(submit.status).toBe(200)

    const candidateDetail = await request({
      db,
      path: "/governance-documents/policy.information-security",
      employeeId: 1,
    })
    expect(candidateDetail.status).toBe(200)
    const detailBody = z
      .object({
        approvals: z.array(z.object({ org_role_code: z.string(), can_decide: z.boolean() })),
      })
      .parse(await candidateDetail.json())
    expect(detailBody.approvals).toEqual([
      expect.objectContaining({ org_role_code: "board", can_decide: true }),
      expect.objectContaining({ org_role_code: "ciso", can_decide: false }),
    ])

    const nonCandidate = await request({
      db,
      path: "/governance-documents/policy.information-security/versions/1.0.0/review",
      employeeId: 2,
      method: "POST",
      body: { org_role_code: "board", decision: "approved" },
    })
    expect(nonCandidate.status).toBe(403)

    const candidate = await request({
      db,
      path: "/governance-documents/policy.information-security/versions/1.0.0/review",
      employeeId: 1,
      method: "POST",
      body: { org_role_code: "board", decision: "approved" },
    })
    expect(candidate.status).toBe(200)
    const cisoCandidate = await request({
      db,
      path: "/governance-documents/policy.information-security/versions/1.0.0/review",
      employeeId: 2,
      method: "POST",
      body: { org_role_code: "ciso", decision: "approved" },
    })
    expect(cisoCandidate.status).toBe(200)
    const publish = await request({
      db,
      path: "/governance-documents/policy.information-security/versions/1.0.0/publish",
      employeeId: 1,
      method: "POST",
    })
    expect(publish.status).toBe(200)
  })

  test("impact analysis reports unresolved current role assignments", async () => {
    const db = await createTestDb()
    await request({
      db,
      path: "/governance-documents/sync",
      employeeId: 1,
      method: "POST",
      body: {
        documents: [{ source_path: ".docs/governance/security.md", markdown: markdown() }],
      },
    })
    const impact = await request({ db, path: "/governance-documents/impact", employeeId: 1 })
    expect(impact.status).toBe(200)
    const body = z
      .object({
        summary: z.object({ errors: z.number(), warnings: z.number() }),
        issues: z.array(z.object({ code: z.string(), reference: z.string().nullable() })),
      })
      .parse(await impact.json())
    expect(body.issues).toContainEqual(
      expect.objectContaining({ code: "role_unassigned", reference: "org_role:ciso" }),
    )
  })
})
