import { MIGRATED_SLOT_COUNT, startLocalD1 } from "@tests/d1/support/start-local-d1"

export type LocalD1Pool = Readonly<{
  /** まだ誰も使っていないmigration済みDBを返す。同じDBを二度返さない。 */
  next: () => Promise<D1Database>
  dispose: () => Promise<void>
}>

/**
 * 1ファイルで宣言できる上限までmigration済みDBを用意し、呼ばれた順に1つずつ渡す。
 * templateの複製は最初に使う時に行うため、使わなかった枠は費用にならない。
 * 共通fixtureがtestごとにDBを作る場合に、DB名をfixtureの引数へ通さずに済ませる。
 * 上限を超えて求めたら失敗させ、DBを共有しない。
 */
export async function startLocalD1Pool(): Promise<LocalD1Pool> {
  const names = Array.from({ length: MIGRATED_SLOT_COUNT }, (_, index) => `pooled-${index}`)
  const local = await startLocalD1({ migrated: names })
  let used = 0

  return {
    next: async () => {
      const name = names[used]
      if (name === undefined) {
        throw new Error(`local D1 pool is exhausted after ${MIGRATED_SLOT_COUNT} databases`)
      }
      used += 1
      return local.database(name)
    },
    dispose: () => local.dispose(),
  }
}
