import type { AssetContext } from "@/contexts/asset/configuration/asset-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type AssetHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & AssetContext["env"]
  Variables: SystemHonoEnv["Variables"] & AssetContext["var"]
}>

export const assetFactory = createFactory<AssetHonoEnv>()
