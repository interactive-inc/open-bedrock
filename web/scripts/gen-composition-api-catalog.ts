import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const webRoot = resolve(import.meta.dirname, "..")
writeFileSync(
  `${webRoot}/lib/feature/composition-api-catalog.json`,
  readFileSync(`${webRoot}/../api/api-route-composition.manifest.json`),
)
