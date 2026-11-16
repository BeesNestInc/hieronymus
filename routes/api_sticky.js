import models from '../models/index.js';
const Op = models.Sequelize.Op;

// Sticky（付箋/申し送り）。
// - Sticky: 作者と本文。作者と受信者本人が見られる
// - StickyStatus: 受信者ごとの状態（未読 = readAt IS NULL）
// 権限はログイン済み全員。「付箋を貼る」感覚で使えるように特定権限を要求しない

const authorInclude = [
  {
    model: models.User,
    as: 'author',
    attributes: ['name'],
    include: [
      {
        model: models.Member,
        as: 'member',
        attributes: ['legalName', 'tradingName']
      }
    ]
  }
];

const receiverInclude = [
  {
    model: models.User,
    attributes: ['name'],
    include: [
      {
        model: models.Member,
        as: 'member',
        attributes: ['legalName', 'tradingName']
      }
    ]
  }
];

const displayName = (user) => {
  if ( !user ) {
    return '';
  }
  return ( user.member && ( user.member.tradingName || user.member.legalName ) ) || user.name;
};

const cleanupReceivers = (receiverIds) => {
  const ids = ( receiverIds || [] )
    .map((id) => parseInt(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
};

// 重要度。0=通常 / 1=重要 / 2=至急。UIとここでだけ意味を持たせる
const importanceOf = (value) => {
  const n = parseInt(value);
  return ( Number.isInteger(n) && n >= 0 && n <= 2 ) ? n : 0;
};

const createStatuses = async (sticky, receiverIds, importance) => {
  for ( const receiverId of receiverIds ) {
    await models.StickyStatus.create({
      stickyId: sticky.id,
      receiverId: receiverId,
      importance: importance
    });
  }
};

export default {
  // 自分宛のメッセージ一覧（未読優先・重要度・新しい順）。
  // 自分が作成したものも一覧に含める（作者は自分のメッセージを本体削除できる）
  list: async (req, res, next) => {
    const me = req.session.user.id;
    try {
      const statuses = await models.StickyStatus.findAll({
        where: {
          receiverId: me
        },
        include: [
          {
            model: models.Sticky,
            as: 'Sticky',
            include: authorInclude
          },
          ...receiverInclude
        ]
      });
      const mine = await models.Sticky.findAll({
        where: {
          authorId: me
        },
        include: [
          {
            model: models.StickyStatus,
            as: 'StickyStatuses',
            include: receiverInclude
          }
        ]
      });
      const seen = new Set(statuses.map((s) => s.stickyId));
      // 作者が自分宛に送っていない自分のメッセージ（受信状態が無いもの）
      const authorOnly = mine.filter((sticky) => !seen.has(sticky.id));
      const items = [];
      for ( const status of statuses ) {
        items.push({
          statusId: status.id,
          stickyId: status.stickyId,
          kind: status.Sticky.kind,
          message: status.Sticky.message,
          authorId: status.Sticky.authorId,
          authorName: displayName(status.Sticky.author),
          receiverName: displayName(status.User),
          importance: status.importance,
          readAt: status.readAt,
          createdAt: status.createdAt,
          isMine: status.Sticky.authorId === me
        });
      }
      for ( const sticky of authorOnly ) {
        items.push({
          statusId: null,
          stickyId: sticky.id,
          kind: sticky.kind,
          message: sticky.message,
          authorId: sticky.authorId,
          authorName: displayName(sticky.author),
          receiverNames: sticky.StickyStatuses.map((s) => displayName(s.User)),
          importance: Math.max(0, ...sticky.StickyStatuses.map((s) => s.importance || 0)),
          readAt: sticky.createdAt,
          createdAt: sticky.createdAt,
          isMine: true
        });
      }
      items.sort((a, b) => {
        // 未読優先 → 重要度 → 新しい順
        const ua = a.readAt ? 1 : 0;
        const ub = b.readAt ? 1 : 0;
        if ( ua !== ub ) {
          return ua - ub;
        }
        const ia = a.importance || 0;
        const ib = b.importance || 0;
        if ( ia !== ib ) {
          return ib - ia;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      const unreadCount = items.filter((item) => !item.readAt).length;
      res.json({
        code: 0,
        stickies: items,
        unreadCount: unreadCount
      });
    } catch (e) {
      console.log('sticky list error', e);
      res.json({ code: -1 });
    }
  },

  // 新規作成。sendToAll で全ユーザー宛、それ以外は receiverIds
  post: async (req, res, next) => {
    const me = req.session.user.id;
    const body = req.body;
    try {
      if ( !body.message || !String(body.message).trim() ) {
        res.json({ code: -3, message: '本文が空です' });
        return;
      }
      let receiverIds = [];
      if ( body.sendToAll ) {
        const users = await models.User.findAll({
          attributes: ['id']
        });
        // 自分も含めた全員（TODO的な自分宛メモもこれで作れる）
        receiverIds = cleanupReceivers(users.map((u) => u.id));
      } else {
        receiverIds = cleanupReceivers(body.receiverIds);
      }
      // 種別。UI からは明示的に来る。未指定のときは宛先の構成から判定する
      // （旧互換: 宛先が自分のみ or 未指定なら メモ、他人が入れば 申し送り）
      let kind;
      if ( body.kind === 'memo' ) {
        // メモは自分用。宛先指定があっても無視して自分宛に固定する
        kind = 'memo';
        receiverIds = [me];
      } else if ( body.kind === 'handoff' ) {
        if ( receiverIds.length === 0 ) {
          res.json({ code: -3, message: '宛先を選んでください' });
          return;
        }
        kind = 'handoff';
      } else {
        kind = ( body.sendToAll ||
          receiverIds.some((rid) => rid !== me) ) ? 'handoff' : 'memo';
        if ( receiverIds.length === 0 ) {
          receiverIds = [me];
        }
      }
      const sticky = await models.Sticky.create({
        authorId: me,
        kind: kind,
        message: body.message
      });
      await createStatuses(sticky, receiverIds, importanceOf(body.importance));
      res.json({
        code: 0,
        sticky: {
          id: sticky.id,
          kind: kind,
          receiverIds: receiverIds
        }
      });
    } catch (e) {
      console.log('sticky create error', e);
      res.json({ code: -1 });
    }
  },

  // 自分宛メッセージを既読にする
  read: async (req, res, next) => {
    const me = req.session.user.id;
    const id = parseInt(req.params.id);
    try {
      const status = await models.StickyStatus.findOne({
        where: {
          stickyId: id,
          receiverId: me
        }
      });
      if ( !status ) {
        res.status(403).json({ code: -10, message: 'permission denied' });
        return;
      }
      if ( !status.readAt ) {
        status.readAt = new Date();
        await status.save();
      }
      res.json({ code: 0 });
    } catch (e) {
      console.log('sticky read error', e);
      res.json({ code: -1 });
    }
  },

  // 自分宛のコピーを削除（受信者本人のみ）
  deleteStatus: async (req, res, next) => {
    const me = req.session.user.id;
    const id = parseInt(req.params.statusId);
    try {
      const count = await models.StickyStatus.destroy({
        where: {
          id: id,
          receiverId: me
        }
      });
      res.json({ code: count > 0 ? 0 : -2 });
    } catch (e) {
      console.log('sticky deleteStatus error', e);
      res.json({ code: -1 });
    }
  },

  // 本体削除。作者のみ。全員の受信状態も消える
  delete: async (req, res, next) => {
    const me = req.session.user.id;
    const id = parseInt(req.params.id);
    try {
      const count = await models.Sticky.destroy({
        where: {
          id: id,
          authorId: me
        }
      });
      res.json({ code: count > 0 ? 0 : -2 });
    } catch (e) {
      console.log('sticky delete error', e);
      res.json({ code: -1 });
    }
  },

  // 転送。閲覧できる（自分宛 or 自分が作成した）メッセージをそのまま他ユーザーへ
  forward: async (req, res, next) => {
    const me = req.session.user.id;
    const id = parseInt(req.params.id);
    const body = req.body;
    try {
      const sticky = await models.Sticky.findByPk(id);
      if ( !sticky ) {
        res.json({ code: -2 });
        return;
      }
      const canSee = ( sticky.authorId === me ) ||
        ( await models.StickyStatus.count({
          where: {
            stickyId: id,
            receiverId: me
          }
        }) > 0 );
      if ( !canSee ) {
        res.status(403).json({ code: -10, message: 'permission denied' });
        return;
      }
      const receiverIds = cleanupReceivers(body.receiverIds);
      if ( receiverIds.length === 0 ) {
        res.json({ code: -3, message: '宛先がありません' });
        return;
      }
      // 既に受信しているユーザーには二重に送らない
      const existing = await models.StickyStatus.findAll({
        where: {
          stickyId: id,
          receiverId: {
            [Op.in]: receiverIds
          }
        },
        attributes: ['receiverId']
      });
      const targets = receiverIds.filter((rid) =>
        !existing.some((s) => s.receiverId === rid));
      await createStatuses(sticky, targets, 0);
      // メモを他人に転送したら申し送りになる
      if ( ( targets.length > 0 ) && ( sticky.kind === 'memo' ) ) {
        sticky.kind = 'handoff';
        await sticky.save();
      }
      res.json({
        code: 0,
        forwarded: targets.length,
        skipped: receiverIds.length - targets.length
      });
    } catch (e) {
      console.log('sticky forward error', e);
      res.json({ code: -1 });
    }
  }
};
