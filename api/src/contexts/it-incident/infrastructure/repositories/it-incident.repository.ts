import { ItIncident } from "@/contexts/it-incident/domain/entities/it-incident.entity"
import type { Context } from "@/env"
import { itIncidents } from "@/contexts/it-incident/infrastructure/schema/it-incident"
import { and, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class ItIncidentRepository {
  constructor(private readonly c: Context) {}

  /** 発生日時の新しい順で返す。status で絞り込める。 */
  async findAll(props: {
    status: "open" | "resolved" | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ItIncident> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(itIncidents)
        .where(toWhere(props.status))
        .orderBy(desc(itIncidents.occurredAt))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => ItIncident.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load it_incidents")
    }
  }

  async count(status: "open" | "resolved" | null): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(itIncidents)
        .where(toWhere(status))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count it_incidents")
    }
  }

  async findById(id: number): Promise<ItIncident | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(itIncidents)
        .where(eq(itIncidents.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ItIncident.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load it_incident")
    }
  }

  async create(incident: ItIncident): Promise<ItIncident | Error> {
    try {
      const rows = await this.c.var.database
        .insert(itIncidents)
        .values({
          occurredAt: incident.occurredAt,
          title: incident.title,
          summary: incident.summary,
          severity: incident.severity,
          status: incident.status,
          resolvedAt: incident.resolvedAt,
          createdAt: incident.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert it_incident") : ItIncident.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert it_incident")
    }
  }

  async update(incident: ItIncident): Promise<ItIncident | null | Error> {
    try {
      if (incident.id === null) {
        return new Error("cannot update unsaved it_incident")
      }

      const rows = await this.c.var.database
        .update(itIncidents)
        .set({
          occurredAt: incident.occurredAt,
          title: incident.title,
          summary: incident.summary,
          severity: incident.severity,
          status: incident.status,
          resolvedAt: incident.resolvedAt,
        })
        .where(eq(itIncidents.id, incident.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ItIncident.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update it_incident")
    }
  }
}

/** status 絞り込み条件を組み立てる。未指定は全件。 */
function toWhere(status: "open" | "resolved" | null): SQL | undefined {
  const conditions: Array<SQL> = []

  if (status !== null) {
    conditions.push(eq(itIncidents.status, status))
  }

  return conditions.length === 0 ? undefined : and(...conditions)
}
