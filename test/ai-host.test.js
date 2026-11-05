// ai/host/model-provider の llms 群解決の検証（network 不使用）。
// config/llms.yaml（Legion 形式）を engine hooks の形で解決できることを確認する。
import assert from 'assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ok = (cond) => assert.ok(Boolean(cond));

const fixture = (name) => {
  process.env.LLM_CONFIG_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `fixtures/${name}`);
  // 環境変数オーバーライドを剥がす（群解決を素の状態で見る）
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
};

describe('ai/host llms 群（Legion 形式）', () => {
  let origConfigPath;
  let origEnv;
  before(() => {
    origConfigPath = process.env.LLM_CONFIG_PATH;
    origEnv = {
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      LLM_MODEL: process.env.LLM_MODEL,
      LLM_API_KEY: process.env.LLM_API_KEY,
      LLM_BASE_URL: process.env.LLM_BASE_URL
    };
  });
  after(() => {
    process.env.LLM_CONFIG_PATH = origConfigPath;
    for ( const k of Object.keys(origEnv) ) {
      if ( origEnv[k] === undefined ) {
        delete process.env[k];
      } else {
        process.env[k] = origEnv[k];
      }
    }
  });

  it('群を modelProvider / modelConfig / candidates で解決する', async () => {
    fixture('llms-group-test.yaml');
    const mp = await import('../ai/host/model-provider.js');
    // standard 群1件目（gemini）でモデルが解決される
    const model = await mp.modelProvider('standard');
    ok(model);
    const s = mp.settings();
    assert.equal(s.provider, 'gemini');
    assert.equal(s.model, 'gemini-2.0-flash');
    // modelConfig（engine 構造化判定・accepts/alternate に渡る）
    const conf = mp.modelConfig('standard');
    ok(conf);
    assert.equal(conf.provider, 'gemini');
    assert.equal(conf.model, 'gemini-2.0-flash');
    ok(conf.structuredOutput !== false);
    // candidateResolver（群参照）: ト書き順を保持する
    const list = mp.candidates('standard');
    ok(Array.isArray(list));
    assert.equal(list[0].name, 'standard');
  });

  it('alternate と structuredOutput:false が resolver に載る', async () => {
    fixture('llms-group-test.yaml');
    const mp = await import('../ai/host/model-provider.js');
    const conf = mp.modelConfig('alternate');
    // alternate 群: 先頭候補は structuredOutput: false の openai-compatible。
    // 2件目は standard への参照（群から群参照が展開される）
    ok(conf);
    assert.equal(conf.structuredOutput, false);
    const list = mp.candidates('alternate');
    ok(Array.isArray(list) && list.length === 2);
    assert.equal(list[1].name, 'standard');
  });

  it('未定義名は standard 群にフォールバックし、未設定なら素の gemini で無効になる', async () => {
    fixture('llms-group-test.yaml');
    const mp = await import('../ai/host/model-provider.js');
    const s = mp.settings('unknown-model-name');
    assert.equal(s.provider, 'gemini');
    // config を読めない場合も素の候補が返る（AIは無効、クラッシュしない）
    process.env.LLM_CONFIG_PATH = 'test/fixtures/no-such-llms.yaml';
    const bare = mp.settings();
    assert.equal(bare.provider, 'gemini');
    ok(mp.isAvailable() === false);
  });

  it('環境変数で解決済み候補に上書きする', async () => {
    fixture('llms-group-test.yaml');
    const mp = await import('../ai/host/model-provider.js');
    process.env.LLM_MODEL = 'test-overridden';
    const s = mp.settings();
    assert.equal(s.model, 'test-overridden');
    // 群自体は上書きされない（ごとの解決用）
    assert.equal(mp.candidates('standard')[0].name, 'standard');
  });

  it('群の name 重複を検出する', async () => {
    fixture('llms-group-dup-test.yaml');
    const mp = await import('../ai/host/model-provider.js');
    const dups = mp.validateLlmsNames();
    ok(dups.length === 1);
    assert.equal(dups[0].name, 'dup-candidate');
    ok(dups[0].groups.length === 2);
  });
});
