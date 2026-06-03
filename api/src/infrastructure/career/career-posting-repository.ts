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
}
