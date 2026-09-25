import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 採用の募集ポジション（社外個人情報を扱う候補者の親。open/closed の状態を持つ）。 */
export const recruitmentPositions = sqliteTable(
  "job_openings",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    departmentCode: text("department_code"),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("job_openings_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_recruitment_positions_status").on(table.status),
  ],
)

export type RecruitmentPositionRow = InferSelectModel<typeof recruitmentPositions>

/** 応募者（社外個人情報。選考ステージを applied→…→hired/rejected で進める）。 */
export const recruitmentCandidates = sqliteTable(
  "recruitment_candidates",
  {
    id: text("id").primaryKey().notNull(),
    positionId: text("position_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    source: text("source"),
    stage: text("stage").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("recruitment_candidates_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_recruitment_candidates_position").on(table.positionId),
  ],
)

export type RecruitmentCandidateRow = InferSelectModel<typeof recruitmentCandidates>
