import { Manifest } from '../manifest-engine/manifest.js';

// 会計メモリーの振り返り。libs/cross_slip.js（承認イベント）から呼ばれ、
// 承認済み伝票 Sinatraと現状メモリーから「ユーザーの定番パターン」を
// 更新する。出力は {"memories":[{key,value}]}（scripts/ai/memory hook が
// replaceLearned で置き換える）。
const REFLECT_SCHEMA = {
  type: 'object',
  properties: {
    memories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' }
        },
        required: [ 'key', 'value' ],
        additionalProperties: false
      }
    }
  },
  required: [ 'memories' ],
  additionalProperties: false
};

export const createReflectVoucher = () => {
  return new Manifest({
    name: 'reflect-voucher',
    description: '承認済み伝票からユーザーの定番パターンを観察してメモリーを書き換える',
    systemPrompt: 'reflect-voucher',
    modelName: 'standard',
    temperature: 0.2,
    useHistory: false,
    outputSchema: REFLECT_SCHEMA,
  });
};
