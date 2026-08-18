# AI連携

Hieronymus は、AIエージェント（Claude Code / opencode 等）から会計データを操作するための統合基盤を提供します。リポジトリ直下の `ai/` ディレクトリに、MCPサーバとスキルを配置しています。

## 概要

```
ai/
├── skills/
│   ├── voucher-entry/      経理スキル: 証憑（画像/PDF）の読み取り・証憑登録・自動仕訳
│   └── journal-learning/   経理スキル: 仕訳パターンの学習・保守
└── mcp/
    └── voucher-mcp/        伝票入力MCPサーバ
```

## 伝票入力MCP（voucher-mcp）

会計データを操作するための MCP（Model Context Protocol）サーバです。HTTP API 経由で動作中の Hieronymus に接続します。

### 提供するツール

**読み取り**

| ツール | 内容 |
|---|---|
| `get_accounts` | 勘定科目・補助科目（税区分付き） |
| `get_companies` | 取引先一覧 |
| `get_voucher_classes` | 伝票種別 |
| `get_tax_rules` | 指定日に有効な税率ルール |
| `get_fiscal_year` | 指定年月の会計年度 |
| `get_journal` | 仕訳日記帳（仕訳パターンの学習用） |
| `get_cross_slip` | 仕訳伝票の取得 |
| `list_cross_slips` | 伝票一覧（承認待ち） |
| `list_vouchers` | 証憑一覧 |

**書き込み**

| ツール | 内容 |
|---|---|
| `create_cross_slip` / `update_cross_slip` | 仕訳伝票の作成・更新 |
| `approve_cross_slip` / `disapprove_cross_slip` | 承認・不承認 |
| `delete_cross_slip` | 伝票の削除 |
| `create_voucher` / `create_voucher_with_file` | 証憑の登録（画像/PDF添付可） |
| `update_voucher` / `delete_voucher` | 証憑の更新・削除 |
| `compute_slip_taxes` | 税額計算のプレビュー |

### セットアップ

```bash
cd ai/mcp/voucher-mcp
npm install
```

環境変数で接続先とログインユーザーを指定します。

| 変数 | 説明 |
|---|---|
| `HIERONYMUS_BASE_URL` | 接続先 URL（既定 `http://localhost:3010`） |
| `HIERONYMUS_LOGIN_USER` | ログインユーザー名 |
| `HIERONYMUS_LOGIN_PASSWORD` | パスワード |
| `HIERONYMUS_READONLY` | `1` にすると書き込みツールを無効化 |

### 権限とワークフロー

- 会計データの**作成**は認証済みユーザーなら誰でも行えます。作成した伝票は**承認待ち**になります。
- 会計データの**閲覧**（仕訳日記帳・元帳など）には会計権限または決算閲覧権限が必要です。
- **承認**は承認権限を持つユーザー（人間）のみが行えます。

## 経理スキル

`ai/skills/` に、AIエージェントが経理業務を行うためのスキルを配置しています。

- **voucher-entry**: 証憑（画像/PDF）のOCR読み取り → 証憑登録 → 自動仕訳（承認待ち）の手順
- **journal-learning**: 過去の仕訳日記帳から仕分けパターンを学習し、Wiki の仕訳パターンを保守する手順

仕訳パターンは人間が確認・編集できる Markdown で管理されます。AI は学習結果をこのパターンに反映し、人間の編集を常に優先します。
