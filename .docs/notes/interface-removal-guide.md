# リポジトリ interface 廃止 + 書き込みユースケースのクラス化 ガイド

各ドメインで「リポジトリの interface 型ファイルを廃止し、書き込みユースケースを Context 注入クラスにする」。`expense` が完成手本。

## 設計（確定）

1. **書き込みユースケースは Context 注入クラス**にする。`export class Xxx { constructor(private readonly c: Context) {} async run(command: Command): Promise<...> { const repo = new D1XxxRepository(this.c); ... } }`。リポジトリは props で受けず、run の中で `new D1XxxRepository(this.c)` する。
   - 手本: src/application/expense/submit-expense.ts（SubmitExpense）, decide-expense.ts（DecideExpense、複数リポジトリを内部 new）。
   - route は `new Xxx(c).run(command)` で呼ぶ（手本: src/interface/expense/route.ts, [id]/approve/route.ts, [id]/reject/route.ts）。
2. **リポジトリ実装から `implements XxxRepository` を外す**（クラスが型なので不要）。手本: src/infrastructure/expense/d1-expense-repository.ts（implements なし）。
3. **リポジトリ interface 型ファイル（src/domain/<domain>/<x>-repository.ts のうち `export type XxxRepository = {...}`）を削除**する。
4. **リポジトリに付随する入力型**（XxxCreateInput, XxxUpdateInput 等、interface ファイル内に同居していたもの）は `src/domain/<domain>/<x>-inputs.ts` に移して残す。これらを使う純粋関数（to-_-create-input 等）とリポジトリの import 元を `_-inputs` に張り替える。手本: src/domain/expense/expense-inputs.ts, expense-approval-inputs.ts。
5. **read 専用になったリポジトリメソッドを削除**。read を route 直叩きにした結果、findMany/findInbox/countByStatus 等が未使用になっているはず（grep で参照0を確認）。リポジトリは write 経路で実際に使うメソッド（findById/create/updateStatus 等）だけ残す。dashboard 等が count を使う場合はそのメソッドは残す（参照を確認）。
6. ユースケースのうち**書き込みでないもの（read 直叩き化で消えたはず）は対象外**。既に削除済み。残っている write ユースケース（create/submit/decide/approve/update/delete 系）をクラス化する。

## 制約

- @/ 絶対パス、type のみ、throw 禁止（T|Error）、destructuring 禁止、1ファイル1クラス、const のみ、セミコロンは付けてよい。
- application 層が infrastructure（D1XxxRepository）を import するのは、この設計では許容（参考リポジトリと同じ）。
- 個人情報を持ち込まない。

## 完了確認

- bun test src/interface/<domain>/<domain>-route.test.ts が pass。
- grep で src/domain/<domain> に `export type .*Repository = {` が残っていないこと（interface 廃止）。
- grep で src/infrastructure/<domain> の d1-\*.ts に `implements` が無いこと。
- 書き込みユースケースが `export class` + `constructor(private readonly c: Context)` + `run()` になっていること。
- route が `new Xxx(c).run(...)` を呼ぶこと（旧: `xxx(props, command)` 関数呼び出しが残っていない）。

## 報告

削除した interface ファイル、作成した inputs ファイル、クラス化した write ユースケース、削除した未使用リポジトリメソッド、テスト結果を報告する。
