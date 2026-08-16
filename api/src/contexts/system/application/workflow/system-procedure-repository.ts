import type {
  ProcedureDefinition,
  ProcedureKey,
} from "@system/domain/workflow/procedure-definition.entity"

export type SystemProcedureList = Readonly<{
  definitions: ReadonlyArray<ProcedureDefinition>
  total: number
}>

export type SystemProcedureRepository = Readonly<{
  findCurrent(key: ProcedureKey): Promise<ProcedureDefinition | null | Error>
  findNumber(key: ProcedureKey): Promise<number | null | Error>
  hasProposals(key: ProcedureKey): Promise<boolean | Error>
  listActive(
    input: Readonly<{
      category: string | null
      limit: number
      offset: number
    }>,
  ): Promise<SystemProcedureList | Error>
  publish(
    definition: ProcedureDefinition,
    expectedRevision: number,
  ): Promise<true | "revision_conflict" | Error>
  retire(
    input: Readonly<{
      key: ProcedureKey
      expectedRevision: number
      retiredAt: Date
    }>,
  ): Promise<true | "not_found" | "revision_conflict" | Error>
}>
