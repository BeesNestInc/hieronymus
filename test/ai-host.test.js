// ai/host/model-provider の Legion 形式 llms 群対応の検証（network 不使用）。
// config/llms.yaml の2書式（フラット形式と Legion 形式の群）を、
// engine hooks の形で解決できることを確認する。
import assert from 'assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ok = (cond) => assert.ok(Boolean(cond));

const fixture = (name) => {
  process.env.LLM_CONFIG_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `fixtures/${name}`);
  // 環境変数オーバーライドは群解決を無効化するので剥がす
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

  it('群形式を modelProvider / modelConfig / candidates で解決する', async () => {
    fixture('llms-group-test.yaml');
    const mp = await import('../ai/host/model-provider.js');
    ok(mp.isGroupedConfig());
    // modelProvider: gemini 候補（fixtume の standard 群1件目）
    const model = await mp.modelProvider('standard');
    assert.ok(model, 'モデルが解決される');
    // 識別: gemini プロバイダ（provider キーが 第二十応答で判別できないので
    // 設定解決側を検査する）
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

  it('フラット形式はこれまで通り settings() 経由で動く', async () => {
    fixture('llms-test.json');
    const mp = await import('../ai/host/model-provider.js');
    ok(!mp.isGroupedConfig());
    const s = mp.settings();
    // fixture llms-test.json は gemini 既定・キー無し
    assert.equal(s.provider, 'gemini');
    assert.equal(mp.isAvailable(), false);
    const model = await mp.modelProvider('standard');
    assert.ok(model, 'フラット形式でもモデルが生成される');
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
