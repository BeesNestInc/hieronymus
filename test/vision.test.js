import {assert} from 'chai';
import http from 'http';
import vision from '../libs/vision.js';

// AI SDK経路の検証（実API・DBに依存しない）。
// - gemini: global.fetch をスタブして GenerateContent 応答を返す
// - openai-compatible: ローカルのHTTPスタブに /chat/completions を生やす
// libs/vision.js の settings() は環境変数 > config/llms.json の順で読む。

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// OpenAI互換の /chat/completions スタブ。responder(body) が [status, payload] を返す
const startStub = (responder) => {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      requests.push({ url: req.url, headers: req.headers, body: body });
      const [status, payload] = responder(body);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server: server, port: server.address().port, requests: requests });
    });
  });
};

const chatCompletion = (content) => ({
  id: 'chatcmpl-test',
  object: 'chat.completion',
  created: 0,
  model: 'test-vision',
  choices: [{ index: 0, message: { role: 'assistant', content: content }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
});

describe('vision.fixEraDate', () => {
  it('20未満の年は令和として+2018する（西暦そのままの年は触らない）', () => {
    assert.equal(vision.fixEraDate('7-05-10'), '2025-05-10');
    assert.equal(vision.fixEraDate('0007-05-10'), '2025-05-10');
    assert.equal(vision.fixEraDate('2026-05-10'), '2026-05-10');
    assert.equal(vision.fixEraDate('2025-12-31'), '2025-12-31');
    assert.isNull(vision.fixEraDate('令和7年5月10日'));
    assert.isNull(vision.fixEraDate(null));
  });
});

describe('vision', () => {
  let origFetch;
  let origEnv;
  beforeEach(() => {
    origFetch = global.fetch;
    origEnv = {
      LLM_CONFIG_PATH: process.env.LLM_CONFIG_PATH,
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      LLM_MODEL: process.env.LLM_MODEL,
      LLM_API_KEY: process.env.LLM_API_KEY,
      LLM_BASE_URL: process.env.LLM_BASE_URL
    };
    // 実config/llms.jsonの影響を排除する（空設定のfixtureを使用）
    process.env.LLM_CONFIG_PATH = 'test/fixtures/llms-test.json';
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

  it('gemini: 構造化出力でJSONを抽出する', async () => {
    process.env.LLM_API_KEY = 'dummy-key';
    assert.isTrue(vision.isAvailable());
    let seenUrl = '';
    let seenBody = null;
    global.fetch = async (url, opts) => {
      seenUrl = String(url);
      seenBody = JSON.parse(opts.body);
      const payload = {
        candidates: [{
          content: { role: 'model', parts: [{ text: '{"company":"テスト商事","companyId":2,"amount":1100,"tax":100}' }] },
          finishReason: 'STOP'
        }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };
    const values = await vision.extract(PNG, 'image/png');
    assert.include(seenUrl, 'generativelanguage.googleapis.com');
    const parts = seenBody.contents[0].parts;
    assert.isDefined(parts.find((p) => p.inlineData && p.inlineData.mimeType === 'image/png'));
    assert.strictEqual(values.company, 'テスト商事');
    assert.strictEqual(values.amount, 1100);
    assert.strictEqual(values.tax, 100);
  });

  it('openai-compatible: /chat/completionsに問い合わせる（キーなし可）', async () => {
    const { server, port, requests } = await startStub(() => {
      return [200, chatCompletion('{"company":"テスト商事","companyId":2,"amount":1100}')];
    });
    try {
      process.env.LLM_PROVIDER = 'openai-compatible';
      process.env.LLM_MODEL = 'test-vision';
      process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1/`;
      assert.isTrue(vision.isAvailable());
      const values = await vision.extract(PNG, 'image/png');
      assert.strictEqual(requests.length, 1);
      assert.strictEqual(requests[0].url, '/v1/chat/completions');
      assert.strictEqual(requests[0].body.model, 'test-vision');
      assert.strictEqual(requests[0].body.response_format.type, 'json_object');
      const imgPart = requests[0].body.messages[0].content.find((p) => p.type === 'image_url');
      assert.isTrue(imgPart.image_url.url.startsWith('data:image/png;base64,'));
      assert.notProperty(requests[0].headers, 'authorization');
      assert.strictEqual(values.company, 'テスト商事');
      assert.strictEqual(values.amount, 1100);
    } finally {
      server.close();
    }
  });

  it('openai-compatible: 構造化出力の失敗時はテキスト+サルベージに落とす', async () => {
    const { server, port } = await startStub(() => {
      return [200, chatCompletion('```json\n{"company":"テスト商事","amount":1100}\n```')];
    });
    try {
      process.env.LLM_PROVIDER = 'openai-compatible';
      process.env.LLM_MODEL = 'test-vision';
      process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
      const values = await vision.extract(PNG, 'image/png');
      assert.strictEqual(values.company, 'テスト商事');
      assert.strictEqual(values.amount, 1100);
    } finally {
      server.close();
    }
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

  it('API異常時はAiApiError', async function () {
    this.timeout(15000);
    const { server, port } = await startStub(() => {
      return [500, { error: { message: 'boom', type: 'server_error' } }];
    });
    try {
      process.env.LLM_PROVIDER = 'openai-compatible';
      process.env.LLM_MODEL = 'test-vision';
      process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
      try {
        await vision.extract(PNG, 'image/png');
        assert.fail('throwされるはず');
      } catch (e) {
        assert.strictEqual(e.name, 'AiApiError');
      }
    } finally {
      server.close();
    }
  });
});

describe('vision.suggestRuleAccounts with catalog', () => {
  let origEnv;
  beforeEach(() => {
    origEnv = {
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      LLM_MODEL: process.env.LLM_MODEL,
      LLM_BASE_URL: process.env.LLM_BASE_URL,
      LLM_CONFIG_PATH: process.env.LLM_CONFIG_PATH
    };
    process.env.LLM_PROVIDER = 'openai-compatible';
    process.env.LLM_MODEL = 'test-vision';
    process.env.LLM_CONFIG_PATH = 'test/fixtures/llms-test.json';
    delete process.env.LLM_API_KEY;
  });
  afterEach(() => {
    for ( const k of Object.keys(origEnv) ) {
      if ( origEnv[k] === undefined ) {
        delete process.env[k];
      } else {
        process.env[k] = origEnv[k];
      }
    }
  });

  const CATALOG = [
    { accountCode: '7030050', name: '通信費', subAccounts: [{ subAccountCode: 401, name: '携帯電話' }] },
    { accountCode: '7030060', name: '消耗品費', subAccounts: [] }
  ];

  it('カタログと仕分け例をプロンプトに載せ、カタログ外の提案は捨てる', async () => {
    const { server, port, requests } = await startStub(() => {
      return [200, chatCompletion(JSON.stringify({
        proposals: [
          { pattern: 'サブスク月額', account: '7030050', subAccount: null, reason: 'クラウドサービスの月額利用料のため' },
          { pattern: '幻覚', account: '9999999', subAccount: null, reason: '存在しない科目' },
          { pattern: 'CD', account: '7030050', subAccount: 401, reason: '通信費の携帯電話補助が正当' },
          { pattern: '変な補助', account: '7030060', subAccount: 401, reason: '排出補助は消耗品費に無い' }
        ]
      }))];
    });
    try {
      process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
      assert.isTrue(vision.isAvailable());
      const proposals = await vision.suggestRuleAccounts(
        [{ pattern: 'サブスク月額', direction: 'out', count: 2 }, { pattern: 'CD', direction: 'out', count: 1 }],
        { catalog: CATALOG, examples: [{ pattern: '振込手数料', account: '7030060', sub: null }], financialName: 'テストカード' }
      );
      assert.strictEqual(requests.length, 1);
      // openai互換トランスポートはテキストを文字列に平坦化する
      const content0 = requests[0].body.messages[0].content;
      const prompt = ( typeof content0 === 'string' ) ? content0 : content0[0].text;
      // わからないなら提案しない冶令・カタログ・例がプロンプトに載る
      assert.include(prompt, '提案しないこと');
      assert.include(prompt, '7030050 通信費');
      assert.include(prompt, '補助: 401 携帯電話');
      assert.include(prompt, '振込手数料 → 7030060');
      assert.include(prompt, '口座: テストカード');
      // 応答はマッピングされ、カタログ外の科目コード・
      // その科目に存在しない補助の提案は捨てられる
      assert.lengthOf(proposals, 2);
      assert.strictEqual(proposals[0].pattern, 'サブスク月額');
      assert.strictEqual(proposals[0].account, '7030050');
      assert.strictEqual(proposals[0].subAccount, null);
      assert.strictEqual(proposals[1].pattern, 'CD');
      assert.strictEqual(proposals[1].subAccount, 401);
      assert.include(proposals[0].reason, 'クラウド');
    } finally {
      server.close();
    }
  });

  it('提案のない候補（方向null）をそのまま返しても fatalErrorにはならない', async () => {
    const { server, port } = await startStub(() => {
      return [200, chatCompletion(JSON.stringify({ proposals: [] }))];
    });
    try {
      process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
      const proposals = await vision.suggestRuleAccounts(
        [{ pattern: '謎の摘要', direction: 'out', count: 1 }],
        { catalog: CATALOG }
      );
      assert.lengthOf(proposals, 0);
    } finally {
      server.close();
    }
  });
});

describe('vision.extract with companies', () => {
  let origEnv;
  beforeEach(() => {
    origEnv = {
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      LLM_MODEL: process.env.LLM_MODEL,
      LLM_BASE_URL: process.env.LLM_BASE_URL,
      LLM_CONFIG_PATH: process.env.LLM_CONFIG_PATH
    };
    process.env.LLM_PROVIDER = 'openai-compatible';
    process.env.LLM_MODEL = 'test-vision';
    process.env.LLM_CONFIG_PATH = 'test/fixtures/llms-test.json';
    delete process.env.LLM_API_KEY;
  });
  afterEach(() => {
    for ( const k of Object.keys(origEnv) ) {
      if ( origEnv[k] === undefined ) {
        delete process.env[k];
      } else {
        process.env[k] = origEnv[k];
      }
    }
  });

  it('候補をプロンプトに載せてcompanyIdまで一発で取る', async () => {
    const { server, port, requests } = await startStub(() => {
      return [200, chatCompletion('{"company":"大田市水道事業","companyId":47,"amount":7195}')];
    });
    try {
      process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
      const values = await vision.extract(PNG, 'image/png', {
        companies: [{ id: 3, name: '中国電力' }, { id: 47, name: '大田市水道局' }]
      });
      assert.strictEqual(requests.length, 1);
      const text = requests[0].body.messages[0].content.find((p) => p.type === 'text').text;
      assert.include(text, '47: 大田市水道局');
      assert.strictEqual(values.company, '大田市水道事業');
      assert.strictEqual(values.companyId, 47);
    } finally {
      server.close();
    }
  });

  it('候補なしでも従来通り抽出できる', async () => {
    const { server, port } = await startStub(() => {
      return [200, chatCompletion('{"company":"テスト商事","companyId":null,"amount":1100}')];
    });
    try {
      process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
      const values = await vision.extract(PNG, 'image/png');
      assert.strictEqual(values.company, 'テスト商事');
      assert.isNull(values.companyId);
    } finally {
      server.close();
    }
  });
});

describe('vision config yaml', () => {
  let origConfig;
  beforeEach(() => {
    origConfig = process.env.LLM_CONFIG_PATH;
  });
  afterEach(() => {
    if ( origConfig === undefined ) {
      delete process.env.LLM_CONFIG_PATH;
    } else {
      process.env.LLM_CONFIG_PATH = origConfig;
    }
  });

  it('llms.yamlを読める', async () => {
    const { server, port, requests } = await startStub(() => {
      return [200, chatCompletion('{"company":null,"companyId":null,"amount":null}')];
    });
    // fixtureのbaseURLは空なので環境変数で上書きする
    process.env.LLM_CONFIG_PATH = 'test/fixtures/llms-test.yaml';
    process.env.LLM_PROVIDER = 'openai-compatible';
    process.env.LLM_MODEL = 'test-vision';
    process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
    try {
      assert.isTrue(vision.isAvailable());
      const values = await vision.extract(PNG, 'image/png');
      assert.strictEqual(requests.length, 1);
      assert.isNull(values.company);
    } finally {
      delete process.env.LLM_PROVIDER;
      delete process.env.LLM_MODEL;
      delete process.env.LLM_BASE_URL;
      server.close();
    }
  });
});

describe('vision shrink', () => {
  it('大きい画像は1600px以下に縮小して送る', async () => {
    const { server, port, requests } = await startStub(() => {
      return [200, chatCompletion('{"company":null,"companyId":null,"amount":null}')];
    });
    const orig = {
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      LLM_MODEL: process.env.LLM_MODEL,
      LLM_BASE_URL: process.env.LLM_BASE_URL,
      LLM_CONFIG_PATH: process.env.LLM_CONFIG_PATH
    };
    try {
      process.env.LLM_PROVIDER = 'openai-compatible';
      process.env.LLM_MODEL = 'test-vision';
      process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
      process.env.LLM_CONFIG_PATH = 'test/fixtures/llms-test.json';
      const { Jimp } = await import('jimp');
      const big = new Jimp({ width: 400, height: 2400, color: 0xfafafaff });
      const buf = await big.getBuffer('image/png');
      await vision.extract(buf, 'image/png');
      const imgPart = requests[0].body.messages[0].content.find((p) => p.type === 'image_url');
      const b64 = imgPart.image_url.url.split(',')[1];
      const sent = await Jimp.read(Buffer.from(b64, 'base64'));
      assert.isAtMost(Math.max(sent.bitmap.width, sent.bitmap.height), 1600);
    } finally {
      for ( const k of Object.keys(orig) ) {
        if ( orig[k] === undefined ) {
          delete process.env[k];
        } else {
          process.env[k] = orig[k];
        }
      }
      server.close();
    }
  });
});
