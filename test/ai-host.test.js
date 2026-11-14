// ai/host/model-provider の llms 群解決の検証（network 不使用）。
// config/llms.yaml（Legion 形式）を engine hooks の形で解決できることを確認する。
import assert from 'assert';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
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

  describe('管理者パネル用の standard 先頭候補の読み書き', () => {
    let tmpDir;
    let src;
    let dst;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-panel-test-'));
      src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/llms-group-test.yaml');
      dst = path.join(tmpDir, 'llms.yaml');
      fs.copyFileSync(src, dst);
      process.env.LLM_CONFIG_PATH = dst;
      delete process.env.LLM_PROVIDER;
      delete process.env.LLM_MODEL;
      delete process.env.LLM_API_KEY;
      delete process.env.LLM_BASE_URL;
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('先頭候補だけを更新し、他の候補・群を壊さない', async () => {
      const mp = await import('../ai/host/model-provider.js');
      const result = mp.updateStandardCandidate({
        provider: 'openai-compatible',
        model: 'test-model-2',
        apiKey: 'new-key',
        baseURL: 'http://test.local/v2',
        accepts: [ 'text', 'image' ],
        structuredOutput: false
      });
      ok(!result.error);
      assert.equal(result.candidate.provider, 'openai-compatible');
      assert.equal(result.candidate.model, 'test-model-2');
      // 保存内容が読み込み側に反映される（毎回再読込）
      const s = mp.settings();
      assert.equal(s.provider, 'openai-compatible');
      assert.equal(s.model, 'test-model-2');
      // 他群（alternate）と standard 群の件数は保持される
      assert.equal(mp.candidates('standard').length, 1);
      assert.equal(mp.candidates('alternate').length, 2);
      assert.equal(mp.candidates('alternate')[1].name, 'standard');
    });

    it('apiKey をマスクして返し、空欄保存で既存キーを維持する', async () => {
      const mp = await import('../ai/host/model-provider.js');
      const info = mp.standardCandidateInfo();
      // 生キーは返らない（test-key が露出しない）
      ok(JSON.stringify(info).indexOf('test-key') === -1);
      assert.equal(info.candidate.apiKeyMasked, 'test***');
      // 空欄のまま保存してもキーは消えない
      const result = mp.updateStandardCandidate({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: ''
      });
      ok(!result.error);
      assert.equal(mp.settings().apiKey, 'test-key');
      // 新しいキーを入れれば差し変わる
      const result2 = mp.updateStandardCandidate({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: 'replaced-key'
      });
      ok(!result2.error);
      assert.equal(mp.settings().apiKey, 'replaced-key');
    });

    it('structuredOutput は false のときだけ書き出される', async () => {
      const mp = await import('../ai/host/model-provider.js');
      ok(mp.standardCandidateInfo().candidate.structuredOutput === true);
      const result = mp.updateStandardCandidate({
        provider: 'openai-compatible',
        model: 'no-struct',
        baseURL: 'http://test.local/v1',
        structuredOutput: false
      });
      ok(!result.error);
      ok(result.candidate.structuredOutput === false);
      assert.equal(mp.modelConfig('standard').structuredOutput, false);
      // true で保存すると yaml からキーが消える（未書き = true）。
      // 検索は standard 群の先頭エントリに限る（alternate 群にも同名キーがある）
      const result2 = mp.updateStandardCandidate({
        provider: 'openai-compatible',
        model: 'no-struct',
        baseURL: 'http://test.local/v1',
        structuredOutput: true
      });
      ok(!result2.error);
      const parsed = ( await import('js-yaml') ).load(fs.readFileSync(dst, 'utf-8'));
      ok(parsed.llms.standard[0].structuredOutput === undefined);
      ok(mp.modelConfig('standard').structuredOutput === true);
    });

    it('不正な入力は保存せずエラーを返す', async () => {
      const mp = await import('../ai/host/model-provider.js');
      const before = fs.readFileSync(dst, 'utf-8');
      // 未対応プロバイダ
      ok(mp.updateStandardCandidate({
        provider: 'unknown', model: 'x', apiKey: ''
      }).error);
      // モデル名なし
      ok(mp.updateStandardCandidate({
        provider: 'gemini', model: '', apiKey: ''
      }).error);
      // openai系なのに baseURL なし（既存キーはあるが baseURL が要件）
      ok(mp.updateStandardCandidate({
        provider: 'openai-compatible', model: 'x', apiKey: ''
      }).error);
      // gemini なのに既存キーがなく apiKey も空
      process.env.LLM_CONFIG_PATH = path.join(tmpDir, 'empty.yaml');
      fs.writeFileSync(path.join(tmpDir, 'empty.yaml'), 'llms:\n  standard: []\n', 'utf-8');
      ok(mp.updateStandardCandidate({
        provider: 'gemini', model: 'x', apiKey: ''
      }).error);
      // 何も書き換わっていない
      assert.equal(fs.readFileSync(dst, 'utf-8'), before);
    });

    it('standard 群が無い設定に先頭候補を作る', async () => {
      process.env.LLM_CONFIG_PATH = path.join(
        path.dirname(dst), 'no-standard.yaml'
      );
      fs.writeFileSync(process.env.LLM_CONFIG_PATH, 'llms:\n  other:\n  - provider: gemini\n    model: m1\n    apiKey: k\n', 'utf-8');
      const mp = await import('../ai/host/model-provider.js');
      const result = mp.updateStandardCandidate({
        provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'fresh-key'
      });
      ok(!result.error);
      assert.equal(mp.settings().model, 'gemini-2.0-flash');
      // other 群は残る（candidates() は name/accepts/alternate のみを返すので
      // model まで見るなら candidatesForGroup を使う）
      assert.equal(mp.candidatesForGroup('other')[0].model, 'm1');
    });
  });
});
