import type { CareerPosting } from "@/lib/api/types/career-types"

/**
 * 公募の募集部署の表示名。参照する組織単位の名前を優先し、
 * 組織単位を持たない旧記録は手入力されていた部署名、どちらも無ければ未設定と表示する。
 */
export function toPostingDepartmentLabel(
  posting: Pick<
    CareerPosting,
    "organization_unit_id" | "organization_unit_name" | "legacy_dept_name"
  >,
): string {
  if (posting.organization_unit_id !== null) {
    return posting.organization_unit_name ?? posting.organization_unit_id
  }

  return posting.legacy_dept_name ?? "部署未設定"
}
