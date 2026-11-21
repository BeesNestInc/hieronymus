import {assert} from 'chai';
import fs from 'fs';
import path from 'path';
import models from '../models/index.js';
import seed from './seed.js';
import {
  PROMPT_KEYS, getActive, listPrompts, savePrompt, rollbackPrompt, resetPrompt
} from '../libs/ai-prompts.js';

describe('AI prompts（世代管理）', () => {
  before(async function() {
    this.timeout(60000);
    const dbName = models.sequelize.getDatabaseName();
    if ( !/_test$/.test(dbName) ) {
      throw new Error(`このテストは *_test データベースでのみ実行できます（現在: ${dbName}）`);
    }
    try {
      await models.sequelize.authenticate();
    } catch (e) {
      delete models.sequelize.connectionManager.getConnection;
      models.sequelize.connectionManager.initPools();
      await models.sequelize.authenticate();
    }
    data = await seed();
    await models.PromptTemplateVersion.destroy({ where: {} });
  });

  let data;

  it('listPrompts: 7用途がビルトイン本文で返る（未改変）', async () => {
    const list = await listPrompts();
    assert.lengthOf(list, PROMPT_KEYS.length);
    for ( const p of list ) {
      assert.equal(p.generation, null);
      assert.equal(p.modified, false);
      const builtin = fs.readFileSync(path.resolve('ai/prompt-templates', `${p.key}.md`), 'utf-8');
      assert.equal(p.body, builtin);
    }
  });

  it('savePrompt: 新世代が積まれ、runtimeに反映される', async () => {
    const result = await savePrompt('ocr-statement', '# テスト用の計算書読み取り指示', data.approver);
    assert.equal(result.generation, 1);
    const active = await getActive('ocr-statement');
    assert.equal(active.body, '# テスト用の計算書読み取り指示');
    assert.equal(active.generation, 1);
    // runtime/prompt-templates に書き出されている
    const runtime = fs.readFileSync(path.resolve('runtime/prompt-templates', 'ocr-statement.md'), 'utf-8');
    assert.equal(runtime, '# テスト用の計算書読み取り指示');
  });

  it('getActive: DBに行が無いキーはビルトインのフォールバック', async () => {
    const active = await getActive('ocr-voucher');
    const builtin = fs.readFileSync(path.resolve('ai/prompt-templates', 'ocr-voucher.md'), 'utf-8');
    assert.equal(active.body, builtin);
    assert.equal(active.generation, null);
  });

  it('rollback: 指定世代の本文が新世代として復元される', async () => {
    await savePrompt('ocr-statement', '# 第2世代', data.approver);
    const result = await rollbackPrompt('ocr-statement', 1, data.approver);
    assert.equal(result.generation, 3);
    const active = await getActive('ocr-statement');
    assert.equal(active.body, '# テスト用の計算書読み取り指示');
  });

  it('resetPrompt: ビルトインの本文が新世代として積まれる', async () => {
    await resetPrompt('ocr-statement', data.approver);
    const active = await getActive('ocr-statement');
    const builtin = fs.readFileSync(path.resolve('ai/prompt-templates', 'ocr-statement.md'), 'utf-8');
    assert.equal(active.body, builtin);
    const runtime = fs.readFileSync(path.resolve('runtime/prompt-templates', 'ocr-statement.md'), 'utf-8');
    assert.equal(runtime, builtin);
  });

  it('savePrompt: 不明なキーと空本文は拒否する', async () => {
    let err = null;
    try {
      await savePrompt('unknown-key', 'x', data.approver);
    } catch (e) {
      err = e;
    }
    assert.isOk(err);
    assert.match(err.message, /不明な用途キー/);
    err = null;
    try {
      await savePrompt('ocr-statement', '   ', data.approver);
    } catch (e) {
      err = e;
    }
    assert.isOk(err);
    assert.match(err.message, /本文が空/);
  });
});

import { guard } from '../libs/permission.js';

describe('AI管理権限（aiManage）', () => {
  const request = (user, path, method) => ({
    session: { user: user },
    path: path,
    method: method,
    headers: {}
  });
  const res = () => {
    const r = { status: null, json: null };
    return Object.assign(r, {
      status(code) { r._status = code; return r; },
      json(body) { r._json = body; return r; }
    });
  };

  it('promptsはaiManageユーザーには許可し、無いユーザーには403を返す', () => {
    const user = { aiManage: true };
    let called = false;
    guard(request(user, '/prompts', 'GET'), res(), () => { called = true; });
    assert.isTrue(called);
    const plain = { aiManage: false };
    called = false;
    const r = res();
    guard(request(plain, '/prompts', 'GET'), r, () => { called = true; });
    assert.isFalse(called);
    assert.equal(r._status, 403);
  });

  it('/admin/llms（AI設定）はaiManageユーザーには許可する', () => {
    const user = { aiManage: true, administrable: false };
    let called = false;
    guard(request(user, '/admin/llms', 'PUT'), res(), () => { called = true; });
    assert.isTrue(called);
    // administrableだけでは通らない（AI管理権限が必要）
    const adminOnly = { aiManage: false, administrable: true };
    called = false;
    const r = res();
    guard(request(adminOnly, '/admin/llms', 'PUT'), r, () => { called = true; });
    assert.isFalse(called);
    assert.equal(r._status, 403);
  });

  it('ユーザモデルにaiManageフラグがある', async () => {
    const approver = await models.User.findOne();
    assert.isOk(approver);
    const user = approver;
    assert.isFalse(Boolean(user.aiManage));
    await user.update({ aiManage: true });
    await user.reload();
    assert.isTrue(user.aiManage);
    await user.update({ aiManage: false });
  });
});
