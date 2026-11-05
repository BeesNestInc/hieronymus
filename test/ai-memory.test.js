// Phase 3-2 メモリー学習の検証（test DB 使用）:
// - Aimemories モデルの書き込み/読み/置き換え（replaceLearned の full replace）
// - memoryText の整形（空は ''・learned は見出し付き）
// - reflect-voucher manifest の登録と dry run 組立
import assert from 'assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ai/manifest-engine');
const ok = (cond) => assert.ok(Boolean(cond));

describe('ai memory（Aimemories）', () => {
  let models;
  before(async function () {
    this.timeout(30000);
    models = ( await import('../models/index.js') ).default;
    await models.sequelize.authenticate();
  });

  after(async () => {
    await models.Aimemory.destroy({ where: {} });
    await models.sequelize.close();
  });

  // このテスト群でhooks注入やdry modeをいじったものは、後続のテスト
  // （vision等は env/fetch モックで抜き打ちにLLMの動きを検証する）に
  // 漏れないよう、各テストの最後で元に戻す。engineのhooksはグローバル
  // （最後にsetしたものが生きる）なので、テスト側で巻き戻すのが責任
  const restoreHooks = async () => {
    const hooks = await import(path.join(engineRoot, 'hooks.js'));
    const { modelProvider, modelConfig, candidates } = await import('../ai/host/model-provider.js');
    hooks.setModelProvider(modelProvider);
    hooks.setModelConfigResolver(modelConfig);
    hooks.setCandidateResolver(candidates);
  };

  it('replaceLearned で置き換え（learned の full replace）ができる', async () => {
    const { replaceLearned } = await import('../ai/host/memory.js');
    const user = await models.User.create({ name: `ai-mem-test-${Date.now()}`, hashPassword: 'x' });
    const userId = user.id;
    try {
      await models.Aimemory.destroy({ where: { userId: userId } });
      const n1 = await replaceLearned(userId, [
        { key: '電気料金の取り扱い', value: '外注費（7030092）で仕分けする。中国電力が多い' },
        { key: 'Amazon返金', value: '返金は買掛金から相殺' }
      ]);
      assert.equal(n1, 2);
      const rows = await models.Aimemory.findAll({ where: { userId: userId, kind: 'learned' } });
      ok(rows.length === 2);
      // full replace: 1つを残上書き から削る → 数が減る
      const n2 = await replaceLearned(userId, [
        { key: '電気料金の取り扱い', value: '外注費（7030092）で仕分けする' }
      ]);
      assert.equal(n2, 1);
      const rows2 = await models.Aimemory.findAll({ where: { userId: userId, kind: 'learned' } });
      ok(rows2.length === 1);
      assert.equal(rows2[0].value.indexOf('Amazon'), -1);
    } finally {
      await models.Aimemory.destroy({ where: { userId: userId } });
    }
  });

  it('memoryText の整形。項目がなければ空文字', async () => {
    const { replaceLearned, memoryText } = await import('../ai/host/memory.js');
    const user = await models.User.create({ name: `ai-mem-test-${Date.now()}`, hashPassword: 'x' });
    const userId = user.id;
    try {
      assert.equal(await memoryText(userId), '');
      await replaceLearned(userId, [
        { key: 'インターネット料金', value: 'プロバイダ料は外注費（7030055）。毎月同額' }
      ]);
      const text = await memoryText(userId);
      ok(text.includes('これまでわかっていること'));
      ok(text.includes('インターネット料金: プロバイダ料は外注費（7030055）'));
    } finally {
      await models.Aimemory.destroy({ where: { userId: userId } });
    }
  });

  it('reflect-voucher manifest が dry run まで組める', async function () {
    this.timeout(30000);
    try {
    process.env.TEMPLATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ai/prompt-templates');
    process.env.LEGION_NO_DOTENV = '1';
    const { initializeAiHost } = await import('../ai/host/index.js');
    await initializeAiHost();
    const hooks = await import(path.join(engineRoot, 'hooks.js'));
    hooks.setModelProvider(async (name) => ({ modelId: name }));
    const utils = await import(path.join(engineRoot, 'libs/utils.js'));
    utils.setDebugOptions('dry');
    const { createReflectVoucher } = await import('../ai/manifests/reflect-voucher.js');
    const manifest = createReflectVoucher();
    await manifest.initialize();
    ok(manifest.model);
    const { result } = await manifest.execute({
      roles: { 'reflect-voucher': { name: 'reflect-voucher', manifests: { 'reflect-voucher': manifest } } },
      role: 'reflect-voucher',
      requests: [{ name: 'request', input: 'これまでわかっていること:\n（なし）' }],
      params: {}
    });
    assert.equal(typeof result, 'string');
    } finally {
      // 偽modelProviderとdry modeを元に戻す（後続のテストに漏らさない）
      await restoreHooks();
      const utils = await import(path.join(engineRoot, 'libs/utils.js'));
      utils.debugOptions.length = 0;
      utils.setLogLevel('none');
    }
  });
});
