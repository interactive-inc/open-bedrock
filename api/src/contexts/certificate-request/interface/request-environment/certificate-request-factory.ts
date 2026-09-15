import type { CertificateRequestContext } from "@/contexts/certificate-request/configuration/certificate-request-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type CertificateRequestHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & CertificateRequestContext["env"]
  Variables: SystemHonoEnv["Variables"] & CertificateRequestContext["var"]
}>

export const certificateRequestFactory = createFactory<CertificateRequestHonoEnv>()
