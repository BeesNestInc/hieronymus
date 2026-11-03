# このフォルダの説明

このフォルダには、AI エージェント実行に関わるコードと資産を置く。

## ファイルと概要

* [mcp/](./mcp/) — MCP サーバ群（voucher-mcp / expense-mcp。Legion 側 sandbox からも利用される）
* [skills/](./skills/) — スキル資産
* [manifest-engine/](./manifest-engine/) — legion-manifest-engine（submodule）。
  Manifest/executeLLM 等、LLM agent 実行メカニズム。hooks 経由で host（kaikei）固
  有実装（modelProvider 等）を注入して使う。詳細は
  [manifest-engine/README.md](./manifest-engine/README.md) と
  [../Docs/opencode.md](../Docs/opencode.md) を参照
