# prompt-templates

manifest-engine の systemPrompt テンプレート（ejs）。`<TEMPLATE_DIR>/<名前>.md` を
`ai/host/index.js` が設定した `TEMPLATE_DIR`（このフォルダ。 bin/www 未指定時に
`ai/prompt-templates` を設定）から読む。

- [standard.md](./standard.md) — 全 manifest 共通の基本方針（出力形式の厳守、null、JSON 等）。個別 manifest のテンプレはこれを内包した設計にしなくてもよい（systemPrompt は1ファイル1テンプレ）。

##規約

- 個別テンプレートは `ai/manifests/*.js` の `systemPrompt` 名と同名の `.md`
- manifest 本体は `ai/manifests/`（Phase 1 で作る）。プロンプトの文面調整は
  コードではなくこのフォルダの .md で行う
