import { CareerApplication } from "@/domain/career/career-application"
import type { Context } from "@/env"
import { careerApplications } from "@/schema"
import { and, asc, count, eq } from "drizzle-orm"

export type AlreadyAppliedError = { reason: "already_applied" }

export class CareerApplicationRepository {
  constructor(private readonly c: Context) {}

  async create(
    careerApplication: CareerApplication,
  ): Promise<CareerApplication | AlreadyAppliedError | Error> {
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
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        return { reason: "already_applied" }
      }
      return error instanceof Error ? error : new Error("failed to insert career application")
    }
  }

  // 応募者本人の応募を id の昇順で返す。
  async findByApplicantId(props: {
    applicantId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<CareerApplication> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(careerApplications)
        .where(eq(careerApplications.applicantId, props.applicantId))
        .orderBy(asc(careerApplications.id))
        .limit(props.limit)
        .offset(props.offset)

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

  // 指定した求人に対して指定ステータスの応募件数を返す。
  async countByPostingIdAndStatus(
    postingId: number,
    status: CareerApplication["status"],
  ): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ value: count() })
        .from(careerApplications)
        .where(
          and(eq(careerApplications.postingId, postingId), eq(careerApplications.status, status)),
        )

      return rows.at(0)?.value ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count career_applications")
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
