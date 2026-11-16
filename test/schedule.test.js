import {assert} from 'chai';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import models from '../models/index.js';
import seed from './seed.js';
import apiSchedule from '../routes/api_schedule.js';
import {guard} from '../libs/permission.js';

describe('schedule (test db)', () => {
  let data;
  let viewer;
  let creator;
  let approver;

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
    // 閲覧権限のみ（fiscalBrowsing）のユーザー。編集はできないはず
    viewer = await models.User.findOrCreate({
      where: { name: 'schedule-viewer' },
      defaults: {
        name: 'schedule-viewer',
        hashPassword: bcrypt.hashSync('secret', 10),
        accounting: false,
        fiscalBrowsing: true,
        administrable: false,
        approvable: false,
        companyManagement: false,
        inventoryManagement: false,
        personnelManagement: false
      }
    }).then(([user]) => user);
    creator = data.creator; // 会計権限なし（編集不可のはず）
    approver = data.approver; // 会計権限あり（編集可）
    // 前回実行の残データを掃除する（テストDBは繰り返し使われる）
    await models.Schedule.destroy({ where: {} });
    await models.User.update({ feedToken: null }, { where: {} });
  });

  after(async () => {
    await models.sequelize.close();
  });

  const call = async (handler, req, args = {}) => {
    let status = 200;
    let body = null;
    let contentType = null;
    const res = {
      set: (key, value) => {
        if ( key === 'Content-Type' ) {
          contentType = value;
        }
        return res;
      },
      status: (c) => { status = c; return res; },
      send: (content) => { body = content; return res; },
      json: (o) => { body = o; return res; },
      ...args
    };
    let nextErr = null;
    await handler(req, res, (e) => { nextErr = e; });
    return { status: status, body: body, contentType: contentType, nextErr: nextErr };
  };

  const sampleOnce = {
    title: '器具のリース一括支払',
    kind: 'out',
    amount: 120000,
    recurrence: 'once',
    date: '2026-03-10'
  };

  const create = async (body, user = approver) => {
    return call(apiSchedule.post, { body: body, session: { user: user } });
  };

  const sampleMonthly = {
    title: '家賃',
    kind: 'out',
    amount: 80000,
    recurrence: 'monthly',
    dayOfMonth: 25
  };

  it('権限: 閲覧権限(fiscalBrowsing)は予定表の閲覧ができる', async () => {
    for ( const [path, method] of [
      ['/schedule', 'GET'],
      ['/schedule/2026/11', 'GET'],
      ['/schedule/year/2027', 'GET'],
      ['/schedule/token', 'POST']
    ]) {
      let nextCalled = false;
      let status = 200;
      const res = {
        status: (c) => { status = c; return res; },
        json: () => res
      };
      await guard({ path: path, method: method, session: { user: viewer } }, res, () => {
        nextCalled = true;
      });
      assert.isTrue(nextCalled, `${method} ${path} が拒否されました`);
      assert.equal(status, 200);
    }
  });

  it('権限: 権限のないユーザーは予定表を見られない', async () => {
    let nextCalled = false;
    let status = 200;
    const res = {
      status: (c) => { status = c; return res; },
      json: () => res
    };
    await guard({ path: '/schedule', method: 'GET', session: { user: creator } }, res, () => {
      nextCalled = true;
    });
    assert.isFalse(nextCalled);
    assert.equal(status, 403);
  });

  it('権限: 編集権限のないユーザーは作成・更新・削除できない', async () => {
    for ( const [path, method] of [
      ['/schedule', 'POST'],
      ['/schedule/1', 'PUT'],
      ['/schedule/1', 'DELETE']
    ]) {
      let nextCalled = false;
      let status = 200;
      const res = {
        status: (c) => { status = c; return res; },
        json: () => res
      };
      await guard({ path: path, method: method, session: { user: creator } }, res, () => {
        nextCalled = true;
      });
      assert.isFalse(nextCalled, `${method} ${path} が通ってしまいました`);
      assert.equal(status, 403);
    }
  });

  it('作成: 月次予定を作成できる', async () => {
    const result = await create(sampleMonthly);
    assert.equal(result.body.code, 0);
    assert.equal(result.body.schedule.title, '家賃');
    assert.equal(result.body.schedule.dayOfMonth, 25);
  });

  it('作成: 単発予定を作成できる', async () => {
    const result = await create(sampleOnce);
    assert.equal(result.body.code, 0);
    assert.equal(result.body.schedule.recurrence, 'once');
    assert.equal(result.body.schedule.date, '2026-03-10');
  });

  it('作成: 不正な入力は拒否される', async () => {
    const bad = [
      { ...sampleMonthly, title: '   ' },
      { ...sampleMonthly, kind: 'xxx' },
      { ...sampleMonthly, amount: -5 },
      { ...sampleMonthly, recurrence: 'yearly' },
      { ...sampleMonthly, dayOfMonth: 32 },
      { ...sampleOnce, date: '2026-03' }
    ];
    for ( const body of bad ) {
      const result = await create(body);
      assert.equal(result.body.code, -3, JSON.stringify(body));
    }
  });

  it('一覧: 予定定義と自分のフィードトークンが返る（初回アクセスでトークン発行）', async () => {
    const first = await call(apiSchedule.list, {
      session: { user: approver }
    });
    assert.equal(first.body.code, 0);
    assert.equal(first.body.schedules.length, 2);
    // 未発行ならこの時点で発行される
    assert.ok(first.body.feedToken);
    const again = await call(apiSchedule.list, { session: { user: approver } });
    assert.equal(again.body.feedToken, first.body.feedToken);
  });

  it('月次展開: 31日は短い月では末日になる', async () => {
    await create({ ...sampleMonthly, title: '返済', dayOfMonth: 31, amount: 50000 });
    const feb = await call(apiSchedule.month, {
      params: { year: 2027, month: 2 },
      session: { user: approver }
    });
    assert.equal(feb.body.code, 0);
    const repay = feb.body.items.filter((i) => i.title === '返済');
    assert.equal(repay.length, 1);
    assert.equal(repay[0].date, '2027-02-28');
    // 平年2月
    const feb2026 = await call(apiSchedule.month, {
      params: { year: 2026, month: 2 },
      session: { user: approver }
    });
    assert.equal(
      feb2026.body.items.filter((i) => i.title === '返済')[0].date,
      '2026-02-28'
    );
  });

  it('月次展開: 0は月末扱い', async () => {
    await create({ ...sampleMonthly, title: '月末の支払', dayOfMonth: 0, amount: 30000 });
    const jan = await call(apiSchedule.month, {
      params: { year: 2027, month: 1 },
      session: { user: approver }
    });
    const item = jan.body.items.filter((i) => i.title === '月末の支払')[0];
    assert.equal(item.date, '2027-01-31');
  });

  it('月次展開: 単発予定は指定月にだけ出る', async () => {
    const march = await call(apiSchedule.month, {
      params: { year: 2026, month: 3 },
      session: { user: approver }
    });
    assert.ok(march.body.items.some((i) => i.title === '器具のリース一括支払'));
    const april = await call(apiSchedule.month, {
      params: { year: 2026, month: 4 },
      session: { user: approver }
    });
    assert.notOk(april.body.items.some((i) => i.title === '器具のリース一括支払'));
  });

  it('月次展開: 無効化した予定は出ない', async () => {
    const result = await create({ ...sampleMonthly, title: '停止する支払', dayOfMonth: 10, amount: 1000 });
    const scheduleId = result.body.schedule.id;
    await call(apiSchedule.update, {
      params: { id: scheduleId },
      body: { enabled: false },
      session: { user: approver }
    });
    const month = await call(apiSchedule.month, {
      params: { year: 2026, month: 11 },
      session: { user: approver }
    });
    assert.notOk(month.body.items.some((i) => i.title === '停止する支払'));
  });

  it('月次展開: 月計（入金計/出金計/差引）が計算される', async () => {
    await create({
      title: '入金テスト', kind: 'in', amount: 400000,
      recurrence: 'monthly', dayOfMonth: 5
    });
    const nov = await call(apiSchedule.month, {
      params: { year: 2026, month: 11 },
      session: { user: approver }
    });
    assert.equal(nov.body.totalIn, 400000);
    // 出金: 家賃80000 + 返済50000 + 月末30000 = 160000
    assert.equal(nov.body.totalOut, 160000);
    assert.equal(nov.body.balance, 240000);
  });

  it('月次展開: 日付順にソートされる', async () => {
    const nov = await call(apiSchedule.month, {
      params: { year: 2026, month: 11 },
      session: { user: approver }
    });
    const days = nov.body.items.map((i) => i.day);
    const sorted = [...days].sort((a, b) => a - b);
    assert.deepEqual(days, sorted);
  });

  it('年次集計: 月別の入出金計と年計が返る', async () => {
    const result = await call(apiSchedule.year, {
      params: { year: 2026 },
      session: { user: approver }
    });
    assert.equal(result.body.code, 0);
    assert.equal(result.body.months.length, 12);
    // 月次: 入金 入金テスト400000 / 出金 家賃80000+返済50000+月末30000=160000
    const nov = result.body.months[10];
    assert.equal(nov.month, 11);
    assert.equal(nov.totalIn, 400000);
    assert.equal(nov.totalOut, 160000);
    assert.equal(nov.balance, 240000);
    // 単発（2026-03）だけが他の月と違う月計になる
    const march = result.body.months[2];
    assert.equal(march.totalOut, 160000 + 120000);
    // 年計は月計の合計と一致
    assert.equal(result.body.totalIn, 400000 * 12);
    assert.equal(result.body.totalOut, 160000 * 11 + 280000);
    assert.equal(result.body.balance, result.body.totalIn - result.body.totalOut);
  });

  it('ICSフィード: トークンが一致すればtext/calendarで返る', async () => {
    const list = await call(apiSchedule.list, { session: { user: approver } });
    const token = list.body.feedToken;
    const result = await call(apiSchedule.feed, {
      query: { token: token },
      session: null
    });
    assert.equal(result.status, 200);
    assert.match(result.contentType, /^text\/calendar/);
    const ics = result.body;
    assert.include(ics, 'BEGIN:VCALENDAR');
    assert.include(ics, 'END:VCALENDAR');
    // 家賃（毎月25日）が展開されている
    assert.include(ics, 'SUMMARY:(出) 家賃');
    // 展開済み個別VEVENTでUIDが一意
    const uids = ics.split('\r\n').filter((l) => l.startsWith('UID:'));
    assert.equal(new Set(uids).size, uids.length);
    assert.isAbove(uids.length, 0);
  });

  it('ICSフィード: トークンが一致しなければ404', async () => {
    const result = await call(apiSchedule.feed, {
      query: { token: 'bogus-token' },
      session: null
    });
    assert.equal(result.status, 404);
    const noToken = await call(apiSchedule.feed, {
      query: {},
      session: null
    });
    assert.equal(noToken.status, 404);
  });

  it('ICSフィード: 失効ユーザーのトークンは無効', async () => {
    // テストDBは繰り返し使われるので findOrCreate で用意する
    const ghost = await models.User.findOrCreate({
      where: { name: 'schedule-ghost' },
      defaults: {
        name: 'schedule-ghost',
        hashPassword: bcrypt.hashSync('secret', 10),
        deauthorizedAt: new Date('2020-01-01')
      }
    }).then(([user]) => user);
    const token = crypto.randomBytes(16).toString('hex');
    ghost.feedToken = token;
    await ghost.save();
    const result = await call(apiSchedule.feed, {
      query: { token: ghost.feedToken },
      session: null
    });
    assert.equal(result.status, 404);
  });

  it('トークン再生成: 旧トークンは無効になる', async () => {
    const before = await call(apiSchedule.token, { session: { user: approver } });
    const oldToken = before.body.feedToken;
    const after = await call(apiSchedule.token, { session: { user: approver } });
    assert.notEqual(after.body.feedToken, oldToken);
    const oldResult = await call(apiSchedule.feed, {
      query: { token: oldToken },
      session: null
    });
    assert.equal(oldResult.status, 404);
    const newResult = await call(apiSchedule.feed, {
      query: { token: after.body.feedToken },
      session: null
    });
    assert.equal(newResult.status, 200);
  });

  it('guard: フィードは未認証でもPUBLIC_PATHSを通る（ハンドラでトークン照合）', async () => {
    let nextCalled = false;
    let status = 200;
    const res = {
      status: (c) => { status = c; return res; },
      json: () => res,
      set: () => res,
      send: () => res
    };
    await guard({ path: '/schedule/feed', method: 'GET', session: null }, res, () => {
      nextCalled = true;
    });
    assert.isTrue(nextCalled);
    assert.equal(status, 200);
  });
});
