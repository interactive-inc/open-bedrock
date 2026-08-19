import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemDatabaseContext,
  SystemEmailContext,
  SystemJwtSecretContext,
  SystemOidcSigningContext,
  SystemPasswordHashContext,
} from "@system/infrastructure/configuration/system-context"
import { createFactory } from "hono/factory"

type SystemInterfaceContext = SystemDatabaseContext &
  SystemClockContext &
  SystemAuthorizationContext &
  SystemJwtSecretContext &
  SystemOidcSigningContext &
  SystemPasswordHashContext &
  SystemEmailContext

/** System InterfaceがHonoを利用するための、製品APIから独立した最小Env。 */
export type SystemHonoEnv = Readonly<{
  Bindings: SystemInterfaceContext["env"]
  Variables: SystemInterfaceContext["var"]
}>

export const systemFactory = createFactory<SystemHonoEnv>()
