import { expect, test } from "bun:test"
import { COMPANY_PERMISSION_KEYS } from "@/contexts/company/domain/iam/company-permission-key.catalog"

test("Company権限は停止できない会社基盤だけを所有する", () => {
  expect(COMPANY_PERMISSION_KEYS).toEqual([
    "dashboard:view",
    "employee:read",
    "employee:create",
    "employee:update",
    "employee:delete",
    "employee:assign_role",
    "employee:lifecycle:request",
    "employee:lifecycle:apply",
    "employee:lifecycle:read:all",
    "employee:archive",
    "org:manage",
    "application:approve",
    "application:read:all",
    "application:read:department",
    "application_template:manage",
    "onboarding:manage",
    "onboarding:view:all",
    "certificate_request:read:all",
    "certificate_request:manage",
    "resignation:manage",
    "grade:manage",
    "grade:read:all",
    "position:manage",
    "grade:read:reports",
    "employee_event:manage",
    "employee_event:read:all",
    "resignation:read:all",
    "announcement:manage",
    "regulation:manage",
    "document:manage",
    "document:read:all",
    "decision:manage",
    "export:run",
    "governance:read",
    "governance:read:restricted",
    "governance:manage",
    "governance:review",
    "governance:publish",
    "governance:acknowledge",
  ])

  expect(new Set(COMPANY_PERMISSION_KEYS).size).toBe(COMPANY_PERMISSION_KEYS.length)
})
