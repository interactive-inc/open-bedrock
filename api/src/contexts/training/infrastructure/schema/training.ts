import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 研修コース（コード・タイトル・カテゴリ・必須フラグ・状態）。is_required は 0/1 を boolean で持つ。 */
export const trainingCourses = sqliteTable("training_courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes"),
  category: text("category").notNull(),
  isRequired: integer("is_required", { mode: "boolean" }).notNull(),
  status: text("status").notNull(),
})

export type TrainingCourseRow = InferSelectModel<typeof trainingCourses>

/** 受講登録（社員ごとのコース受講状況・スコア・期限）。 */
export const trainingEnrollments = sqliteTable(
  "training_enrollments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id").notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    status: text("status").notNull(),
    completedAt: text("completed_at"),
    score: integer("score"),
    dueDate: text("due_date"),
  },
  // 同一コース・同一社員の受講登録は 1 件まで（重複受講を防ぐ）。
  (table) => [
    uniqueIndex("idx_training_enrollments_course_employee").on(table.courseId, table.employeeId),
  ],
)

export type TrainingEnrollmentRow = InferSelectModel<typeof trainingEnrollments>
