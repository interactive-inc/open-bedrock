import packageJson from "../package.json"

const productionDeploy = packageJson.scripts.deploy
const previewDeploy = packageJson.scripts["deploy:preview"]

if (productionDeploy !== "bun run db:migrate && wrangler deploy") {
  throw new Error("production deploy must apply remote D1 migrations before promoting the Worker")
}

if (previewDeploy !== "wrangler versions upload") {
  throw new Error("preview deploy must not mutate the production database")
}

console.log("deploy safety: production migrates first; preview uploads only")
