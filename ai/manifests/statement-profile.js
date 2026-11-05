import { Manifest } from '../manifest-engine/manifest.js';

// 明細プロファイルyamlの起草。libs/vision.js の draftStatementProfile() が使う。
// kindHint・取り込みデータ・AI読取結果は実行時リクエスト本文に載せる
// （文面は ../prompt-templates/statement-profile.md）。出来上がった yaml の
// 検証（決定的解析が一致するか）は呼び出し側（libs/bank-statement.js）が行う。
// 構造化出力用のスキーマは {profile: string} のみ。

const PROFILE_DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    profile: { type: 'string' }
  },
  required: [ 'profile' ],
  additionalProperties: false
};

export const createStatementProfile = () => {
  return new Manifest({
    name: 'statement-profile',
    description: '明細取り込みの書式（CSV/カードPDF/計算書）を決定的に解析する yaml プロファイルを起草する',
    systemPrompt: 'statement-profile',
    modelName: 'standard',
    // 標本書式の記述正確さ優先。低く固定
    temperature: 0.1,
    useHistory: false,
    outputSchema: PROFILE_DRAFT_SCHEMA,
  });
};
