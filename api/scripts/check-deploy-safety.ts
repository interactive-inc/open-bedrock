import packageJson from "../package.json"

const productionDeploy = packageJson.scripts.deploy
const remoteMigrate = packageJson.scripts["db:migrate"]
const remoteCheck = packageJson.scripts["db:check:remote"]
const previewDeploy = packageJson.scripts["deploy:preview"]

if (productionDeploy !== "bun run db:migrate && wrangler deploy") {
  throw new Error("production deploy must apply remote D1 migrations before promoting the Worker")
}

if (
  remoteMigrate !== "bun run db:check:remote && wrangler d1 migrations apply bedrock --remote" ||
  remoteCheck !== "bun scripts/check-remote-migration-journal.ts --config wrangler.jsonc"
) {
  throw new Error("remote DDL must follow the read-only migration journal check")
}

if (previewDeploy !== "wrangler versions upload") {
  throw new Error("preview deploy must not mutate the production database")
}

console.log(
  "deploy safety: production checks the remote journal before DDL and promotion; preview uploads only",
)
