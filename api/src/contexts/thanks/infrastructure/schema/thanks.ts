import type { RedemptionStatus } from "@/lib/schemas"
import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 感謝（サンクス）。送り手が受け手へ送る感謝メッセージ。points は将来のポイント付与用で本 Task では常に 0。 */
export const thanks = sqliteTable("thanks_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderEmployeeId: integer("sender_employee_id").notNull(),
  recipientEmployeeId: integer("recipient_employee_id").notNull(),
  message: text("message").notNull(),
  points: integer("points").notNull().default(0),
  createdAt: text("created_at").notNull(),
})

export type ThanksRow = InferSelectModel<typeof thanks>

/**
 * サンクスポイントの月次贈与原資。employee_id + period(YYYY-MM) で一意。
 * 残量は granted_points − consumed_points で算出する。consumed_points は贈与時に
 * 原子的な条件付き UPDATE で加算し、同月の同時送付でも原資超過しないための消費カウンタ。
 */
export const thanksPointBudgets = sqliteTable(
  "thanks_point_budgets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    period: text("period").notNull(),
    grantedPoints: integer("granted_points").notNull(),
    consumedPoints: integer("consumed_points").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_thanks_point_budgets_employee_period").on(table.employeeId, table.period),
  ],
)

export type ThanksPointBudgetRow = InferSelectModel<typeof thanksPointBudgets>

/** サンクスポイントの交換カタログ。stock が null は在庫無制限。is_active は 0/1 を boolean で持つ。 */
export const thanksRewards = sqliteTable("thanks_rewards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  pointCost: integer("point_cost").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull(),
  stock: integer("stock"),
  createdAt: text("created_at").notNull(),
})

export type ThanksRewardRow = InferSelectModel<typeof thanksRewards>

/**
 * サンクスポイントの交換申請。状態は pending→fulfilled（確定）/rejected（却下）。
 * point_cost は申請時点の交換コストを写し取り、後からカタログ価格が変わってもブレないようにする。
 */
export const thanksRedemptions = sqliteTable(
  "thanks_redemptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    rewardId: integer("reward_id").notNull(),
    pointCost: integer("point_cost").notNull(),
    status: text("status").notNull().$type<RedemptionStatus>(),
    createdAt: text("created_at").notNull(),
    decidedAt: text("decided_at"),
    deciderId: integer("decider_id"),
  },
  // 1 社員につき pending の交換申請は 1 件まで（二重申請・残高の二重引当を防ぐ）。
  (table) => [
    uniqueIndex("idx_thanks_redemptions_employee_pending")
      .on(table.employeeId)
      .where(sql`status = 'pending'`),
  ],
)

export type ThanksRedemptionRow = InferSelectModel<typeof thanksRedemptions>
