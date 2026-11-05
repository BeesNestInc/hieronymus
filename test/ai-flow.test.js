// Phase 3-1 の結線検証（network 不使用、実API・実DB不使用）:
// - ai/host/mcp-tools が voucher/expense の tools 群を組めること
// - host init で engine hooks に群が登録されること
// - useMcp の manifest に群のツールが載ること（engine の tools 結線）
// - tasks 型の voucher-from-receipt フローが dry run（LLM なし）で通ること
import assert from 'assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ai/manifest-engine');
const ok = (cond) => assert.ok(Boolean(cond));

describe('ai/host mcp 結線', () => {
  before(() => {
    process.env.LEGION_NO_DOTENV = '1';
    process.env.TEMPLATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ai/prompt-templates');
  });

  it('voucher/expense の主なツールが群として組める', async () => {
    const { kaikeiMcpTools } = await import('../ai/host/mcp-tools.js');
    const groups = kaikeiMcpTools();
    ok(groups.voucher);
    ok(groups.expense);
    for ( const name of [ 'get_accounts', 'create_cross_slip', 'approve_cross_slip' ] ) {
      ok(groups.voucher[name], `voucher.${name}`);
      assert.equal(typeof groups.voucher[name].execute, 'function', `${name} execute`);
      ok(groups.voucher[name].inputSchema, `${name} inputSchema`);
    }
    for ( const name of [ 'list_expense_mappings', 'update_expense_report' ] ) {
      ok(groups.expense[name], `expense.${name}`);
    }
  });

  it('useMcp の manifest に host の群が載る', async () => {
    await ( await import('../ai/host/index.js') ).initializeAiHost();
    const hooks = await import(path.join(engineRoot, 'hooks.js'));
    const tools = hooks.getMcpTools();
    ok(( tools.voucher || {} ).create_cross_slip, 'hooks に voucher 群が登録される');
    const { Manifest } = await import(path.join(engineRoot, 'manifest.js'));
    const m = new Manifest({
      name: 'mcp-smoke',
      systemPrompt: 'standard',
      messagePrompt: 'ツールが載っていることを確認する',
      useMcp: [ { voucher: [ '!delete_cross_slip' ] } ]
    });
    await m.initialize();
    ok(m.tools.create_cross_slip, 'create_cross_slip が載る');
    ok(m.tools.get_accounts, 'get_accounts が載る');
    ok(!m.tools.delete_cross_slip, '除外指定した delete_cross_slip は載らない');
  });

  it('tasks 型フロー（voucher-from-receipt）が dry run で通る', async function () {
    this.timeout(30000);
    const utils = await import(path.join(engineRoot, 'libs/utils.js'));
    utils.setDebugOptions('dry');
    // dry run は LLM を呼ばない。実API認証（HIERONYMUS_LOGIN_USER）も不要
    process.env.HIERONYMUS_LOGIN_USER = process.env.HIERONYMUS_LOGIN_USER || 'dry-test';
    process.env.HIERONYMUS_LOGIN_PASSWORD = process.env.HIERONYMUS_LOGIN_PASSWORD || 'dry-test';
    try {
      const { runVoucherFromReceipt } = await import('../ai/manifests/voucher-from-receipt.js');
      const result = await runVoucherFromReceipt({
        imagePath: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/receipt-dry.png')
      });
      assert.equal(typeof result, 'string', 'dry run の結果は文字列');
    } finally {
      // dry モードはエンジンのモジュールレベルの状態。このままだと
      // 後続のテスト（visionのfetchモック等）がdryでLLMを通らなくなる。
      // debugOptionsはexport済み配列なのでin-placeで空に戻せる
      utils.debugOptions.length = 0;
      utils.setLogLevel('none');
    }
  });
});
