import type { PermissionKey } from "@/lib/auth/permission-keys"
import { EFFECTIVE_ADMIN_PERMISSION_KEYS } from "@/lib/auth/effective-admin-permissions"

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
  "expense:approve",
  "leave:approve",
  "notification:send",
  "oneonone:create",
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
  "goal:read:all",
  "goal:evaluate",
  "attendance:read:all",
]

// hr が manager に加えて持つ permission(can-* が ["hr","admin"] のもの)。
const HR_EXTRA_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  "application_template:manage",
  "review:administer",
  "org:manage",
  "employee:delete",
  "thanks_reward:manage",
  "thanks_redemption:approve",
  "application:read:all",
  "expense:read:all",
  "leave:read:all",
  "thanks_redemption:read:all",
  "shift_swap:read:all",
  "budget:manage",
]

// admin が hr に加えて持つ permission(IAM・アカウント管理・ロール割当)。
const ADMIN_EXTRA_PERMISSIONS: ReadonlyArray<PermissionKey> = [...EFFECTIVE_ADMIN_PERMISSION_KEYS]

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
  { key: "member", name: "標準利用者", permissions: [] },
  { key: "manager", name: "業務管理者", permissions: MANAGER_PERMISSIONS },
  { key: "hr", name: "人事管理者", permissions: HR_PERMISSIONS },
  { key: "admin", name: "システム管理者", permissions: ADMIN_PERMISSIONS },
]
