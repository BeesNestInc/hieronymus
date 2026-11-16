import models from '../models/index.js';
const Op = models.Sequelize.Op;
import axios from 'axios';
import { JSDOM } from 'jsdom';

// マイページ（カスタムメニュー）の所有権。
// - 自分のページ（userId = 自分）は自由に読み書きできる
// - テンプレート（userId = null）の変更・削除は管理者のみ
// - 他人のページは管理者のみ読める（編集はしない）
const isOwner = (menu, user) => {
  return menu.userId === user.id;
};

const canManage = (menu, user) => {
  return isOwner(menu, user) || Boolean(user.administrable);
};

export default {
  get: async (req, res, next) => {
    let id =  req.params.id;
    //console.log('/api/menu/', id);
    if	( !id )	{
      models.Menu.findAll({
        where: {
          userId: req.session.user.id,
          displayOrder: {
            [Op.gt]: 0
          }
        },
        order: [
          ['displayOrder', 'ASC']
        ],
				include: [
          {
          	model: models.User,
          	as: 'user'
        	}
        ]
      }).then( async(menus) => {
        res.json({
          menus: menus
        });
      });
    } else {
      models.Menu.findByPk(id).then((menu) => {
        if ( !menu ) {
          res.status(404).json({ code: -2, message: 'not found' });
          return;
        }
        // 自分のページか、テンプレート（userId=null）か、管理者のみ参照可
        if ( !canManage(menu, req.session.user) && menu.userId !== null ) {
          res.status(403).json({ code: -10, message: 'permission denied' });
          return;
        }
        res.json({
          menu: menu
        });
      });
    }
  },
  post: (req, res, next) => {
    let body = req.body;
    // userId は常に自分。テンプレート(userId=null)をAPIで作ることはできず、
    // 管理者の「公開」操作でのみ作られる
    body.userId = req.session.user.id;
    if ( body.displayOrder === undefined ) {
      body.displayOrder = 99;
    }
    models.Menu.create(body).then((menu) => {
      //console.log(menu);
      res.json({
        menu: menu
      });
    });
  },
  update: async(req, res, next) => {
    let body = req.body;
    const me = req.session.user;

    if	( body.menus )	{
			let menus = req.body.menus;
      // サイドバーの並べ替え。自分のページのみ対象（他人の指定は拒否）
      for ( const menu of menus ) {
        if  ( menu.id ) {
          let result = await models.Menu.findByPk(menu.id);
          if ( !result || !canManage(result, me) ) {
            res.status(403).json({ code: -10, message: 'permission denied' });
            return;
          }
          if ( result.userId === null ) {
            // テンプレートの並び順を変えさせない（公開順は管理者が管理）
            res.status(403).json({ code: -10, message: 'permission denied' });
            return;
          }
          menu.userId = result.userId;
          result.set(menu);
          await result.save();
        } else {
          menu.userId = me.id;
          await models.Menu.create(menu);
        }
      }
      models.Menu.findAll({
        where: {
          userId: me.id,
          displayOrder: {
            [Op.gt]: 0
          }
        },
        order: [
          ['displayOrder', 'ASC']
        ],
				include: [
          {
          	model: models.User,
          	as: 'user'
        	}
        ]
      }).then((menus) => {
        res.json({
          menus: menus
       	})
      }).catch((e) => {
        console.log(e);
      })
    } else {
      let id = req.params.id ? req.params.id : body.id;
     	let menu = await models.Menu.findByPk(id)
     	if	( menu )	{
        if ( !canManage(menu, me) ) {
          res.status(403).json({ code: -10, message: 'permission denied' });
          return;
        }
        // 所有者（userId）は更新で書き換えられない
        // （テンプレートを個人のページにすり替えることを防ぐ）
        body.userId = menu.userId;
        menu.set(body);
        menu.save().then(() => {
        	res.json({
          	menu: menu
        	});
        });
      }
    }
  },
  delete: async(req, res, next) => {
    let body = req.body;
    let id = req.params.id ? req.params.id : body.id;

    let menu = await models.Menu.findByPk(id);
    if	( menu )	{
      // 自分のページのみ削除できる。テンプレートは管理者のみ
      if ( !canManage(menu, req.session.user) ) {
        res.status(403).json({ code: -10, message: 'permission denied' });
        return;
      }
      menu.destroy().then(() => {
        res.json({
          code: 0});
      });
    } else {
      res.json({ code: -2 });
    }
  },
  // 自分（または任意の）マイページをテンプレートとして公開する。管理者のみ。
  // 公開されたマイページは全ユーザーの「＋」一覧に現れ、各自が複製して使う
  publish: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const menu = await models.Menu.findByPk(id);
      if ( !menu ) {
        res.status(404).json({ code: -2, message: 'not found' });
        return;
      }
      if ( !canManage(menu, req.session.user) ) {
        res.status(403).json({ code: -10, message: 'permission denied' });
        return;
      }
      const maxOrder = await models.Menu.max('displayOrder', {
        where: {
          userId: null
        }
      });
      const template = await models.Menu.create({
        title: menu.title,
        userId: null,
        displayOrder: ( Number.isInteger(maxOrder) ? maxOrder : 0 ) + 1,
        body: menu.body
      });
      res.json({
        code: 0,
        template: template
      });
    } catch (e) {
      console.log('menu publish error', e);
      res.json({ code: -1 });
    }
  },
  getTemplates: async (req, res, next) => {
    models.Menu.findAll({
      where: {
        userId: null,
        displayOrder: {
          [Op.gt]: 0
        }
      },
      order: [
        ['displayOrder', 'ASC']
      ],
    }).then( async(templates) => {
      res.json({
        templates: templates
      });
    });
  },
  preview: async (req, res, next) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
  
    try {
      const isYouTube = (url) => {
        const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
        return ytRegex.test(url);
      };
  
      const extractYouTubeId = (url) => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        return match ? match[1] : null;
      };
      // Favicon取得関数
      const getFaviconUrl = (baseUrl) => {
        const links = Array.from(doc.querySelectorAll('link[rel*="icon"]'));
        for (const link of links) {
          const href = link.getAttribute('href');
          if (href) {
            try {
              return new URL(href, baseUrl).href;
            } catch {}
          }
        }
        return new URL('/favicon.ico', baseUrl).href;
      }
      const preview = {
        title: '',
        description: '',
        image: '',
        url: targetUrl,
        favicon: '',
      };
      // HTMLを取得（CORS関係ないのでサーバ側でOK）
      const response = await axios.get(targetUrl, { timeout: 8000 });
      const html = response.data;
      // DOMに変換
      const dom = new JSDOM(html);
      const doc = dom.window.document;
  
      // メタデータ取得関数
      const getMeta = (name) =>
        doc.querySelector(`meta[property="${name}"]`)?.content ||
        doc.querySelector(`meta[name="${name}"]`)?.content ||
        null;
  
      // YouTube用の特殊処理
      if (isYouTube(targetUrl)) {
        const videoId = extractYouTubeId(targetUrl);
        if (videoId) {
          preview.title = getMeta('og:title') || doc.querySelector('title')?.textContent || 'YouTube Video';
          //preview.description = `<iframe width="320" height="240" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer;" allowfullscreen></iframe>`;
          preview.description = `<iframe width="440" height="330" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer;" allowfullscreen></iframe>`;
          //preview.image = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          preview.favicon = 'https://www.youtube.com/favicon.ico';
          return res.json(preview);
        }
      } else {
        preview.title = getMeta('og:title') || doc.querySelector('title')?.textContent || '(no title)';
        preview.description = getMeta('og:description') || getMeta('description');
        preview.image = getMeta('og:image');
        preview.url = getMeta('og:url') || targetUrl;
        preview.favicon = getFaviconUrl(targetUrl);
      }
      res.json(preview);
    } catch (error) {
      console.error('URL preview fetch error:', error.message);
      res.status(500).json({ error: 'Failed to fetch or parse target URL' });
    }
  }
};
