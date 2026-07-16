import type { PermissionKey } from "@/lib/auth/permission-keys"
import { EFFECTIVE_ADMIN_PERMISSION_KEYS } from "@/lib/auth/effective-admin-permissions"

// 既存の role 4値(member/manager/hr/admin)を permission 集合として厳密再現する。
// 移行で権限が広がらないことをテストで担保するための基準。backfill の role_permissions シードに使う。
// 実態: 大半の can-* は ["manager","hr","admin"]、employee:delete/org:manage/thanks_* は ["hr","admin"]。

// 全従業員が持つガバナンスの基本権限。
const MEMBER_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  "governance:read",
  "governance:acknowledge",
]

// manager が member に加えて持つ permission(can-* が manager を許可するもの)。
const MANAGER_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  ...MEMBER_PERMISSIONS,
  "dashboard:view",
  "employee:read",
  "employee:create",
  "employee:update",
  "employee:lifecycle:request",
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
  // スコープ権限: manager は全社(:all)ではなくレポートライン配下(:reports)のみ。
  // 移行前の「manager の権限が全社に効く」挙動を 0011 で意図的に狭めた。
  "goal:read:reports",
  "goal:evaluate:reports",
  "attendance:read:reports",
  "leave:read:reports",
  "grade:read:reports",
  "governance:review",
]

// hr が manager に加えて持つ permission(can-* が ["hr","admin"] のもの)。
const HR_EXTRA_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  "application_template:manage",
  "review:administer",
  "org:manage",
  "employee:delete",
  "employee:lifecycle:apply",
  "employee:lifecycle:read:all",
  "employee:archive",
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
  // 人事KPI(在籍・退職・評価分布)を扱うため経営ダッシュボードも閲覧できる。
  "management_dashboard:view",
  // 人事・労務の記録系ドメイン。
  "announcement:manage",
  "regulation:manage",
  "calendar:manage",
  "work_style:manage",
  "work_style:read:all",
  "certification:manage",
  "certification:read:all",
  "health_checkup:manage",
  "health_checkup:read:all",
  "work_accident:manage",
  "work_accident:read:all",
  "salary_revision:manage",
  "salary_revision:read:all",
  "recruitment:manage",
  "commendation:manage",
  "disciplinary_action:manage",
  "disciplinary_action:read:all",
  "headcount_plan:manage",
  "headcount_plan:read:all",
  "year_end_adjustment:manage",
  "year_end_adjustment:read:all",
  "budget:manage",
]

// admin が hr に加えて持つ permission（IAM・アカウント管理・ロール割当・監査）。
const ADMIN_EXTRA_PERMISSIONS: ReadonlyArray<PermissionKey> = [
  ...EFFECTIVE_ADMIN_PERMISSION_KEYS,
  "audit:read",
  "audit:export",
  "governance:read:restricted",
  "governance:manage",
  "governance:publish",
  // どのプリセットにも実務付与しない department スコープも、escalation guard
  // （付与するロールの権限 ⊆ 付与者の権限）を通すため admin は保持する。
  "goal:read:department",
  "attendance:read:department",
  "leave:read:department",
  // 経営・対外ドメイン。実務は executive / general_affairs プリセットが担う。
  "ringi:read:all",
  "partner:manage",
  "contract:manage",
  "contract:read:all",
  "meeting:manage",
  "decision:manage",
  // 総務・情シス・経営の記録系。実務はプリセットが担うが admin は全キーを保持する。
  "document:manage",
  "document:read:all",
  "license:manage",
  "license:read:all",
  "it_incident:manage",
  "it_incident:read:all",
  "budget:manage",
  "budget:read:all",
  // 基盤の運用系。トークン発行とエクスポートは admin に限定する。
  "api_token:manage",
  "access_review:view",
  "export:run",
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
 * member も公開済みガバナンス文書の閲覧・確認権限を持つ。
 */
export const SYSTEM_ROLE_PERMISSIONS: ReadonlyArray<{
  key: string
  name: string
  permissions: ReadonlyArray<PermissionKey>
}> = [
  { key: "member", name: "標準利用者", permissions: MEMBER_PERMISSIONS },
  { key: "manager", name: "業務管理者", permissions: MANAGER_PERMISSIONS },
  { key: "hr", name: "人事管理者", permissions: HR_PERMISSIONS },
  { key: "admin", name: "システム管理者", permissions: ADMIN_PERMISSIONS },
]
