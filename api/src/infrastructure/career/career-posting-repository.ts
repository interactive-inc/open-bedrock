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
}
