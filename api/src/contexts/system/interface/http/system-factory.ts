import type {
  SystemAuthorizationContext,
  SystemBootstrapContext,
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
  SystemEmailContext,
  SystemJwtSecretContext,
  SystemOidcConfigurationContext,
  SystemOidcSigningContext,
  SystemPasswordHashContext,
  SystemRequestAuditContext,
  SystemSessionConfigurationContext,
} from "@system/infrastructure/configuration/system-context"
import { createFactory } from "hono/factory"

type SystemInterfaceContext = SystemDatabaseContext &
  SystemD1Context &
  SystemClockContext &
  SystemAuthorizationContext &
  SystemBootstrapContext &
  SystemJwtSecretContext &
  SystemOidcConfigurationContext &
  SystemOidcSigningContext &
  SystemPasswordHashContext &
  SystemSessionConfigurationContext &
  SystemRequestAuditContext &
  SystemEmailContext

/** System InterfaceがHonoを利用するための、製品APIから独立した最小Env。 */
export type SystemHonoEnv = Readonly<{
  Bindings: SystemInterfaceContext["env"]
  Variables: SystemInterfaceContext["var"]
}>

export const systemFactory = createFactory<SystemHonoEnv>()
