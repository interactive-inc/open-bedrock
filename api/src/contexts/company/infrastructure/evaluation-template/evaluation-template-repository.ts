import { EvaluationTemplate } from "@/contexts/company/domain/evaluation-template/evaluation-template.entity"
import type { Context } from "@/env"
import { evaluationTemplates } from "@/schema"
import { and, asc, count, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class EvaluationTemplateRepository {
  constructor(private readonly c: Context) {}

  async findById(id: number): Promise<EvaluationTemplate | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(evaluationTemplates)
        .where(eq(evaluationTemplates.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : EvaluationTemplate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load evaluation template")
    }
  }

  async findAll(opts?: {
    period?: string
    status?: string
    limit: number
    offset: number
  }): Promise<{ data: ReadonlyArray<EvaluationTemplate>; total: number } | Error> {
    try {
      const conditions: Array<SQL> = []

      if (opts?.period !== undefined) {
        conditions.push(eq(evaluationTemplates.period, opts.period))
      }

      if (opts?.status !== undefined) {
        conditions.push(eq(evaluationTemplates.status, opts.status))
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined

      const rows = await this.c.var.database
        .select()
        .from(evaluationTemplates)
        .where(where)
        .orderBy(asc(evaluationTemplates.id))
        .limit(opts?.limit ?? 50)
        .offset(opts?.offset ?? 0)

      const totalRows = await this.c.var.database
        .select({ total: count() })
        .from(evaluationTemplates)
        .where(where)

      return {
        data: rows.map((row) => EvaluationTemplate.fromRow(row)),
        total: totalRows.at(0)?.total ?? 0,
      }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to list evaluation templates")
    }
  }

  async create(template: EvaluationTemplate): Promise<EvaluationTemplate | Error> {
    try {
      const rows = await this.c.var.database
        .insert(evaluationTemplates)
        .values({
          title: template.title,
          period: template.period,
          items: JSON.stringify(template.items),
          status: template.status,
          createdBy: template.createdBy,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create evaluation template")
        : EvaluationTemplate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create evaluation template")
    }
  }

  async update(template: EvaluationTemplate): Promise<EvaluationTemplate | null | Error> {
    try {
      if (template.id === null) {
        return new Error("cannot update unsaved evaluation template")
      }

      const rows = await this.c.var.database
        .update(evaluationTemplates)
        .set({
          title: template.title,
          period: template.period,
          items: JSON.stringify(template.items),
          status: template.status,
          updatedAt: template.updatedAt,
        })
        .where(eq(evaluationTemplates.id, template.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : EvaluationTemplate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update evaluation template")
    }
  }
}
