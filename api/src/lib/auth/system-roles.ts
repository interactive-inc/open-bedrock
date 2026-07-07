import type { PermissionKey } from "@/lib/auth/permission-keys"

// 既存の role 4値(member/manager/hr/admin)を permission 集合として厳密再現する。
// 移行で権限が広がらないことをテストで担保するための基準。backfill の role_permissions シードに使う。
// 実態: 大半の can-* は ["manager","hr","admin"]、employee:delete/org:manage/thanks_* は ["hr","admin"]。

// manager が持つ permission(can-* が manager を許可するもの)。
const MANAGER_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  "dashboard:view",
  "employee:read",
  "employee:create",
  "employee:update",
  "application:approve",
  "application_template:manage",
  "expense:approve",
  "leave:approve",
  "notification:send",
  "oneonone:create",
  "review:administer",
  "career_posting:manage",
  "room:manage",
  "asset:manage",
  "training:manage",
  "shift:manage",
  "shift_swap:approve",
  "survey:manage",
  "antisocial_check:manage",
  "batch:view",
  "onboarding:manage",
  "onboarding:view:all",
  // スコープ権限: manager は全社(:all)ではなくレポートライン配下(:reports)のみ。
  // 移行前の「manager の権限が全社に効く」挙動を 0011 で意図的に狭めた。
  "goal:read:reports",
  "goal:evaluate:reports",
  "attendance:read:reports",
  "leave:read:reports",
  "grade:read:reports",
]

// hr が manager に加えて持つ permission(can-* が ["hr","admin"] のもの)。
const HR_EXTRA_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  "org:manage",
  "employee:delete",
  "thanks_reward:manage",
  "thanks_redemption:approve",
  "application:read:all",
  "expense:read:all",
  "leave:read:all",
  "thanks_redemption:read:all",
  "shift_swap:read:all",
  "certificate_request:read:all",
  "resignation:read:all",
  "life_event:read:all",
  "family_care_leave:read:all",
  "business_trip:read:all",
  "rental:read:all",
  // manager から :all を外したため、hr の全社スコープはここで明示的に持つ。
  "goal:read:all",
  "goal:evaluate",
  "attendance:read:all",
  // 労務手続きの代理処理と、人事データベース(等級・異動履歴)の管理。
  "certificate_request:manage",
  "resignation:manage",
  "life_event:manage",
  "family_care_leave:manage",
  "business_trip:manage",
  "rental:manage",
  "grade:manage",
  "grade:read:all",
  "employee_event:manage",
  "employee_event:read:all",
]

// admin が hr に加えて持つ permission(IAM・アカウント管理・ロール割当)。
const ADMIN_EXTRA_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  "employee:assign_role",
  "iam:manage_roles",
  "iam:assign_roles",
  "account:manage",
  "audit_log:read",
  // どのプリセットにも実務付与しない department スコープも、escalation guard
  // （付与するロールの権限 ⊆ 付与者の権限）を通すため admin は保持する。
  "goal:read:department",
  "attendance:read:department",
  "leave:read:department",
]

const HR_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  ...MANAGER_PERMISSIONS,
  ...HR_EXTRA_PERMISSIONS,
]

const ADMIN_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  ...HR_PERMISSIONS,
  ...ADMIN_EXTRA_PERMISSIONS,
]

/**
 * system role の key と、その role が持つ permission キー集合の対応。
 * member は permission を持たない(self 判定のみ)。
 */
export const SYSTEM_ROLE_PERMISSIONS: ReadonlyArray<{
  key: string
  name: string
  permissions: ReadonlyArray<PermissionKey>
}> = [
  { key: "member", name: "メンバー", permissions: [] },
  { key: "manager", name: "マネージャー", permissions: MANAGER_PERMISSIONS },
  { key: "hr", name: "人事", permissions: HR_PERMISSIONS },
  { key: "admin", name: "管理者", permissions: ADMIN_PERMISSIONS },
]
