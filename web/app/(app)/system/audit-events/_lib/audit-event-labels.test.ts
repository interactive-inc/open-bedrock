import { describe, expect, test } from "vite-plus/test"
import { auditActionLabel } from "@/app/(app)/system/audit-events/_lib/audit-action-label"
import { auditClientLabel } from "@/app/(app)/system/audit-events/_lib/audit-client-label"
import { auditOutcomeLabel } from "@/app/(app)/system/audit-events/_lib/audit-outcome-label"
import { auditReasonLabel } from "@/app/(app)/system/audit-events/_lib/audit-reason-label"
import { auditTargetTypeLabel } from "@/app/(app)/system/audit-events/_lib/audit-target-type-label"

describe("audit event labels", () => {
  test("labels managed vocabulary in Japanese", () => {
    expect(auditActionLabel("auth.session.login_succeeded")).toBe("ログイン成功")
    expect(auditActionLabel("employee.account.retired")).toBe("従業員の退職")
    expect(auditActionLabel("audit.event.exported")).toBe("監査ログのCSV出力")
    expect(auditTargetTypeLabel("approval_delegation")).toBe("承認委任")
    expect(auditOutcomeLabel("succeeded")).toBe("成功")
    expect(auditClientLabel("web")).toBe("Web")
    expect(auditReasonLabel("permission_denied")).toBe("権限不足")
  })

  test("preserves unknown custom vocabulary and renders null explicitly", () => {
    expect(auditActionLabel("custom.action")).toBe("custom.action")
    expect(auditTargetTypeLabel("custom_target")).toBe("custom_target")
    expect(auditClientLabel("custom-client")).toBe("custom-client")
    expect(auditReasonLabel("custom_reason")).toBe("custom_reason")
    expect(auditTargetTypeLabel(null)).toBe("—")
    expect(auditReasonLabel(null)).toBe("—")
  })
})
