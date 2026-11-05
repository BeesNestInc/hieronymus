# このフォルダの説明

このフォルダには、AI エージェント実行に関わるコードと資産を置く。

## ファイルと概要

* [mcp/](./mcp/) — MCP サーバ群（voucher-mcp / expense-mcp。Legion 側 sandbox からも利用される）
* [skills/](./skills/) — スキル資産
* [host/](./host/) — host adapter。hooks（modelProvider 等）への注入と TEMPLATE_DIR 設定。
  AI機能は `initializeAiHost()` を通してから Manifest を使う
* [manifests/](./manifests/) — AI機能ごとの Manifest 定義（Phase 1 から追加）。
  プロンプト文面は [prompt-templates/](./prompt-templates/) の .md
* [manifest-engine/](./manifest-engine/) — legion-manifest-engine（submodule）。
  Manifest/executeLLM 等、LLM agent 実行メカニズム。hooks 経由で host（kaikei）固
  有実装（modelProvider 等）を注入して使う。
  **coding agent は manifest-engine/README.md を読んでからコードを書くこと**
  （変更手順・Manifest API・hooks リファレンス・チェックリストが載っている）
