import { z } from "zod"

// 認可の唯一の正(SSOT)。permission は "<domain>:<action>[:<scope>]" 形式の機械可読キー。
// permissions テーブルは UI 用の写しで、起動時にこの集合の subset であることを検証する。
// self スコープ(本人==操作対象)は permission に載せず、所有者判定としてコードの不変条件に残す。

/**
 * 全 permission のカタログ。key とカテゴリ(UI グルーピング用)の対応。
 * 既存の can-* ゲートとインライン判定を正規化したもの。
 */
export const PERMISSION_CATALOG = [
  { key: "dashboard:view", category: "general", description: "ダッシュボードを閲覧する" },
  { key: "employee:read", category: "employee", description: "従業員を閲覧する" },
  { key: "employee:create", category: "employee", description: "従業員を登録する" },
  { key: "employee:update", category: "employee", description: "従業員を更新する" },
  { key: "employee:delete", category: "employee", description: "従業員を削除する" },
  { key: "employee:assign_role", category: "employee", description: "従業員のロールを割り当てる" },
  { key: "org:manage", category: "org", description: "組織・部署を管理する" },
  { key: "application:approve", category: "application", description: "申請を承認・却下する" },
  {
    key: "application:read:all",
    category: "application",
    description: "全社の申請を横断で閲覧する",
  },
  {
    key: "application_template:manage",
    category: "application",
    description: "申請テンプレートを管理する",
  },
  { key: "expense:approve", category: "expense", description: "経費申請を承認・却下する" },
  { key: "expense:read:all", category: "expense", description: "全社の経費申請を横断で閲覧する" },
  { key: "leave:approve", category: "leave", description: "休暇申請を承認・却下する" },
  { key: "leave:read:all", category: "leave", description: "全社の休暇申請を横断で閲覧する" },
  { key: "notification:send", category: "notification", description: "通知を送信する" },
  { key: "oneonone:create", category: "oneonone", description: "1on1 を作成する" },
  { key: "review:administer", category: "review", description: "評価サイクルを運営する" },
  {
    key: "career_posting:manage",
    category: "career",
    description: "社内公募を管理する",
  },
  { key: "room:manage", category: "room", description: "会議室を管理する" },
  { key: "asset:manage", category: "asset", description: "資産を管理する" },
  { key: "training:manage", category: "training", description: "研修コースを管理する" },
  { key: "shift:manage", category: "shift", description: "シフトを管理する" },
  { key: "shift_swap:approve", category: "shift", description: "シフト交代を承認する" },
  {
    key: "shift_swap:read:all",
    category: "shift",
    description: "全社のシフト交代申請を横断で閲覧する",
  },
  { key: "survey:manage", category: "survey", description: "アンケートを管理する" },
  {
    key: "antisocial_check:manage",
    category: "antisocial-check",
    description: "反社チェックを管理する",
  },
  { key: "batch:view", category: "batch", description: "バッチジョブを閲覧する" },
  { key: "onboarding:manage", category: "onboarding", description: "オンボーディングを管理する" },
  {
    key: "onboarding:view:all",
    category: "onboarding",
    description: "全従業員のオンボーディングを閲覧する",
  },
  { key: "thanks_reward:manage", category: "thanks", description: "サンクスの交換景品を管理する" },
  {
    key: "thanks_redemption:approve",
    category: "thanks",
    description: "サンクスの交換申請を承認する",
  },
  {
    key: "thanks_redemption:read:all",
    category: "thanks",
    description: "全社のサンクス交換申請を横断で閲覧する",
  },
  { key: "goal:read:all", category: "goal", description: "他者の目標を閲覧する" },
  { key: "goal:evaluate", category: "goal", description: "目標を評価する(上長)" },
  { key: "attendance:read:all", category: "attendance", description: "全従業員の勤怠を閲覧する" },
  { key: "iam:manage_roles", category: "iam", description: "ロールと権限を管理する" },
  { key: "iam:assign_roles", category: "iam", description: "アカウントにロールを割り当てる" },
  {
    key: "account:manage",
    category: "iam",
    description: "アカウントを管理する(作成・停止・失効・identity)",
  },
] as const

/** permission キーの文字列ユニオン。 */
export const permissionKeySchema = z.enum(
  PERMISSION_CATALOG.map((entry) => entry.key) as [string, ...string[]],
)

export type PermissionKey = z.infer<typeof permissionKeySchema>

/** 全 permission キーの配列。 */
export const PERMISSION_KEYS: ReadonlyArray<string> = PERMISSION_CATALOG.map((entry) => entry.key)
