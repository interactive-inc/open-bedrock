import type { EmployeeWorkStyleContext } from "@/contexts/work-style/configuration/work-style-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type EmployeeWorkStyleHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & EmployeeWorkStyleContext["env"]
  Variables: SystemHonoEnv["Variables"] & EmployeeWorkStyleContext["var"]
}>

export const employeeWorkStyleFactory = createFactory<EmployeeWorkStyleHonoEnv>()
