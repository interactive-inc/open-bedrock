import { CareerApplication } from "@/domain/career/career-application"
import type { Context } from "@/env"
import { careerApplications } from "@/schema"
import { and, eq } from "drizzle-orm"

export class CareerApplicationRepository {
  constructor(private readonly c: Context) {}

  async create(careerApplication: CareerApplication): Promise<CareerApplication | Error> {
    try {
      const rows = await this.c.var.database
        .insert(careerApplications)
        .values({
          postingId: careerApplication.postingId,
          applicantId: careerApplication.applicantId,
          message: careerApplication.message,
          status: careerApplication.status,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert career application")
        : CareerApplication.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert career application")
    }
  }

  async findByPostingAndApplicant(
    postingId: number,
    applicantId: number,
  ): Promise<CareerApplication | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(careerApplications)
        .where(
          and(
            eq(careerApplications.postingId, postingId),
            eq(careerApplications.applicantId, applicantId),
          ),
        )
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : CareerApplication.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load career_application")
    }
  }
}
