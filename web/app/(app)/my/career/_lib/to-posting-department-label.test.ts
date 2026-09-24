import { describe, expect, test } from "vite-plus/test"
import { toPostingDepartmentLabel } from "@/app/(app)/my/career/_lib/to-posting-department-label"

describe("toPostingDepartmentLabel", () => {
  test("shows the organization unit name when the posting references one", () => {
    expect(
      toPostingDepartmentLabel({
        organization_unit_id: "department:D003",
        organization_unit_name: "開発部",
        legacy_dept_name: "旧部署",
      }),
    ).toBe("開発部")
  })

  test("falls back to the unit id when the name cannot be resolved", () => {
    expect(
      toPostingDepartmentLabel({
        organization_unit_id: "department:D003",
        organization_unit_name: null,
        legacy_dept_name: null,
      }),
    ).toBe("department:D003")
  })

  test("shows the legacy department name for records without a unit", () => {
    expect(
      toPostingDepartmentLabel({
        organization_unit_id: null,
        organization_unit_name: null,
        legacy_dept_name: "開発部",
      }),
    ).toBe("開発部")
  })

  test("shows unset when neither exists", () => {
    expect(
      toPostingDepartmentLabel({
        organization_unit_id: null,
        organization_unit_name: null,
        legacy_dept_name: null,
      }),
    ).toBe("部署未設定")
  })
})
