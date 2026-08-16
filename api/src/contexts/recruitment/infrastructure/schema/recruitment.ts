import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 採用の募集ポジション（社外個人情報を扱う候補者の親。open/closed の状態を持つ）。 */
export const recruitmentPositions = sqliteTable(
  "job_openings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    departmentCode: text("department_code"),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_recruitment_positions_status").on(table.status)],
)

export type RecruitmentPositionRow = InferSelectModel<typeof recruitmentPositions>

/** 応募者（社外個人情報。選考ステージを applied→…→hired/rejected で進める）。 */
export const recruitmentCandidates = sqliteTable(
  "recruitment_candidates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    positionId: integer("position_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    source: text("source"),
    stage: text("stage").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_recruitment_candidates_position").on(table.positionId)],
)

export type RecruitmentCandidateRow = InferSelectModel<typeof recruitmentCandidates>
