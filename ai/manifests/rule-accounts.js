import { Manifest } from '../manifest-engine/manifest.js';

// 明細の経費科目提案。libs/vision.js の suggestRuleAccounts() が使う。
// カタログ・仕分け例・摘要一覧は実行時リクエスト本文に載せる（文面は
// ../prompt-templates/rule-accounts.md）。カタログ検証は host 側で行う
// （幻覚で存在しない科目コードを出しても落とす）。

// 提案のスキーマ（構造化出力用）。旧実装と同一の項目。
const RULE_SUGGEST_SCHEMA = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          account: { type: 'string' },
          subAccount: { type: ['number', 'null'] },
          reason: { type: 'string' }
        },
        required: ['pattern', 'account', 'subAccount', 'reason'],
        additionalProperties: false
      }
    }
  },
  required: ['proposals'],
  additionalProperties: false
};

export const createRuleAccounts = () => {
  return new Manifest({
    name: 'rule-accounts',
    description: '通帳・カード明細の摘要を売上原価系の経費科目（カタログ内）に分類して提案する',
    systemPrompt: 'rule-accounts',
    modelName: 'standard',
    temperature: 0.1,
    useHistory: false,
    outputSchema: RULE_SUGGEST_SCHEMA,
  });
};
