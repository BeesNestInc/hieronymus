import models from '../models/index.js';
const Op = models.Sequelize.Op;
import axios from 'axios';
import { JSDOM } from 'jsdom';

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
      models.Menu.findByPk(id, {
      }).then((menu) => {
        res.json({
          menu: menu
        });
      });
    }
  },
  post: (req, res, next) => {
    let body = req.body;
    body.userId = req.session.user.id;
    models.Menu.create(body).then((menu) => {
      //console.log(menu);
      res.json({
        menu: menu
      });
    });
  },
  update: async(req, res, next) => {
    let body = req.body;

    if	( body.menus )	{
			let menus = req.body.menus;
      for ( const menu of menus ) {
        if  ( menu.id ) {
          let result = await models.Menu.findByPk(menu.id);
          result.set(menu);
          await result.save();
        } else {
          await models.Menu.create(menu);
        }
      }
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
      menu.destroy().then(() => {
        res.json({
          code: 0});
      });
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
