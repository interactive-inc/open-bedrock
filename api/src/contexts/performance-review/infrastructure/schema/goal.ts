import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/**
 * 目標（社員ごと・評価期間ごとの目標と重み・状態）。
 * owner_type は目標の所有主体(individual/department/company)。parent_goal_id で全社→部門→個人の
 * 階層をつなぎ、department_code は部門目標の所属部門を表す。個人目標では department_code は null。
 */
export const goals = sqliteTable(
  "performance_goals",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    period: text("period").notNull(),
    title: text("title").notNull(),
    kpi: text("kpi"),
    weight: integer("weight").notNull(),
    status: text("status").notNull(),
    ownerType: text("owner_type").notNull().default("individual"),
    parentGoalId: text("parent_goal_id"),
    departmentCode: text("department_code"),
    evaluationSheetId: text("evaluation_sheet_id"),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("performance_goals_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type GoalRow = InferSelectModel<typeof goals>

/** 目標への評価（自己・上長・最終） */
export const goalEvaluations = sqliteTable(
  "goal_evaluations",
  {
    id: text("id").primaryKey().notNull(),
    goalId: text("goal_id").notNull(),
    evaluatorId: text("evaluator_id").$type<EmployeeId>().notNull(),
    kind: text("kind").notNull(),
    score: integer("score"),
    comment: text("comment"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  // 1 目標につき final 評価は 1 件まで（最終評価の二重登録を防ぐ）。
  // self / manager は 1 目標・1 評価者・1 種別につき 1 件まで。
  (table) => [
    check("goal_evaluations_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("idx_goal_evaluations_goal_final")
      .on(table.goalId)
      .where(sql`kind = 'final'`),
    uniqueIndex("idx_goal_evaluations_evaluator_kind")
      .on(table.goalId, table.evaluatorId, table.kind)
      .where(sql`kind IN ('self', 'manager')`),
  ],
)

export type GoalEvaluationRow = InferSelectModel<typeof goalEvaluations>
