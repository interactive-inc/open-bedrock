import { CareerApplication } from "@/domain/career/career-application"
import type { Context } from "@/env"
import { careerApplications } from "@/schema"
import { and, asc, eq } from "drizzle-orm"

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

  // 応募者本人の応募を id の昇順で返す。
  async findByApplicantId(applicantId: number): Promise<ReadonlyArray<CareerApplication> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(careerApplications)
        .where(eq(careerApplications.applicantId, applicantId))
        .orderBy(asc(careerApplications.id))

      return rows.map((row) => CareerApplication.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load career_applications")
    }
  }

  // 応募 id で1件取得する。存在しなければ null。
  async findById(id: number): Promise<CareerApplication | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(careerApplications)
        .where(eq(careerApplications.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : CareerApplication.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load career_application")
    }
  }

  // 応募メッセージを更新する。id が未採番なら更新できない。
  async update(careerApplication: CareerApplication): Promise<CareerApplication | Error> {
    if (careerApplication.id === null) {
      return new Error("cannot update an unsaved career application")
    }

    try {
      await this.c.var.database
        .update(careerApplications)
        .set({ message: careerApplication.message })
        .where(eq(careerApplications.id, careerApplication.id))

      return careerApplication
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update career_application")
    }
  }

  // 応募を削除する。
  async delete(id: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(careerApplications).where(eq(careerApplications.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete career_application")
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
