import {assert} from 'chai';
import bcrypt from 'bcrypt';
import models from '../models/index.js';
import seed from './seed.js';
import apiMenu from '../routes/api_menu.js';
import {guard} from '../libs/permission.js';

describe('menu (mypage, test db)', () => {
  let data;
  let admin;
  let owner;
  let stranger;

  before(async () => {
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
    // 管理者 / マイページ所有者 / 他人
    admin = await models.User.findOrCreate({
      where: { name: 'menu-admin' },
      defaults: {
        name: 'menu-admin',
        hashPassword: bcrypt.hashSync('secret', 10),
        administrable: true,
        accounting: false, fiscalBrowsing: false, approvable: false,
        companyManagement: false, inventoryManagement: false,
        personnelManagement: false
      }
    }).then(([u]) => u);
    owner = await models.User.findOrCreate({
      where: { name: 'menu-owner' },
      defaults: {
        name: 'menu-owner',
        hashPassword: bcrypt.hashSync('secret', 10),
        administrable: false, accounting: false, fiscalBrowsing: false,
        approvable: false, companyManagement: false,
        inventoryManagement: false, personnelManagement: false
      }
    }).then(([u]) => u);
    stranger = await models.User.findOrCreate({
      where: { name: 'menu-stranger' },
      defaults: {
        name: 'menu-stranger',
        hashPassword: bcrypt.hashSync('secret', 10),
        administrable: false, accounting: false, fiscalBrowsing: false,
        approvable: false, companyManagement: false,
        inventoryManagement: false, personnelManagement: false
      }
    }).then(([u]) => u);
    // 前回実行の残データを掃除する（テンプレートも掃除する）
    await models.Menu.destroy({ where: {} });
  });

  after(async () => {
    await models.sequelize.close();
  });

  const call = async (handler, req) => {
    let status = 200;
    let body = null;
    const res = {
      set: () => res,
      status: (c) => { status = c; return res; },
      json: (o) => { body = o; return res; },
      send: (o) => { body = o; return res; }
    };
    let nextErr = null;
    await handler({ ...req, params: req.params || {} }, res, (e) => { nextErr = e; });
    // api_menu のハンドラは非async（.thenチェーン）なので、
    // await handler では応答の書き込みが完了しないことがある。
    // bodyが埋まるまで（またはタイムアウトまで）待つ
    const deadline = Date.now() + 5000;
    while ( body === null && Date.now() < deadline ) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return { status: status, body: body, nextErr: nextErr };
  };

  const createMenu = async (user, title = 'マイページテスト') => {
    return call(apiMenu.post, {
      body: { title: title, displayOrder: 99, body: '[]' },
      session: { user: user }
    });
  };

  it('権限: マイページのCRUDは権限フラグを持たないユーザーでもできる', async () => {
    for ( const [path, method] of [
      ['/menu', 'GET'],
      ['/menu', 'POST'],
      ['/menu/1', 'GET'],
      ['/menu/1', 'PUT'],
      ['/menu/1', 'DELETE'],
      ['/menu/templates', 'GET']
    ]) {
      let nextCalled = false;
      let status = 200;
      const res = {
        status: (c) => { status = c; return res; },
        json: () => res,
        set: () => res,
        send: () => res
      };
      await guard({ path: path, method: method, session: { user: owner } }, res, () => {
        nextCalled = true;
      });
      assert.isTrue(nextCalled, `${method} ${path} が拒否されました`);
      assert.equal(status, 200);
    }
  });

  it('権限: テンプレートへの公開は管理者のみ', async () => {
    let nextCalled = false;
    let status = 200;
    const res = {
      status: (c) => { status = c; return res; },
      json: () => res
    };
    await guard({ path: '/menu/publish/1', method: 'POST', session: { user: owner } }, res, () => {
      nextCalled = true;
    });
    assert.isFalse(nextCalled);
    assert.equal(status, 403);
  });

  it('作成: マイページは作成者に紐づく', async () => {
    const result = await createMenu(owner);
    assert.ok(result.body.menu);
    assert.equal(result.body.menu.userId, owner.id);
  });

  it('作成: userIdを偽装してもテンプレートにはならない', async () => {
    const result = await call(apiMenu.post, {
      body: { title: '偽装テンプレート', userId: null, body: '[]' },
      session: { user: owner }
    });
    assert.equal(result.body.menu.userId, owner.id);
  });

  it('参照: 他人のマイページは参照できない（管理者も不可: su原則）', async () => {
    const mine = await createMenu(owner);
    const menuId = mine.body.menu.id;
    const denied = await call(apiMenu.get, {
      params: { id: menuId },
      session: { user: stranger }
    });
    assert.equal(denied.status, 403);
    // su原則: 管理者でも他人のマイページは参照できない
    // （「suが使えるからといって他人のメールを読まない」）
    const deniedAdmin = await call(apiMenu.get, {
      params: { id: menuId },
      session: { user: admin }
    });
    assert.equal(deniedAdmin.status, 403);
    // テンプレート（userId=null）は誰でも参照できる（+で追加するため）
    const template = await models.Menu.create({
      title: 'テンプレ', userId: null, displayOrder: 10, body: '[]'
    });
    const t = await call(apiMenu.get, {
      params: { id: template.id },
      session: { user: stranger }
    });
    assert.equal(t.status, 200);
  });

  it('更新: 他人のマイページは更新できない', async () => {
    const mine = await createMenu(owner);
    const menuId = mine.body.menu.id;
    const denied = await call(apiMenu.update, {
      body: { id: menuId, title: '乗っ取り' },
      session: { user: stranger }
    });
    assert.equal(denied.status, 403);
    const menu = await models.Menu.findByPk(menuId);
    assert.equal(menu.title, 'マイページテスト');
  });

  it('更新: 所有者の更新でuserId（所有権）は書き換わらない', async () => {
    const mine = await createMenu(owner);
    const menuId = mine.body.menu.id;
    await call(apiMenu.update, {
      body: { id: menuId, title: '改名OK', userId: stranger.id },
      session: { user: owner }
    });
    const menu = await models.Menu.findByPk(menuId);
    assert.equal(menu.userId, owner.id);
    assert.equal(menu.title, '改名OK');
  });

  it('削除: 他人のマイページとテンプレートは削除できない', async () => {
    const mine = await createMenu(owner);
    const template = await models.Menu.create({
      title: '守られたテンプレート', userId: null, displayOrder: 11, body: '[]'
    });
    const deniedMenu = await call(apiMenu.delete, {
      params: { id: mine.body.menu.id },
      session: { user: stranger }
    });
    assert.equal(deniedMenu.status, 403);
    const deniedTemplate = await call(apiMenu.delete, {
      params: { id: template.id },
      session: { user: stranger }
    });
    assert.equal(deniedTemplate.status, 403);
    // 管理者はテンプレートを削除できる
    const adminOk = await call(apiMenu.delete, {
      params: { id: template.id },
      session: { user: admin }
    });
    assert.equal(adminOk.body.code, 0);
    assert.notOk(await models.Menu.findByPk(template.id));
    // 本人は自分のページを削除できる
    const ok = await call(apiMenu.delete, {
      params: { id: mine.body.menu.id },
      session: { user: owner }
    });
    assert.equal(ok.body.code, 0);
  });

  it('並べ替え: 自分のページの並べ替えはでき、テンプレートは拒否される', async () => {
    const mine = await createMenu(owner, '並べ替え対象');
    const template = await models.Menu.create({
      title: '並べ替え不可', userId: null, displayOrder: 12, body: '[]'
    });
    const result = await call(apiMenu.update, {
      body: {
        menus: [
          { id: mine.body.menu.id, title: mine.body.menu.title,
            displayOrder: 5, userId: owner.id, body: '[]' },
          { id: template.id, title: template.title,
            displayOrder: 6, userId: null, body: '[]' }
        ]
      },
      session: { user: owner }
    });
    assert.equal(result.status, 403);
    // 自分のページだけの並べ替えは通る
    const ok = await call(apiMenu.update, {
      body: {
        menus: [
          { id: mine.body.menu.id, title: '並べ替え対象',
            displayOrder: 5, userId: owner.id, body: '[]' }
        ]
      },
      session: { user: owner }
    });
    assert.equal(ok.status, 200);
    const menu = await models.Menu.findByPk(mine.body.menu.id);
    assert.equal(menu.displayOrder, 5);
  });

  it('公開: 管理者は自分のマイページをテンプレートとして公開できる', async () => {
    const mine = await createMenu(admin, '公開するページ');
    const before = await models.Menu.count({ where: { userId: null } });
    const result = await call(apiMenu.publish, {
      params: { id: mine.body.menu.id },
      session: { user: admin }
    });
    assert.equal(result.body.code, 0);
    assert.equal(result.body.template.userId, null);
    const after = await models.Menu.count({ where: { userId: null } });
    assert.equal(after, before + 1);
    // 元のマイページは残る
    assert.ok(await models.Menu.findByPk(mine.body.menu.id));
    // 公開されたテンプレートは +（getTemplates）に現れる
    const templates = await call(apiMenu.getTemplates, {
      session: { user: stranger }
    });
    assert.ok(templates.body.templates.some((t) => t.title === '公開するページ'));
  });

  it('公開: 他人のマイページは管理者以外公開できない', async () => {
    const mine = await createMenu(owner);
    const result = await call(apiMenu.publish, {
      params: { id: mine.body.menu.id },
      session: { user: stranger }
    });
    // guardで管理者限定なのでハンドラ直呼びでも403になる
    assert.equal(result.status, 403);
  });
});
