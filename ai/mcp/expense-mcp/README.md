# expense-mcp

Hieronymus（会計システム）の経費精算を操作するための MCP サーバです。

## 概要

- HTTP API 経由で動作中の Hieronymus に接続します（`/api/*`）
- セッションはログイン情報（ユーザー名/パスワード）で確立します（voucher-mcp と同じパターン）
- 経費精算マッピング（支払先/出金元と勘定科目の対応）の追加/変更/削除/取得と、経費精算書の取得/更新を提供します
- 書き込み系ツールには会計権限を持つユーザーでのログインが必要です

## セットアップ

```bash
cd ai/mcp/expense-mcp
npm install
```

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `HIERONYMUS_BASE_URL` | 任意 | 接続先（既定 `http://localhost:3010`） |
| `HIERONYMUS_LOGIN_USER` | 必須 | ログインユーザー名 |
| `HIERONYMUS_LOGIN_PASSWORD` | 必須 | パスワード |
| `HIERONYMUS_READONLY` | 任意 | `1` にすると書き込み系ツールを無効化 |

## ツール一覧

### 読み取り
| ツール | 内容 |
|---|---|
| `list_expense_mappings` | 経費精算マッピング一覧 |
| `list_expense_reports` | 経費精算書一覧（`type=not_approved` で承認待ちのみ） |
| `get_expense_report` | 経費精算書の取得（明細行を含む） |

### 書き込み（会計権限が必要）
| ツール | 内容 |
|---|---|
| `create_expense_mapping` / `update_expense_mapping` / `delete_expense_mapping` | マッピングの追加 / 変更 / 削除 |
| `update_expense_report` | 経費精算書（未承認）の更新。明細行の作成・修正に利用 |

## 経費精算の流れ

1. 利用者がWeb画面（またはAIエージェント）で経費精算書を入力・提出（承認待ち）
2. `list_expense_reports`（`type=not_approved`）で対象を特定
3. 承認権限を持つユーザーが承認すると、仕訳伝票が**未承認（承認待ち）で自動起票**され、経費精算書と関連付けられる
   - 借方 = 支払先マッピングの経費科目（+補助科目）
   - 貸方 = 出金元マッピングの科目。「個人立て替え」（`advance=true`）の場合は仮払金（提出者から補助科目を自動解決。解決できない場合は起票がブロックされる）
4. 仕訳伝票の確定は既存の伝票承認フロー（仕訳日記帳 / voucher-mcp）で行う
