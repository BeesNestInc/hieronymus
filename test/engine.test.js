// engine（legion-manifest-engine submodule）の最小 harness。
// kaikei 側の node_modules 解決下で engine が boot することと、
// hooks 注入（modelProvider と templateDir）の基本形を確認する。
// network は使わない（dry run / モデル偽装のみ）。
import assert from 'assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ai/manifest-engine');

describe('manifest-engine', function () {
  it('hooks 注入で Manifest が dry run まで通る', async function () {
    process.env.TEMPLATE_DIR = path.join(engineRoot, 'tests/prompt-templates');
    process.env.LEGION_NO_DOTENV = '1';
    const { Manifest } = await import(path.join(engineRoot, 'manifest.js'));
    const hooks = await import(path.join(engineRoot, 'hooks.js'));
    const { setDebugOptions } = await import(path.join(engineRoot, 'libs/utils.js'));
    setDebugOptions('dry');

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
});
