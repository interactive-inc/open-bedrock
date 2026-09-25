import { afterAll } from "bun:test"
import { stopLocalD1 } from "@tests/d1/support/start-local-d1"

// 全testファイルの後に、プロセスで共有したローカルD1のworkerdと作業ディレクトリを片付ける。
afterAll(async () => {
  await stopLocalD1()
})
