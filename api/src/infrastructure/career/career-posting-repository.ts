import { CareerPosting } from "@/domain/career/career-posting.entity"
import type { Context } from "@/env"
import {
  abortWhenPreviousStatementChangedNoRows,
  isAbortedByGuard,
} from "@/lib/d1/batch-abort-guard"
import { careerPostings } from "@/schema"
import { eq } from "drizzle-orm"

export class CareerPostingRepository {
  constructor(private readonly c: Context) {}

  async findById(postingId: number): Promise<CareerPosting | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(careerPostings)
        .where(eq(careerPostings.id, postingId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : CareerPosting.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load career_posting")
    }
  }

  // 新規公募を保存する。id は省略し DB の autoincrement に任せ、採番後の行を返す。
  async create(careerPosting: CareerPosting): Promise<CareerPosting | Error> {
    try {
      const rows = await this.c.var.database
        .insert(careerPostings)
        .values({
          title: careerPosting.title,
          deptId: careerPosting.deptId,
          deptName: careerPosting.deptName,
          requiredSkills: careerPosting.requiredSkills,
          status: careerPosting.status,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert career_posting")
        : CareerPosting.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert career_posting")
    }
  }

  // 公募の内容と状態を更新し、更新後の行を返す。
  async update(careerPosting: CareerPosting): Promise<CareerPosting | null | Error> {
    try {
      if (careerPosting.id === null) {
        return new Error("career_posting id is required for update")
      }

      const rows = await this.c.var.database
        .update(careerPostings)
        .set({
          title: careerPosting.title,
          deptId: careerPosting.deptId,
          deptName: careerPosting.deptName,
          requiredSkills: careerPosting.requiredSkills,
          status: careerPosting.status,
        })
        .where(eq(careerPostings.id, careerPosting.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : CareerPosting.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update career_posting")
    }
  }

  // status='applied' の応募がなければ公募と紐づく応募をアトミックに削除する。
  // D1 batch でチェックと削除を単一トランザクションで実行し TOCTOU を防ぐ。
  // 0 行削除（applied 応募が存在）なら null を返す。
  async deleteIfNoAppliedApplications(postingId: number): Promise<true | null | Error> {
    try {
      const db = this.c.env.DB

      await db.batch([
        // applied 応募が存在しない場合のみ career_applications（withdrawn/rejected）を削除する
        db
          .prepare(
            `DELETE FROM career_applications
             WHERE posting_id = ?1
               AND NOT EXISTS (
                 SELECT 1 FROM career_applications
                 WHERE posting_id = ?1 AND status = 'applied'
               )`,
          )
          .bind(postingId),
        // applied 応募が存在しない場合のみ career_postings を削除する
        db
          .prepare(
            `DELETE FROM career_postings
             WHERE id = ?1
               AND NOT EXISTS (
                 SELECT 1 FROM career_applications
                 WHERE posting_id = ?1 AND status = 'applied'
               )`,
          )
          .bind(postingId),
        abortWhenPreviousStatementChangedNoRows(db),
      ])

      return true
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return null
      }
      return error instanceof Error ? error : new Error("failed to delete career_posting")
    }
  }
}
