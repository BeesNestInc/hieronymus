import {assert} from 'chai';
import vision from '../libs/vision.js';

// fetchをスタブしてプロバイダ分岐を検証する（実API・DBに依存しない）。
// libs/vision.js の settings() は環境変数 > config/config.json[env].llms の順で読む。

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

describe('vision', () => {
  let origFetch;
  let origEnv;
  beforeEach(() => {
    origFetch = global.fetch;
    origEnv = {
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      LLM_MODEL: process.env.LLM_MODEL,
      LLM_API_KEY: process.env.LLM_API_KEY,
      LLM_BASE_URL: process.env.LLM_BASE_URL
    };
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
  });
  afterEach(() => {
    global.fetch = origFetch;
    for ( const k of Object.keys(origEnv) ) {
      if ( origEnv[k] === undefined ) {
        delete process.env[k];
      } else {
        process.env[k] = origEnv[k];
      }
    }
  });

  it('キー未設定ならAiNotConfigured（gemini既定）', async () => {
    assert.isFalse(vision.isAvailable());
    try {
      await vision.extract(PNG, 'image/png');
      assert.fail('throwされるはず');
    } catch (e) {
      assert.strictEqual(e.name, 'AiNotConfigured');
    }
  });

  it('gemini: inlineDataで問い合わせ、JSONを抽出する', async () => {
    process.env.LLM_API_KEY = 'dummy-key';
    let seenUrl = '';
    let seenBody = null;
    global.fetch = async (url, opts) => {
      seenUrl = url;
      seenBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '```json\n{"company":"テスト商事","amount":1100,"tax":100}\n```' }] } }]
        })
      };
    };
    const values = await vision.extract(PNG, 'image/png');
    assert.include(seenUrl, 'generativelanguage.googleapis.com');
    assert.isDefined(seenBody.contents[0].parts.find((p) => p.inlineData));
    assert.strictEqual(values.company, 'テスト商事');
    assert.strictEqual(values.amount, 1100);
    assert.strictEqual(values.tax, 100);
  });

  it('openai-compatible: chat/completionsにimage_urlで問い合わせる', async () => {
    process.env.LLM_PROVIDER = 'openai-compatible';
    process.env.LLM_MODEL = 'test-vision';
    process.env.LLM_BASE_URL = 'http://localhost:1234/v1/';
    let seenUrl = '';
    let seenBody = null;
    let seenHeaders = null;
    global.fetch = async (url, opts) => {
      seenUrl = url;
      seenBody = JSON.parse(opts.body);
      seenHeaders = opts.headers;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"company":"テスト商事","amount":1100}' } }]
        })
      };
    };
    // キーなしでもbaseURLがあれば利用可
    assert.isTrue(vision.isAvailable());
    const values = await vision.extract(PNG, 'image/png');
    assert.strictEqual(seenUrl, 'http://localhost:1234/v1/chat/completions');
    assert.strictEqual(seenBody.model, 'test-vision');
    assert.strictEqual(seenBody.response_format.type, 'json_object');
    const imgPart = seenBody.messages[0].content.find((p) => p.type === 'image_url');
    assert.isTrue(imgPart.image_url.url.startsWith('data:image/png;base64,'));
    assert.notProperty(seenHeaders, 'Authorization');
    assert.strictEqual(values.company, 'テスト商事');
  });

  it('openai-compatible: baseURLなしはAiNotConfigured', async () => {
    process.env.LLM_PROVIDER = 'openai-compatible';
    assert.isFalse(vision.isAvailable());
    try {
      await vision.extract(PNG, 'image/png');
      assert.fail('throwされるはず');
    } catch (e) {
      assert.strictEqual(e.name, 'AiNotConfigured');
    }
  });

  it('未対応プロバイダはAiApiError', async () => {
    process.env.LLM_PROVIDER = 'unknown-ai';
    process.env.LLM_API_KEY = 'dummy-key';
    try {
      await vision.extract(PNG, 'image/png');
      assert.fail('throwされるはず');
    } catch (e) {
      assert.strictEqual(e.name, 'AiApiError');
    }
  });

  it('API異常時はAiApiError', async () => {
    process.env.LLM_API_KEY = 'dummy-key';
    global.fetch = async () => ({ ok: false, status: 429 });
    try {
      await vision.extract(PNG, 'image/png');
      assert.fail('throwされるはず');
    } catch (e) {
      assert.strictEqual(e.name, 'AiApiError');
    }
  });
});
