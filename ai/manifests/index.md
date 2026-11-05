# manifests

Hieronymus のAI機能ごとの Manifest 定義（legion-manifest-engine の Manifest
インスタンスを export する .js）。呼び出し側（libs/vision.js ほか）は
`initializeAiHost()`（../host/）を実行してから `manifest.execute()` を使う。

- [ocr-voucher.js](./ocr-voucher.js) — 帳票OCR（vision.js `extract()`）。
  system テンプレート: ../prompt-templates/ocr-voucher.md

## 規約

- テンプレートの文面調整は ../prompt-templates/ の .md で（コードを触らない）
- 動的データ（候補一覧等）は requests 本文へ、添付は params.chatImages
  （ファイルパス配列）へ。履歴（useHistory）は使わない、メモリーは DB から
  hosts で注入（Phase 3）
