# セッション作業内容: 経費精算入力画面

## タスク（完了）

- [x] 1. データモデル: マイグレーション + `models/expense-report.js` / `models/expense-report-line.js` / `models/expense-mapping.js` + `models/index.js` 関連追加
- [x] 2. API: `routes/api_expense_report.js` (list/get/create/update/delete/approve/disapprove/ocr/tasks) + `routes/api_expense_mapping.js` (CRUD) + `routes/api.js` マウント
- [x] 3. 承認時自動起票: `libs/cross_slip.js` 経由で未承認伝票生成（借方=支払先マッピング、貸方=出金元マッピング、仮払金なら補助=提出者から動的解決・解決不能時はブロック）+ `crossSlipId` 関連付け
- [x] 4. AI OCR経路: `config.llms` + `libs/vision.js` + `POST /api/expense_report/ocr`（APIキー未設定時はボタン非表示）
- [x] 5. フロントエンド: `front/svelte/expense/` (expense-report / expense-list / expense-entry / expense-home) + `index.svelte` routes + `module-list.js` + ホーム `approve.svelte` 拡張
- [x] 6. MCP: `ai/mcp/expense-mcp/` (voucher-mcpパターン: マッピングCRUD + 精算情報取得/更新)
- [x] 7. ビルド + テスト(24 passing) + HTTPスモーク確認 + MCP実機確認
- [ ] 8. 完了処理: commit + `Docs/logs/20261007.md`(作成済み) + documents 修正済み（expense.md 新規、index.md・ai-integration.md 更新）

## 確定事項（設計）

- ペルソナ: 会計知識ゼロの一般従業員。UIに貸借・科目の用語は出さない
- 支払先: Company選択（キー検索/証憑から自動取得）→ 支払先マッピングで経費科目+補助科目が決定
- 出金元: マッピング選択。「個人立て替え」→仮払金(`advance=true`)、「○○銀行」→預金科目
- 内容: 自由記述（摘要）
- `voucherId`: 任意（nullable）。証憑未紐付け明細は視覚表示
- 精算: 立替精算は直ちに行わない（精算日+出金元の記録のみ）
- 承認: 既存伝票承認パターン踏襲。承認時にCrossSlipを未承認で自動起票
- MCP: マッピングCRUD + 精算情報取得/更新

## 残課題（将来）

- 証憑の「既存証憑からの選択」（slip-page の bindVoucher パターンや一覧選択）
- 立替精算（仮払金→預金の振替起票）機能
- 経費精算書の帳票出力（PDF: `Docs/精算書.xlsx` 雛形予定）
- 支払先選択のキー検索化、設定サブメニューの権限表示
- MCPの opencode 登録（運用環境側）

## 参照

- 詳細な実装記録: `Docs/logs/20261007.md`
- `knowledge/wiki/accounting/仕訳パターン.md`（仮払金補助科目=立替者ごと、仮払精算は振替）
- `Docs/精算書.xlsx`（帳票テンプレート・将来のPDF化用）
