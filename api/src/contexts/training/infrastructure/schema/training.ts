import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 研修コース（コード・タイトル・カテゴリ・必須フラグ・状態）。is_required は 0/1 を boolean で持つ。 */
export const trainingCourses = sqliteTable(
  "training_courses",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes"),
    category: text("category").notNull(),
    isRequired: integer("is_required", { mode: "boolean" }).notNull(),
    status: text("status").notNull(),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("training_courses_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type TrainingCourseRow = InferSelectModel<typeof trainingCourses>

/** 受講登録（社員ごとのコース受講状況・スコア・期限）。 */
export const trainingEnrollments = sqliteTable(
  "training_enrollments",
  {
    id: text("id").primaryKey().notNull(),
    courseId: text("course_id").notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    status: text("status").notNull(),
    completedAt: text("completed_at"),
    score: integer("score"),
    dueDate: text("due_date"),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  // 同一コース・同一社員の受講登録は 1 件まで（重複受講を防ぐ）。
  (table) => [
    check("training_enrollments_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("idx_training_enrollments_course_employee").on(table.courseId, table.employeeId),
  ],
)

export type TrainingEnrollmentRow = InferSelectModel<typeof trainingEnrollments>
