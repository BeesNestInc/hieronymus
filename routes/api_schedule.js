import models from '../models/index.js';
import crypto from 'crypto';

// 予定表（資金繰り予定）。
// 予定データは会社単位の共有。閲覧/編集権限は guard（libs/permission.js）が
// 判定する。ICSフィードだけはトークン認証（PUBLIC_PATHS で guard を回避し、
// ハンドラ内で token を照合する。購読クライアントはセッションCookieを持てないため）

const pad2 = (n) => String(n).padStart(2, '0');

const daysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

// 予定を特定の年月に展開する。存在しない日（31日→2月）はその月の末日に繰り上げ。
// dayOfMonth 0 と null は「月末」扱い
const occurrenceDate = (schedule, year, month) => {
  if ( schedule.recurrence === 'once' ) {
    if ( !schedule.date ) {
      return null;
    }
    const [y, m] = String(schedule.date).split('-').map((v) => parseInt(v));
    return ( y === year && m === month ) ? String(schedule.date) : null;
  }
  // monthly
  const days = daysInMonth(year, month);
  let day = parseInt(schedule.dayOfMonth);
  if ( !Number.isInteger(day) || day <= 0 || day > days ) {
    day = days;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

// 展開範囲: 先月から12ヶ月後まで
const feedWindow = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 12, 1);
  return [first, last];
};

// 展開済み予定に個別設定（ScheduleOverrides）を適用するための
// 参照マップを作る。キーは `${scheduleId}:${date}`
const overrideMap = (overrides) => {
  const map = {};
  for ( const o of overrides ) {
    map[`${o.scheduleId}:${o.date}`] = o;
  }
  return map;
};

const loadOverrides = async () => {
  return models.ScheduleOverride.findAll();
};

const expandSchedules = (schedules, year, month, overrides = []) => {
  const oMap = overrideMap(overrides);
  const items = [];
  for ( const schedule of schedules ) {
    if ( !schedule.enabled ) {
      continue;
    }
    const date = occurrenceDate(schedule, year, month);
    if ( !date ) {
      continue;
    }
    // 月次予定には (scheduleId, 発生日) の個別設定があれば差し替える
    const o = oMap[`${schedule.id}:${date}`];
    if ( o && o.deleted ) {
      // 「この月は予定を取り消す」設定
      continue;
    }
    items.push({
      scheduleId: schedule.id,
      date: date,
      day: parseInt(String(date).split('-')[2]),
      kind: ( o && o.kind ) ? o.kind : schedule.kind,
      title: ( o && o.title ) ? o.title : schedule.title,
      amount: Number(( o && o.amount !== null && o.amount !== undefined ) ?
        o.amount : schedule.amount),
      note: ( o && o.note !== null && o.note !== undefined ) ? o.note : schedule.note,
      overridden: Boolean(o)
    });
  }
  items.sort((a, b) => ( a.day - b.day ) || a.title.localeCompare(b.title, 'ja'));
  const totalIn = items.filter((i) => i.kind === 'in')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalOut = items.filter((i) => i.kind === 'out')
    .reduce((sum, i) => sum + i.amount, 0);
  return {
    items: items,
    totalIn: totalIn,
    totalOut: totalOut,
    balance: totalIn - totalOut
  };
};

const validate = (body) => {
  if ( !body.title || !String(body.title).trim() ) {
    return 'タイトルが空です';
  }
  // 'plan' はお金の関係しない単なる予定（「一応あります」レベルのもの）
  if ( body.kind !== 'in' && body.kind !== 'out' && body.kind !== 'plan' ) {
    return '種別が不正です';
  }
  // 'plan' はお金の関係しない単純予定。金額は任意（省略時は0）
  const amount = ( body.kind === 'plan' &&
      ( body.amount === undefined || body.amount === null || body.amount === '' ) ) ?
    0 : Number(body.amount);
  if ( !Number.isFinite(amount) || amount < 0 ) {
    return '金額が不正です';
  }
  if ( body.recurrence !== 'monthly' && body.recurrence !== 'once' ) {
    return '繰り返しが不正です';
  }
  if ( body.recurrence === 'monthly' ) {
    const day = parseInt(body.dayOfMonth);
    if ( ( !Number.isInteger(day) ) || day < 0 || day > 31 ) {
      return '発生日が不正です（0=月末、1-31）';
    }
  }
  if ( body.recurrence === 'once' && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ) {
    return '発生日が不正です';
  }
  return null;
};

const scheduleValues = (body) => {
  const values = {
    title: String(body.title).trim(),
    kind: body.kind,
    amount: Math.round(Number(body.amount) || 0),
    recurrence: body.recurrence,
    note: body.note ? String(body.note) : null,
    enabled: ( body.enabled === undefined ) ? true : Boolean(body.enabled)
  };
  if ( body.recurrence === 'monthly' ) {
    values.dayOfMonth = parseInt(body.dayOfMonth);
    values.date = null;
  } else {
    values.dayOfMonth = null;
    values.date = body.date;
  }
  return values;
};

// RFC 5545 のテキストエスケープ
const icsEscape = (text) => {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
};

const icsDate = (date) => String(date).replaceAll('-', '');

const buildICS = (schedules, overrides = []) => {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const [winStart, winEnd] = feedWindow();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hieronymus//Schedule//JA',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Hieronymus 予定表'
  ];
  // 展開は月単位。ウィンドウ内の各月を舐めて、月内の発生を出す
  const cursor = new Date(winStart);
  while ( cursor < winEnd ) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const { items } = expandSchedules(schedules, year, month, overrides);
    for ( const item of items ) {
      if ( item.date < `${winStart.getFullYear()}-${pad2(winStart.getMonth() + 1)}-01` ) {
        continue;
      }
      const next = new Date(year, month - 1, item.day + 1);
      const dtend = `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
      const kindLabel = ( item.kind === 'in' ) ? '入' :
        ( item.kind === 'out' ) ? '出' : '予';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${item.scheduleId}-${item.date}@hieronymus`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(item.date)}`,
        `DTEND;VALUE=DATE:${icsDate(dtend)}`,
        `SUMMARY:(${kindLabel}) ${icsEscape(item.title)}`,
        `DESCRIPTION:金額 ${item.amount.toLocaleString('ja-JP')}円` +
          ( item.note ? ` ${icsEscape(item.note)}` : '' )
      );
      lines.push('END:VEVENT');
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  lines.push('END:VCALENDAR');
  // RFC 5545 は CRLF
  return lines.join('\r\n') + '\r\n';
};

const feedUser = async (token) => {
  if ( !token ) {
    return null;
  }
  const user = await models.User.findOne({
    where: {
      feedToken: String(token)
    }
  });
  // 失効ユーザーのトークンは無効として扱う
  if ( !user || !user.is_live ) {
    return null;
  }
  return user;
};

export default {
  // 予定定義の一覧（編集用）+ 自分のフィードトークン。
  // トークンが無ければ初回アクセス時に発行する（購読URLが常に使えるように）
  list: async (req, res, next) => {
    try {
      const schedules = await models.Schedule.findAll({
        order: [
          ['recurrence', 'ASC'],
          ['dayOfMonth', 'ASC'],
          ['date', 'ASC'],
          ['id', 'ASC']
        ]
      });
      const user = await models.User.findByPk(req.session.user.id);
      let token = user.feedToken;
      if ( !token ) {
        token = crypto.randomBytes(16).toString('hex');
        user.feedToken = token;
        await user.save();
      }
      const overrides = await loadOverrides();
      res.json({
        code: 0,
        schedules: schedules,
        overrides: overrides,
        feedToken: token,
        feedUrl: `/api/schedule/feed?token=${encodeURIComponent(token)}`
      });
    } catch (e) {
      console.log('schedule list error', e);
      res.json({ code: -1 });
    }
  },

  // 指定月の展開済み予定と月計
  month: async (req, res, next) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      if ( !Number.isInteger(year) || !Number.isInteger(month) ||
           month < 1 || month > 12 ) {
        res.json({ code: -3, message: '年月が不正です' });
        return;
      }
      const schedules = await models.Schedule.findAll();
      const overrides = await loadOverrides();
      const result = expandSchedules(schedules, year, month, overrides);
      res.json({
        code: 0,
        year: year,
        month: month,
        ...result
      });
    } catch (e) {
      console.log('schedule month error', e);
      res.json({ code: -1 });
    }
  },

  // 指定年の月別集計（年ビュー用）
  year: async (req, res, next) => {
    try {
      const year = parseInt(req.params.year);
      if ( !Number.isInteger(year) ) {
        res.json({ code: -3, message: '年が不正です' });
        return;
      }
      const schedules = await models.Schedule.findAll();
      const overrides = await loadOverrides();
      const months = [];
      for ( let month = 1; month <= 12; month += 1 ) {
        const result = expandSchedules(schedules, year, month, overrides);
        months.push({
          month: month,
          totalIn: result.totalIn,
          totalOut: result.totalOut,
          balance: result.balance,
          count: result.items.length
        });
      }
      const totalIn = months.reduce((sum, m) => sum + m.totalIn, 0);
      const totalOut = months.reduce((sum, m) => sum + m.totalOut, 0);
      res.json({
        code: 0,
        year: year,
        months: months,
        totalIn: totalIn,
        totalOut: totalOut,
        balance: totalIn - totalOut
      });
    } catch (e) {
      console.log('schedule year error', e);
      res.json({ code: -1 });
    }
  },

  post: async (req, res, next) => {
    try {
      const error = validate(req.body);
      if ( error ) {
        res.json({ code: -3, message: error });
        return;
      }
      const schedule = await models.Schedule.create(scheduleValues(req.body));
      res.json({ code: 0, schedule: schedule });
    } catch (e) {
      console.log('schedule create error', e);
      res.json({ code: -1 });
    }
  },

  update: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id || req.body.id);
      const schedule = await models.Schedule.findByPk(id);
      if ( !schedule ) {
        res.json({ code: -2 });
        return;
      }
      const error = validate({ ...schedule.dataValues, ...req.body });
      if ( error ) {
        res.json({ code: -3, message: error });
        return;
      }
      await schedule.set(scheduleValues({ ...schedule.dataValues, ...req.body }));
      await schedule.save();
      res.json({ code: 0, schedule: schedule });
    } catch (e) {
      console.log('schedule update error', e);
      res.json({ code: -1 });
    }
  },

  delete: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const count = await models.Schedule.destroy({
        where: {
          id: id
        }
      });
      res.json({ code: count > 0 ? 0 : -2 });
    } catch (e) {
      console.log('schedule delete error', e);
      res.json({ code: -1 });
    }
  },

  // 個別設定（この月だけの上書き/取り消し）。月次予定にのみ使う。
  // 用途: 「ざくっと金額を入れておいて、確定したら本当の金額を入れる」
  overrideUpsert: async (req, res, next) => {
    try {
      const body = req.body;
      const scheduleId = parseInt(body.scheduleId);
      const date = String(body.date || '');
      if ( !Number.isInteger(scheduleId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) ) {
        res.json({ code: -3, message: '予定または日付が不正です' });
        return;
      }
      const schedule = await models.Schedule.findByPk(scheduleId);
      if ( !schedule ) {
        res.json({ code: -2 });
        return;
      }
      if ( schedule.recurrence !== 'monthly' ) {
        res.json({ code: -3, message: '単発の予定には個別設定は使えません' });
        return;
      }
      if ( body.deleted ) {
        // この月の予定を取り消す
        let o = await models.ScheduleOverride.findOne({
          where: {
            scheduleId: scheduleId,
            date: date
          }
        });
        if ( o ) {
          await o.set({ deleted: true });
          await o.save();
        } else {
          o = await models.ScheduleOverride.create({
            scheduleId: scheduleId,
            date: date,
            deleted: true
          });
        }
        res.json({ code: 0, override: o });
        return;
      }
      const error = validate({
        title: ( body.title !== undefined && body.title !== null ) ? body.title : schedule.title,
        kind: ( body.kind !== undefined && body.kind !== null ) ? body.kind : schedule.kind,
        amount: ( body.amount !== undefined && body.amount !== null ) ? body.amount : schedule.amount,
        recurrence: 'monthly',
        dayOfMonth: 1
      });
      if ( error ) {
        res.json({ code: -3, message: error });
        return;
      }
      const values = {
        scheduleId: scheduleId,
        date: date,
        title: String(body.title !== undefined && body.title !== null ? body.title : schedule.title).trim(),
        kind: ( body.kind !== undefined && body.kind !== null ) ? body.kind : schedule.kind,
        amount: Math.round(Number(body.amount !== undefined && body.amount !== null ?
          body.amount : schedule.amount)),
        note: ( body.note !== undefined ) ?
          ( body.note ? String(body.note) : null ) :
          schedule.note,
        deleted: false
      };
      let o = await models.ScheduleOverride.findOne({
        where: {
          scheduleId: scheduleId,
          date: date
        }
      });
      if ( o ) {
        await o.set(values);
        await o.save();
      } else {
        o = await models.ScheduleOverride.create(values);
      }
      res.json({ code: 0, override: o });
    } catch (e) {
      console.log('schedule override error', e);
      res.json({ code: -1 });
    }
  },

  // 個別設定を取り消して毎月の予定に戻す
  overrideReset: async (req, res, next) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const date = req.params.date;
      if ( !Number.isInteger(scheduleId) ||
           !/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ) {
        res.json({ code: -3, message: '予定または日付が不正です' });
        return;
      }
      const count = await models.ScheduleOverride.destroy({
        where: {
          scheduleId: scheduleId,
          date: date
        }
      });
      res.json({ code: count > 0 ? 0 : -2 });
    } catch (e) {
      console.log('schedule override reset error', e);
      res.json({ code: -1 });
    }
  },

  // 自分のフィードトークンを再生成（旧トークンは無効になる）
  token: async (req, res, next) => {
    try {
      const token = crypto.randomBytes(16).toString('hex');
      const user = await models.User.findByPk(req.session.user.id);
      user.feedToken = token;
      await user.save();
      res.json({
        code: 0,
        feedToken: token,
        feedUrl: `/api/schedule/feed?token=${encodeURIComponent(token)}`
      });
    } catch (e) {
      console.log('schedule token error', e);
      res.json({ code: -1 });
    }
  },

  // ICSフィード。トークン認証（guardは PUBLIC_PATHS で回避している）
  feed: async (req, res, next) => {
    try {
      const user = await feedUser(req.query.token);
      if ( !user ) {
        // 存在しないトークンでも404で返す（トークンの列挙を防ぐ）
        res.status(404).set('Content-Type', 'text/plain').send('not found');
        return;
      }
      const schedules = await models.Schedule.findAll({
        where: {
          enabled: true
        }
      });
      const overrides = await loadOverrides();
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.send(buildICS(schedules, overrides));
    } catch (e) {
      console.log('schedule feed error', e);
      res.json({ code: -1 });
    }
  }
};
