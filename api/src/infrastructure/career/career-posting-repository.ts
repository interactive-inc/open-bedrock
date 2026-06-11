import { CareerPosting } from "@/domain/career/career-posting"
import type { Context } from "@/env"
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

  // 公募を削除する。
  async delete(postingId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(careerPostings).where(eq(careerPostings.id, postingId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete career_posting")
    }
  }

  // status='applied' の応募がなければ公募と紐づく応募をアトミックに削除する。
  // D1 batch で career_applications（withdrawn/rejected）と career_postings を一括削除し、
  // チェックと削除の間のレースおよび孤児レコードの蓄積を防ぐ。
  // 戻り値: "deleted" = 削除成功, "has_applied" = 応募ありのためスキップ, Error = DB エラー
  async deleteIfNoAppliedApplications(
    postingId: number,
  ): Promise<"deleted" | "has_applied" | Error> {
    try {
      const db = this.c.env.DB

      // applied 状態の応募が存在するか確認する
      const check = await db
        .prepare(
          "SELECT 1 FROM career_applications WHERE posting_id = ?1 AND status = 'applied' LIMIT 1",
        )
        .bind(postingId)
        .all()

      if (check.results.length > 0) {
        return "has_applied"
      }

      // career_applications（withdrawn/rejected）と career_postings を D1 batch でアトミックに削除する
      await db.batch([
        db.prepare("DELETE FROM career_applications WHERE posting_id = ?1").bind(postingId),
        db.prepare("DELETE FROM career_postings WHERE id = ?1").bind(postingId),
      ])

      return "deleted"
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete career_posting")
    }
  }
}
