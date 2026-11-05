# 経費精算モジュールの内部構造

経費精算の内部の現在地（明細取込との連携・伝票統合・AIの結線を含む）。
ユーザー向けの操作説明は [documents/expense.md](../documents/expense.md)、
伝票統合の仕様（入出金両方向）は [bank-statement-merge.md](bank-statement-merge.md)。

参照場所の早見:

| 場所 | 担当 |
|---|---|
| `libs/expense.js` | 精算書→仕訳の組み立て（明細マッピング・税区分導出・グルーピング・起票） |
| `libs/bank-reconcile.js` | 統合（OUT merge）と個人カード明細→精算書明細の変換 |
| `routes/api_expense_report.js` | 精算書のCRUD・承認・OCR・証憑（未整理の証憑含む） |
| `routes/api_expense_mapping.js` | 支払先/出金元マッピングの設定 |
| `front/svelte/expense/*` | 精算書入力・一覧・マッピング・未整理の証憑・カード明細モーダル |
| `routes/api.js` | URL結線（`/expense_report/*`、`/expense_mapping`、カード明細の選択は `/bank_statement/:id/select`） |

## 精算書 → 仕訳の組み立て

### buildSlipLines: 明細 → 伝票明細

1明細 = 借貸1組:

- **借方** = 支払先マッピングの科目（+補助）。マッピング未登録・科目未設定は
  明細単位でエラー（`ExpenseMappingNotFound`）
- **貸方** = 出金元マッピングの科目。立替フラグ（`advance`）のときだけ、
  貸方補助を**提出者から動的解決**（`resolveAdvanceSubAccount`）:
  メンバの tradingName/legalName に応じた仮払金の補助を照合する
  （「椋立替」等のマッピング名に含まれる立替者名を先に見る）。
  解決できなければエラー（`ExpenseSubAccountNotFound`）
- 税ルールは `deriveTaxRuleId`: 会計知識なしの設計で、借方科目の
  `taxClass = 1`（**内税**）のときだけ科目から税ルールを導出する。
  taxClass = 2（外税）は税0で載せて経理が伝票側で調整する前提
- 摘要 = 明細の内容（`application1`）、備考 = `application2`

### groupLines: 1精算書 = 複数の伝票

分割キーは **（支払日 × 出金元マッピング）**。例外を加える:

- `noBundle`（支払先マッピングのフラグ）の行は1行1伝票に分離する
  （同日の別振込を区別できる）
- 支払日未入力の行は1つの組にまとめる（伝票日付 = 提出日）

### createSlipForReport: 承認 → 起票

- 伝票ごとに税計算（`recalcSlipLines` / `validateLines` / `validateBalanced`）と
  会計年度（`loadTaxContext`。伝票日付の期が無ければエラー）を検証して
  `createCrossSlip` で起票。`term` は伝票日付から補う
- **承認者が会計権限を持つ場合だけ同時承認**（`simultaneous`。精算書の承認 =
  伝票の承認も実施。会計権限のない承認者は伝票は承認待ちのまま残す。
  暗黙の `approvedAt` は承認フローで付く）
- 起票された伝票に `expenseReportId` を付け、明細行にも `crossSlipId` を記録
- **再承認**: 未承認の紐付伝票は削除して作り直す（伝票番号は変わり欠番になる）。
  承認済みの伝票は絶対に触れない
- **OUT merge**: 起票の直後に `findSpendMergeCandidates` /
  `mergeSpendIntoPlaceholder` を1回試す（**出金仮の仮伝票に統合できるなら統合**。
  候補がちょうど1つのときだけ自動）。詳細は
  [bank-statement-merge.md](bank-statement-merge.md) の「OUT」の節

## 個人カード明細 → 精算書の明細

`selectForExpense`（`libs/bank-reconcile.js`）:
取り込んだ個人カードの明細（`kind: personal_card`）のチェック行を
`ExpenseReportLine` として精算書に**追加**し、取込行は `status: selected` +
`expenseReportLineId` で目印を打つ。

- 明細の `lineNo` は**既存の明細の末尾に詰め直し**（精算書は順序で操作する前提）
- 起票済み・選択済みの行は skip
- 明細の description/amount が精算書明細の初期値。支払日・支払先は
  画面で設定する（未確定なら精算画面で選ぶ）
- ルートは `POST /api/bank_statement/:id/select`（会計権限がない場合は
  自分の精算書のみ）。UI は明細取込側のモーダル（`card-statement-modal.svelte`）。
  ドキュメント: documents/bank-statement.md の「個人カードの立替精算」

## AIの結線

`routes/api_expense_report.js` の `ocr`:

- 証憑の画像/PDFを **ocr-voucher manifest**（Legion engine）で読む。
  `memoryUserId` を渡して **Aimemories**（承認イベント→reflect-voucher が
  学んだ定番パターン）を文脈に注入する。※現在は精算書OCRのみ接続済み
  （settlement系はまだ。接続する口は `vision.extract` の引数）
- 支払先の判定は `pickPayeeMapping`（取引先一致 + マッピングの「説明」欄との
  照合。説明はカンマ区切りのキーワード。最も合うマッピングを候補とする）
- `aiAvailable` ルートで AI設定がある環境だけボタンを出す

`expense-mcp`（`ai/mcp/expense-mcp`）: マッピングの追加/変更/取得と精算情報の
取得/更新。**起案はapprove不能**（本体AIのdraft方針と同じ）。

## 不変の制約

- **精算書から立替の戻し入れはしない**: 承認時の起票は「経費 → 仮払金」で
  仮払金に積むだけ。戻しは「仮払金精算」画面での別伝票
- **明細金額は税込**: 内税科目のときだけ税が区切られ（OCR＋税計算）、
  外税は税0で載せて経理が調整
- **提出者と立替者は別でよい**: 補助解決は提出者の名前を基準にする。
  立替者別マッピング（例: 「椋立替」）があるときはマッピング名が優先
- **伝票統合は精算書側の伝票を残す**: OUT mergeでは精算書側の伝票が生きる
  （伝票日付 = 支払日・科目はマッピング側の完成形）。承認済みでも内容を変えず、
  取込明細の突合先の付け替えと仮伝票の廃棄だけが起きる

## テスト

- `test/expense.test.js`: buildSlipLines/grouping/deriveTaxRuleId/起票系
- `test/card-merge.test.js`: OUT merge（happy / 複数候補 / 日付超過 / 仮承認済み）
- 伝票統合全体（IN方向含む）は `test/bank-deposit-merge.test.js` と
  Docs/bank-statement-merge.md の「テスト」

## 記録

- Docs/logs/20261104.md 追記26〜29（AI・Legion engine・MCP）
- Docs/logs/20261104.md 追記32（OUT: 出金仮↔経費精算の統合）
- Docs/bank-statement-merge.md（IN/OUT両方向の伝票統合の仕様）
