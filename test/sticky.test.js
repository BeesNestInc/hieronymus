import {assert} from 'chai';
import bcrypt from 'bcrypt';
import models from '../models/index.js';
import seed from './seed.js';
import apiSticky from '../routes/api_sticky.js';
import {guard} from '../libs/permission.js';

describe('sticky (test db)', () => {
  let data;
  let third;

  before(async () => {
    // 実DB（development等）へのテスト実行は実データを破壊するので禁止
    const dbName = models.sequelize.getDatabaseName();
    if ( !/_test$/.test(dbName) ) {
      throw new Error(`このテストは *_test データベースでのみ実行できます（現在: ${dbName}）。NODE_ENV=test を確認してください`);
    }
    try {
      await models.sequelize.authenticate();
    } catch (e) {
      delete models.sequelize.connectionManager.getConnection;
      models.sequelize.connectionManager.initPools();
      await models.sequelize.authenticate();
    }
    data = await seed();
    // テストDBは繰り返し使われるので findOrCreate で用意する
    third = await models.User.findOrCreate({
      where: { name: 'sticky-third' },
      defaults: {
        name: 'sticky-third',
        hashPassword: bcrypt.hashSync('secret', 10),
        accounting: false,
        approvable: false,
        fiscalBrowsing: false,
        administrable: false,
        companyManagement: false,
        inventoryManagement: false,
        personnelManagement: false
      }
    }).then(([user]) => user);
    // 前回実行の残データを掃除する（テストDBは繰り返し使われる）
    await models.StickyStatus.destroy({ where: {} });
    await models.Sticky.destroy({ where: {} });
  });

  after(async () => {
    await models.sequelize.close();
  });

  const call = async (handler, req) => {
    let status = 200;
    let body = null;
    const res = {
      set: () => {},
      status: (c) => { status = c; return res; },
      json: (o) => { body = o; return res; }
    };
    let nextErr = null;
    await handler(req, res, (e) => { nextErr = e; });
    return { status: status, body: body, nextErr: nextErr };
  };

  const userList = async (user) => {
    const result = await call(apiSticky.list, { session: { user: user } });
    return result.body;
  };

  it('作成: 指定ユーザー宛にStickyStatusが作られる', async () => {
    const result = await call(apiSticky.post, {
      body: {
        message: '伝票の確認をお願いします',
        receiverIds: [data.approver.id, third.id]
      },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, 0);
    const statuses = await models.StickyStatus.findAll({
      where: {
        receiverId: { [models.Sequelize.Op.in]: [data.approver.id, third.id] }
      }
    });
    assert.equal(statuses.length, 2);
    const sticky = await models.Sticky.findByPk(result.body.sticky.id);
    assert.equal(sticky.message, '伝票の確認をお願いします');
    assert.equal(sticky.authorId, data.creator.id);
  });

  it('作成: sendToAll で全ユーザー宛になる（自分も含む）', async () => {
    const result = await call(apiSticky.post, {
      body: {
        message: '全員へのお知らせ',
        sendToAll: true
      },
      session: { user: data.approver }
    });
    assert.equal(result.body.code, 0);
    const userCount = await models.User.count();
    const statusCount = await models.StickyStatus.count({
      where: { stickyId: result.body.sticky.id }
    });
    assert.equal(statusCount, userCount);
  });

  it('作成: 自分宛の付箋も作れる（TODO的な自分メモ）', async () => {
    const result = await call(apiSticky.post, {
      body: {
        message: '自分宛メモ',
        receiverIds: [data.creator.id]
      },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, 0);
    const status = await models.StickyStatus.findOne({
      where: {
        stickyId: result.body.sticky.id,
        receiverId: data.creator.id
      }
    });
    assert.ok(status);
    assert.notOk(status.readAt);
    // 自分宛なので自分の一覧に未読として出る
    const list = await userList(data.creator);
    const mine = list.stickies.find((s) => s.stickyId === result.body.sticky.id);
    assert.ok(mine);
    assert.notOk(mine.readAt);
  });

  it('作成: 宛先未指定は「自分のための付箋」として自分宛になる', async () => {
    const result = await call(apiSticky.post, {
      body: {
        message: '宛先なしメモ'
      },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, 0);
    const status = await models.StickyStatus.findOne({
      where: {
        stickyId: result.body.sticky.id,
        receiverId: data.creator.id
      }
    });
    assert.ok(status);
    assert.notOk(status.readAt);
  });

  it('作成: 重要度を付けられる', async () => {
    const result = await call(apiSticky.post, {
      body: {
        message: '至急の依頼',
        importance: 2,
        receiverIds: [data.approver.id]
      },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, 0);
    const status = await models.StickyStatus.findOne({
      where: { stickyId: result.body.sticky.id, receiverId: data.approver.id }
    });
    assert.equal(status.importance, 2);
  });

  it('作成: 不正な重要度は通常(0)に落とされる', async () => {
    const result = await call(apiSticky.post, {
      body: {
        message: '変な重要度',
        importance: 99,
        receiverIds: [data.approver.id]
      },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, 0);
    const status = await models.StickyStatus.findOne({
      where: { stickyId: result.body.sticky.id, receiverId: data.approver.id }
    });
    assert.equal(status.importance, 0);
  });

  it('一覧: 未読優先 → 重要度 → 新しい順で並ぶ', async () => {
    // creator 宛に重要度違いの3通を作る
    const mk = async (message, importance) => {
      const result = await call(apiSticky.post, {
        body: { message: message, importance: importance, receiverIds: [data.creator.id] },
        session: { user: data.approver }
      });
      return result.body.sticky.id;
    };
    await mk('通常の付箋', 0);
    await mk('重要な付箋', 1);
    await mk('至急の付箋', 2);
    const list = await userList(data.creator);
    const fresh = list.stickies.filter((s) => !s.readAt);
    assert.isAbove(fresh.length, 2);
    assert.equal(fresh[0].importance, 2);
    assert.equal(fresh[1].importance, 1);
    assert.equal(fresh[2].importance, 0);
  });

  it('作成: 他人宛は申し送り(handoff)、自分だけならメモ(memo)になる', async () => {
    const toOthers = await call(apiSticky.post, {
      body: {
        message: '申し送りテスト',
        receiverIds: [data.approver.id]
      },
      session: { user: data.creator }
    });
    assert.equal(toOthers.body.code, 0);
    assert.equal(toOthers.body.sticky.kind, 'handoff');
    const toSelf = await call(apiSticky.post, {
      body: {
        message: 'メモテスト',
        receiverIds: [data.creator.id]
      },
      session: { user: data.creator }
    });
    assert.equal(toSelf.body.code, 0);
    assert.equal(toSelf.body.sticky.kind, 'memo');
    // 自分＋他人の混合なら申し送り
    const mixed = await call(apiSticky.post, {
      body: {
        message: '混合テスト',
        receiverIds: [data.creator.id, data.approver.id]
      },
      session: { user: data.creator }
    });
    assert.equal(mixed.body.sticky.kind, 'handoff');
  });

  it('一覧: 種別(kind)が返る', async () => {
    const list = await userList(data.creator);
    assert.ok(list.stickies.some((s) => s.kind === 'handoff'));
    assert.ok(list.stickies.some((s) => s.kind === 'memo'));
  });

  it('転送: メモを他人に転送すると申し送りになる', async () => {
    const created = await call(apiSticky.post, {
      body: {
        message: 'メモからの転送',
        receiverIds: [data.creator.id]
      },
      session: { user: data.creator }
    });
    const stickyId = created.body.sticky.id;
    const before = await models.Sticky.findByPk(stickyId);
    assert.equal(before.kind, 'memo');
    const result = await call(apiSticky.forward, {
      params: { id: stickyId },
      body: { receiverIds: [third.id] },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, 0);
    const after = await models.Sticky.findByPk(stickyId);
    assert.equal(after.kind, 'handoff');
    const status = await models.StickyStatus.findOne({
      where: { stickyId: stickyId, receiverId: third.id }
    });
    assert.ok(status);
  });

  it('作成: 明示されたkind memoは自分宛に固定される', async () => {
    const result = await call(apiSticky.post, {
      body: {
        message: '明示メモ',
        kind: 'memo',
        receiverIds: [data.approver.id]
      },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, 0);
    assert.equal(result.body.sticky.kind, 'memo');
    const receiverIds = result.body.sticky.receiverIds;
    assert.deepEqual(receiverIds, [data.creator.id]);
  });

  it('作成: kind handoffで宛先がないときは拒否される', async () => {
    const result = await call(apiSticky.post, {
      body: {
        message: '宛先のない申し送り',
        kind: 'handoff'
      },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, -3);
  });

  it('権限: 権限フラグを持たないユーザーでもsticky APIは使える', async () => {
    // guard はルール未登録のパスをデフォルト拒否（403）する。
    // sticky は RULES に明示登録が必要（PATCH時の403事故の再発防止）
    for ( const [path, method] of [
      ['/sticky', 'GET'],
      ['/sticky', 'POST'],
      ['/sticky/1/read', 'POST'],
      ['/sticky/1/forward', 'POST'],
      ['/sticky/status/1', 'DELETE'],
      ['/sticky/1', 'DELETE']
    ]) {
      let nextCalled = false;
      let status = 200;
      const res = {
        status: (c) => { status = c; return res; },
        json: () => res
      };
      await guard({ path: path, method: method, session: { user: data.creator } }, res, () => {
        nextCalled = true;
      });
      assert.isTrue(nextCalled, `${method} ${path} が拒否されました`);
      assert.equal(status, 200);
    }
  });

  it('作成: 本文が空のものは作れない', async () => {
    const result = await call(apiSticky.post, {
      body: { message: '   ', receiverIds: [data.approver.id] },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, -3);
  });

  it('一覧: 受信者には自分宛のメッセージが見え、未読数が返る', async () => {
    const result = await userList(data.approver);
    const mine = result.stickies.filter((s) =>
      ( s.authorId === data.creator.id ) && ( s.statusId ));
    assert.isAbove(mine.length, 0);
    assert.isAbove(result.unreadCount, 0);
    const unread = mine.filter((s) => !s.readAt);
    assert.isAbove(unread.length, 0);
  });

  it('一覧: 作者は受信していない自分のメッセージも見られる', async () => {
    const result = await userList(data.approver);
    const mine = result.stickies.filter((s) => s.authorId === data.approver.id);
    assert.isAbove(mine.length, 0);
  });

  it('既読: 受信者は自分宛のメッセージを既読にできる', async () => {
    const before = await userList(data.approver);
    const target = before.stickies.find((s) =>
      ( !s.readAt ) && ( s.authorId === data.creator.id ));
    assert.ok(target);
    const result = await call(apiSticky.read, {
      params: { id: target.stickyId },
      session: { user: data.approver }
    });
    assert.equal(result.body.code, 0);
    const status = await models.StickyStatus.findByPk(target.statusId);
    assert.ok(status.readAt);
  });

  it('既読: 受信していない他人のメッセージは既読にできない', async () => {
    const sticky = await models.Sticky.create({
      authorId: data.creator.id,
      message: 'third専用'
    });
    await models.StickyStatus.create({
      stickyId: sticky.id,
      receiverId: third.id
    });
    const result = await call(apiSticky.read, {
      params: { id: sticky.id },
      session: { user: data.approver }
    });
    assert.equal(result.status, 403);
  });

  it('転送: 受信者は閲覧できるメッセージを他ユーザーに転送できる', async () => {
    const sticky = await models.Sticky.create({
      authorId: data.creator.id,
      message: '転送テスト'
    });
    await models.StickyStatus.create({
      stickyId: sticky.id,
      receiverId: data.approver.id
    });
    const result = await call(apiSticky.forward, {
      params: { id: sticky.id },
      body: { receiverIds: [third.id] },
      session: { user: data.approver }
    });
    assert.equal(result.body.code, 0);
    assert.equal(result.body.forwarded, 1);
    const status = await models.StickyStatus.findOne({
      where: { stickyId: sticky.id, receiverId: third.id }
    });
    assert.ok(status);
  });

  it('転送: 見られないメッセージは転送できない', async () => {
    const sticky = await models.Sticky.create({
      authorId: data.creator.id,
      message: 'third専用2'
    });
    await models.StickyStatus.create({
      stickyId: sticky.id,
      receiverId: third.id
    });
    const result = await call(apiSticky.forward, {
      params: { id: sticky.id },
      body: { receiverIds: [third.id] },
      session: { user: data.approver }
    });
    assert.equal(result.status, 403);
  });

  it('転送: 既に受信しているユーザーには二重に送らない', async () => {
    const sticky = await models.Sticky.create({
      authorId: data.creator.id,
      message: '重複チェック'
    });
    await models.StickyStatus.create({
      stickyId: sticky.id,
      receiverId: third.id
    });
    const result = await call(apiSticky.forward, {
      params: { id: sticky.id },
      body: { receiverIds: [third.id, data.approver.id] },
      session: { user: data.creator }
    });
    assert.equal(result.body.code, 0);
    assert.equal(result.body.forwarded, 1);
    assert.equal(result.body.skipped, 1);
    const count = await models.StickyStatus.count({
      where: { stickyId: sticky.id, receiverId: third.id }
    });
    assert.equal(count, 1);
  });

  it('削除: 受信者は自分宛のコピーだけを削除できる', async () => {
    const sticky = await models.Sticky.create({
      authorId: data.creator.id,
      message: 'コピー削除'
    });
    const status = await models.StickyStatus.create({
      stickyId: sticky.id,
      receiverId: data.approver.id
    });
    await models.StickyStatus.create({
      stickyId: sticky.id,
      receiverId: third.id
    });
    // 他人のコピーは消せない
    const denied = await call(apiSticky.deleteStatus, {
      params: { statusId: status.id },
      session: { user: third }
    });
    assert.equal(denied.body.code, -2);
    const remains = await models.StickyStatus.findByPk(status.id);
    assert.ok(remains);
    // 本人なら消せる
    const ok = await call(apiSticky.deleteStatus, {
      params: { statusId: status.id },
      session: { user: data.approver }
    });
    assert.equal(ok.body.code, 0);
    const gone = await models.StickyStatus.findByPk(status.id);
    assert.notOk(gone);
    // 本体と他の受信状態は残る
    const stickyLeft = await models.Sticky.findByPk(sticky.id);
    assert.ok(stickyLeft);
    const statusCount = await models.StickyStatus.count({
      where: { stickyId: sticky.id }
    });
    assert.equal(statusCount, 1);
  });

  it('削除: 作者は本体を削除でき、全員の受信状態も消える', async () => {
    const sticky = await models.Sticky.create({
      authorId: data.approver.id,
      message: '本体削除'
    });
    await models.StickyStatus.create({
      stickyId: sticky.id,
      receiverId: third.id
    });
    // 作者以外は消せない
    const denied = await call(apiSticky.delete, {
      params: { id: sticky.id },
      session: { user: third }
    });
    assert.equal(denied.body.code, -2);
    const ok = await call(apiSticky.delete, {
      params: { id: sticky.id },
      session: { user: data.approver }
    });
    assert.equal(ok.body.code, 0);
    const gone = await models.Sticky.findByPk(sticky.id);
    assert.notOk(gone);
    const statusCount = await models.StickyStatus.count({
      where: { stickyId: sticky.id }
    });
    assert.equal(statusCount, 0);
  });
});
