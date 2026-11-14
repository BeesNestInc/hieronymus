// AI設定パネルのモデルカタログ。「十分な機能を持つ」（text/image/pdf 受容・
// 構造化出力対応）モデルだけを並べる。パネルでは provider / accepts /
// structuredOutput を見せず、このリストからの選択に寄せる
// （カタログ外の構成は manual エントリの下で上級者向けに残す）。
// モデルの追加・価格等の確認はカタログへの追記で行う。

export const MODEL_CATALOG = [
  {
    key: 'gemini-3-5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    note: '軽量。現行の標準構成',
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite'
  },
  {
    key: 'gemini-2-0-flash',
    label: 'Gemini 2.0 Flash',
    note: '旧世代。安定動作用',
    provider: 'gemini',
    model: 'gemini-2.0-flash'
  },
  {
    key: 'muse-spark',
    label: 'muse-spark（opencode.ai ゲートウェイ）',
    note: 'opencode.ai のAPIキーが必要',
    provider: 'opencode_openai',
    model: 'muse-spark-1.3-contributor',
    baseURL: 'https://opencode.ai/zen/go/v1'
  },
  {
    key: 'manual',
    label: '手動設定（上級者向け）',
    note: 'プロバイダ・モデル名などを直接指定する',
    manual: true
  }
];

// カタログエントリを patch に展開する（manual/未知キーは素通し）
export const expandCatalogPatch = (patch) => {
  const hit = MODEL_CATALOG.find((e) => ( e.key === patch.catalogKey && !e.manual ));
  if ( !hit ) {
    return patch;
  }
  return {
    ...patch,
    description: hit.label,
    provider: hit.provider,
    model: hit.model,
    baseURL: hit.baseURL || '',
    accepts: hit.accepts ? [ ...hit.accepts ] : [ 'text', 'image', 'pdf' ],
    structuredOutput: true
  };
};

// 現在の先頭候補がカタログのどのエントリに一致するか（なければ manual）
export const catalogKeyFor = (candidate) => {
  if ( !candidate ) {
    return 'manual';
  }
  const hit = MODEL_CATALOG.find((e) => ( !e.manual &&
    ( e.provider === candidate.provider ) &&
    ( e.model === candidate.model ) &&
    ( ( e.baseURL || '' ) === ( candidate.baseURL || '' ) ) ));
  return hit ? hit.key : 'manual';
};

// パネル用の表示形（provider 等の詳細は出さない）
export const catalogInfo = () => ( MODEL_CATALOG.map((e) => (
  { key: e.key, label: e.label, note: e.note || '', manual: Boolean(e.manual) }
)) );
