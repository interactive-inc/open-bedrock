import { PositionEntity } from "@/contexts/company/domain/entities/position.entity"
import { CompanyUniqueConstraintError } from "@/contexts/company/domain/errors"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { organizationAssignmentPeriodVersions } from "@/contexts/company/infrastructure/schema/organization"
import { positions } from "@/contexts/company/infrastructure/schema/position"
import { isCompanyUniqueConstraintError } from "@/contexts/company/infrastructure/repositories/employee/lib/is-company-unique-constraint-error"
import { and, asc, count, eq, sql } from "drizzle-orm"

type Context = CompanyContext

type FindPositionProps =
  | Readonly<{ id: number; code?: never }>
  | Readonly<{ code: string; id?: never }>

export class PositionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(input: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<PositionEntity> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(positions)
        .orderBy(asc(positions.rank), asc(positions.id))
        .limit(input.limit)
        .offset(input.offset)
      return rows.map((row) => PositionEntity.restore(row))
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to list Company positions")
    }
  }

  async count(): Promise<number | Error> {
    try {
      return (await this.c.var.database.select({ total: count() }).from(positions))[0]?.total ?? 0
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to count Company positions")
    }
  }

  async find(props: FindPositionProps): Promise<PositionEntity | null | Error> {
    if (props.id !== undefined) {
      try {
        const row = (
          await this.c.var.database
            .select()
            .from(positions)
            .where(eq(positions.id, props.id))
            .limit(1)
        )[0]
        return row === undefined ? null : PositionEntity.restore(row)
      } catch (cause) {
        return cause instanceof Error ? cause : new Error("failed to find Company position")
      }
    }

    try {
      const row = (
        await this.c.var.database
          .select()
          .from(positions)
          .where(eq(positions.code, props.code))
          .limit(1)
      )[0]
      return row === undefined ? null : PositionEntity.restore(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find Company position")
    }
  }

  async countCurrentAssignments(name: string): Promise<number | Error> {
    try {
      const row = await this.c.var.database
        .select({ total: count() })
        .from(organizationAssignmentPeriodVersions)
        .where(
          and(
            eq(organizationAssignmentPeriodVersions.positionTitle, name),
            eq(organizationAssignmentPeriodVersions.isVoid, false),
            sql`${organizationAssignmentPeriodVersions.revision} = (
              SELECT max(latest.revision)
              FROM company_organization_assignment_period_versions AS latest
              WHERE latest.period_id = ${organizationAssignmentPeriodVersions.periodId}
            )`,
          ),
        )
      return row[0]?.total ?? 0
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to count Company position usage")
    }
  }

  async create(entity: PositionEntity): Promise<PositionEntity | Error> {
    try {
      const props = entity.toProps()
      const row = (
        await this.c.var.database
          .insert(positions)
          .values({
            code: props.code,
            name: props.name,
            rank: props.rank,
            description: props.description,
            createdAt: props.createdAt,
          })
          .returning()
      )[0]
      return row === undefined
        ? new Error("failed to create Company position")
        : PositionEntity.restore(row)
    } catch (cause) {
      return isCompanyUniqueConstraintError(cause)
        ? new CompanyUniqueConstraintError("position code already exists", { cause })
        : cause instanceof Error
          ? cause
          : new Error("failed to create Company position")
    }
  }

  async update(entity: PositionEntity): Promise<PositionEntity | null | Error> {
    const props = entity.toProps()
    if (props.id === null) return new Error("cannot update an unsaved Company position")
    try {
      const row = (
        await this.c.var.database
          .update(positions)
          .set({
            code: props.code,
            name: props.name,
            rank: props.rank,
            description: props.description,
          })
          .where(eq(positions.id, props.id))
          .returning()
      )[0]
      return row === undefined ? null : PositionEntity.restore(row)
    } catch (cause) {
      return isCompanyUniqueConstraintError(cause)
        ? new CompanyUniqueConstraintError("position code already exists", { cause })
        : cause instanceof Error
          ? cause
          : new Error("failed to update Company position")
    }
  }

  async delete(entity: PositionEntity): Promise<boolean | Error> {
    const id = entity.toProps().id
    if (id === null) return new Error("cannot delete an unsaved Company position")
    try {
      return (
        (await this.c.var.database.delete(positions).where(eq(positions.id, id)).returning())
          .length === 1
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to delete Company position")
    }
  }
}
