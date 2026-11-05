# host

Legion manifest-engine（`../manifest-engine/` submodule）を Hieronymus で動かす
ための host adapter。engine 本体は host 固有実装を hooks 経由で受け取る設計
（submodule 側は Legion/host に依存しない）。

## ファイルと概要

* [index.js](./index.js) — `initializeAiHost()`。hooks への注入と TEMPLATE_DIR 設定。
  AI機能（`libs/vision.js` ほか `ai/manifests/*`）はこれを通してから Manifest を使う。
* [model-provider.js](./model-provider.js) — `config/llms.yaml`（or .json）の読み込み
  （`loadConfig`/`settings`/`isAvailable`）と ai-sdk モデル生成（`makeModel`）。
  engine hooks の modelProvider と、vision.js など既存AI機能の共通もと。

## 規約

- engine 自体は submodule。変更は engine repo（`~/git/legion-manifest-engine`）で行い
  両 host で pointer bump（`../manifest-engine/README.md` 参照）
- メモリーは DB（ai_memories、Phase 3）に置く。履歴（useHistory）は使わない
