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
  {
    key: "employee:update",
    category: "employee",
    description: "許可された対象範囲の従業員を更新する",
  },
  { key: "employee:delete", category: "employee", description: "従業員を削除する" },
  { key: "employee:assign_role", category: "employee", description: "従業員のロールを割り当てる" },
  {
    key: "employee:lifecycle:request",
    category: "employee",
    description: "組織スコープ内の人事変更を申請する",
  },
  {
    key: "employee:lifecycle:apply",
    category: "employee",
    description: "許可された対象範囲の人事変更を確定する",
  },
  {
    key: "employee:lifecycle:read:all",
    category: "employee",
    description: "全社の人事履歴を横断で閲覧する",
  },
  { key: "employee:archive", category: "employee", description: "退職済み従業員をアーカイブする" },
  { key: "org:manage", category: "org", description: "組織・部署を管理する" },
  {
    key: "application:approve",
    category: "application",
    description: "組織スコープ内の互換申請を承認・却下する",
  },
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
  { key: "budget:manage", category: "budget", description: "部署予算を管理する" },
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
  { key: "goal:read:all", category: "goal", description: "全社の目標を閲覧する" },
  {
    key: "goal:read:reports",
    category: "goal",
    description: "レポートライン配下の目標を閲覧する",
  },
  {
    key: "goal:read:department",
    category: "goal",
    description: "同じ部署の目標を閲覧する",
  },
  { key: "goal:evaluate", category: "goal", description: "全社の目標を評価する" },
  {
    key: "goal:evaluate:reports",
    category: "goal",
    description: "レポートライン配下の目標を評価する",
  },
  { key: "attendance:read:all", category: "attendance", description: "全従業員の勤怠を閲覧する" },
  {
    key: "attendance:read:reports",
    category: "attendance",
    description: "レポートライン配下の勤怠を閲覧する",
  },
  {
    key: "attendance:read:department",
    category: "attendance",
    description: "同じ部署の勤怠を閲覧する",
  },
  {
    key: "certificate_request:read:all",
    category: "certificate-request",
    description: "全社の証明書発行依頼を横断で閲覧する",
  },
  {
    key: "certificate_request:manage",
    category: "certificate-request",
    description: "証明書発行依頼の状態を代理で進める",
  },
  {
    key: "resignation:manage",
    category: "resignation",
    description: "退職手続きの状態を代理で進める",
  },
  {
    key: "life_event:manage",
    category: "life-event",
    description: "ライフイベント届の状態を代理で進める",
  },
  {
    key: "family_care_leave:manage",
    category: "family-care-leave",
    description: "産休・育休・介護休業の申出の状態を代理で進める",
  },
  {
    key: "business_trip:manage",
    category: "business-trip",
    description: "出張申請の状態を代理で進める",
  },
  {
    key: "rental:manage",
    category: "rental",
    description: "貸与品予約の状態を代理で進める",
  },
  {
    key: "leave:read:reports",
    category: "leave",
    description: "レポートライン配下の休暇申請を閲覧する",
  },
  {
    key: "leave:read:department",
    category: "leave",
    description: "同じ部署の休暇申請を閲覧する",
  },
  { key: "grade:manage", category: "grade", description: "等級マスタと等級の割当を管理する" },
  { key: "grade:read:all", category: "grade", description: "全社の等級を閲覧する" },
  {
    key: "grade:read:reports",
    category: "grade",
    description: "レポートライン配下の等級を閲覧する",
  },
  {
    key: "employee_event:manage",
    category: "employee",
    description: "異動・在籍イベントの履歴を記録する",
  },
  {
    key: "employee_event:read:all",
    category: "employee",
    description: "全社の異動・在籍イベント履歴を閲覧する",
  },
  {
    key: "resignation:read:all",
    category: "resignation",
    description: "全社の退職手続きを横断で閲覧する",
  },
  {
    key: "life_event:read:all",
    category: "life-event",
    description: "全社のライフイベント届を横断で閲覧する",
  },
  {
    key: "family_care_leave:read:all",
    category: "family-care-leave",
    description: "全社の産休・育休・介護休業の申出を横断で閲覧する",
  },
  {
    key: "business_trip:read:all",
    category: "business-trip",
    description: "全社の出張申請を横断で閲覧する",
  },
  {
    key: "rental:read:all",
    category: "rental",
    description: "全社の貸与品予約を横断で閲覧する",
  },
  { key: "announcement:manage", category: "announcement", description: "社内アナウンスを管理する" },
  { key: "regulation:manage", category: "regulation", description: "規程集を管理する" },
  { key: "document:manage", category: "document", description: "文書台帳を管理する" },
  { key: "document:read:all", category: "document", description: "文書台帳を閲覧する" },
  { key: "calendar:manage", category: "calendar", description: "会社カレンダーを管理する" },
  { key: "work_style:manage", category: "attendance", description: "勤務形態の属性を管理する" },
  {
    key: "work_style:read:all",
    category: "attendance",
    description: "全社の勤務形態の属性を閲覧する",
  },
  {
    key: "certification:manage",
    category: "certification",
    description: "資格・免許の台帳を管理する",
  },
  {
    key: "certification:read:all",
    category: "certification",
    description: "全社の資格・免許を閲覧する",
  },
  {
    key: "health_checkup:manage",
    category: "health",
    description: "健康診断の実施記録を管理する",
  },
  {
    key: "health_checkup:read:all",
    category: "health",
    description: "全社の健康診断の実施記録を閲覧する",
  },
  {
    key: "work_accident:manage",
    category: "health",
    description: "労災・事故の発生記録を管理する",
  },
  {
    key: "work_accident:read:all",
    category: "health",
    description: "全社の労災・事故記録を閲覧する",
  },
  { key: "license:manage", category: "license", description: "ライセンス・SaaS台帳を管理する" },
  { key: "license:read:all", category: "license", description: "ライセンス・SaaS台帳を閲覧する" },
  { key: "it_incident:manage", category: "license", description: "インシデント記録を管理する" },
  {
    key: "it_incident:read:all",
    category: "license",
    description: "全社のインシデント記録を閲覧する",
  },
  { key: "budget:read:all", category: "budget", description: "予算枠の記録を閲覧する" },
  {
    key: "salary_revision:manage",
    category: "salary",
    description: "給与改定の事実記録を管理する",
  },
  {
    key: "salary_revision:read:all",
    category: "salary",
    description: "全社の給与改定記録を閲覧する",
  },
  { key: "recruitment:manage", category: "recruitment", description: "採用(応募者管理)を扱う" },
  { key: "commendation:manage", category: "employee", description: "表彰の記録を管理する" },
  {
    key: "disciplinary_action:manage",
    category: "employee",
    description: "懲戒の記録を管理する",
  },
  {
    key: "disciplinary_action:read:all",
    category: "employee",
    description: "懲戒の記録を閲覧する",
  },
  {
    key: "headcount_plan:manage",
    category: "headcount",
    description: "人員計画を管理する",
  },
  {
    key: "headcount_plan:read:all",
    category: "headcount",
    description: "人員計画を閲覧する",
  },
  { key: "ringi:read:all", category: "ringi", description: "全社の稟議を横断で閲覧する" },
  { key: "partner:manage", category: "partner", description: "取引先台帳を管理する" },
  { key: "contract:manage", category: "partner", description: "契約記録を管理する" },
  {
    key: "contract:read:all",
    category: "partner",
    description: "全社の契約記録を横断で閲覧する",
  },
  { key: "meeting:manage", category: "meeting", description: "会議体マスタを管理する" },
  {
    key: "decision:manage",
    category: "decision",
    description: "会社の意思決定記録を記録・更新する",
  },
  {
    key: "management_dashboard:view",
    category: "dashboard",
    description: "経営ダッシュボードを閲覧する",
  },
  {
    key: "api_token:manage",
    category: "iam",
    description: "機械用トークン(サービスアカウント)を管理する",
  },
  {
    key: "access_review:view",
    category: "iam",
    description: "アクセス権の棚卸(アカウント×権限の一覧)を閲覧する",
  },
  { key: "export:run", category: "iam", description: "全データのエクスポートを実行する" },
  {
    key: "year_end_adjustment:manage",
    category: "year-end",
    description: "年末調整の提出状況を管理する",
  },
  {
    key: "year_end_adjustment:read:all",
    category: "year-end",
    description: "全社の年末調整の提出状況を閲覧する",
  },
  { key: "audit:read", category: "audit", description: "監査イベントを閲覧する" },
  { key: "audit:export", category: "audit", description: "監査イベントを CSV 出力する" },
  {
    key: "governance:read",
    category: "governance",
    description: "公開済みの規程・手続き・統制を閲覧する",
  },
  {
    key: "governance:read:restricted",
    category: "governance",
    description: "機密又は限定公開の規程を横断閲覧する",
  },
  {
    key: "governance:manage",
    category: "governance",
    description: "規程原本、能力、組織ロールと割当を管理する",
  },
  {
    key: "governance:review",
    category: "governance",
    description: "候補者となった規程版を審査する",
  },
  {
    key: "governance:publish",
    category: "governance",
    description: "審査要件を満たした規程版を公開する",
  },
  {
    key: "governance:acknowledge",
    category: "governance",
    description: "適用対象となる規程版の確認を記録する",
  },
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
