// engine（legion-manifest-engine submodule）の最小 harness。
// kaikei 側の node_modules 解決下で engine が boot することと、
// hooks 注入（modelProvider と templateDir）の基本形を確認する。
// network は使わない（dry run / モデル偽装のみ）。
import assert from 'assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ai/manifest-engine');

// dry run はエンジンのモジュールレベルの状態（debugOptions）。テスト群の中で
// 後続のテスト（visionのfetchモック等）に dry を漏らさないため、テストごとに
// 元に戻すヘルパ（debugOptionsは配列なのでin-placeで空に戻せる）
const withDryRun = async (fn) => {
  const utils = await import(path.join(engineRoot, 'libs/utils.js'));
  utils.setDebugOptions('dry');
  try {
    return await fn(utils);
  } finally {
    utils.debugOptions.length = 0;
    utils.setLogLevel('none');
  }
};

describe('manifest-engine', function () {
  it('hooks 注入で Manifest が dry run まで通る', async function () {
    const hooks2 = await import(path.join(engineRoot, 'hooks.js'));
    const origProvider = hooks2.getModelProvider();
    try {
    await withDryRun(async (utils) => {
    process.env.TEMPLATE_DIR = path.join(engineRoot, 'tests/prompt-templates');
    process.env.LEGION_NO_DOTENV = '1';
    const { Manifest } = await import(path.join(engineRoot, 'manifest.js'));
    const hooks = await import(path.join(engineRoot, 'hooks.js'));

    // 会計 app 側で modelProvider を注入する形（ai-sdk のモデルオブジェクトを返す想定）。dry run では呼ばれない
    hooks.setModelProvider(async (name) => ({ modelId: name }));

    const m = new Manifest({
      name: 'summarize-latest',
      description: '帳票メモの要約（例）',
      systemPrompt: 'standard',
      messagePrompt: '次の文章を要約してください:',
      modelName: 'standard',
      temperature: 0.5,
      params: {},
    });
    await m.initialize();
    assert.ok(m.model, 'modelProvider が解決される');

    const { inputs, result } = await m.execute({
      roles: { 'summarize-latest': { name: 'summarize-latest', manifests: { 'summarize-latest': m } } },
      role: 'summarize-latest',
      requests: [{ name: 'request', input: 'テスト本文。今日は会計の締切が nine 时まで。' }],
      params: {},
    });
    assert.ok(Array.isArray(inputs) && inputs.length > 0, 'inputs が組み立てられる');
    assert.equal(typeof result, 'string', 'dry run が文字列を返す');
    });
    } finally {
      // 偽modelProviderはグローバル。後続のテスト（vision等）に漏らさない
      hooks2.setModelProvider(origProvider);
    }
  });

  it('ai/host の initializeAiHost で hooks が結線される', async function () {
    // bin/www と同じく明示的に指定する（先行テストが engine 固有の
    // TEMPLATE_DIR を設定して削除済みの場合、host の初期化は実行済みのため
    // 再設定されない。TEMPLATE_DIR の host 既定値は vision.test.js 側の
    // 結線テストが初回 import 時に保証する）
    process.env.TEMPLATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ai/prompt-templates');
    process.env.LEGION_NO_DOTENV = '1';
    const { initializeAiHost } = await import('../ai/host/index.js');
    await initializeAiHost();

    const { getTemplateDir, getModelProvider, getModelConfigResolver, getToolTable, getMcpTools } =
      await import(path.join(engineRoot, 'hooks.js'));

    assert.ok(getTemplateDir().replace(/\\/g, '/').includes('ai/prompt-templates'),
      `TEMPLATE_DIR が host の prompt-templates を指す（実際: ${getTemplateDir()}）`);
    // dry run で host テンプレートから system prompt が組めることの前段
    assert.ok(typeof getModelProvider() === 'function', 'modelProvider が注入されている');
    assert.ok(typeof getModelConfigResolver() === 'function', 'modelConfigResolver が注入されている');
    assert.ok(getToolTable(), 'toolTable が注入されている');
    assert.ok(getMcpTools(), 'mcpTools が注入されている');

    // dry run で host テンプレートから system prompt が組めること（テキストの通過確認。
    // network 不使用）。dryはテストの間だけ（後続に漏らさない）
    await withDryRun(async () => {
      const { Manifest } = await import(path.join(engineRoot, 'manifest.js'));
      const m = new Manifest({
        name: 'host-smoke',
        description: 'host 結線のsmoke',
        systemPrompt: 'standard',
        messagePrompt: '本文: <%= hello %>',
        modelName: 'standard',
        params: { hello: { value: 'テスト' } },
      });
      await m.initialize();
      const { result } = await m.execute({
        roles: { 'host-smoke': { name: 'host-smoke', manifests: { 'host-smoke': m } } },
        role: 'host-smoke',
        requests: [{ name: 'request', input: 'x' }],
        params: { hello: { value: 'テスト' } },
      });
      assert.equal(typeof result, 'string', 'dry run が文字列を返す');
    });
  });
});
