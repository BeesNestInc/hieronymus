import express from 'express';
const app = express();
import axios from 'axios';

import session from 'express-session';
import fileStore from 'session-file-store';
const FileStore = fileStore(session);
import passport from 'passport';
import multipart from 'connect-multiparty';

import cors from 'cors';
import sprightly from 'sprightly';
import ejs from 'ejs';
import path from 'path';

import apiRouter from './routes/api.js';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import homeRouter from './routes/home.js';
import formsRouter from './routes/forms.js';
import {is_authenticated} from './libs/user.js';
import models from './models/index.js';
import { getCompanyInfo } from './libs/utils.js';

import modules from './config/module-list.js';
import env from './config/env.js';
global.env = env;

const __dirname = import.meta.dirname;

// SSRのためにローカルにaxiosを向けるため
axios.defaults.baseURL = `http://localhost:${global.env.port}`;

app.use(logger('dev'));		//	アクセスログを見たい時には有効にする
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors({
  origin: ['*']
}));
app.use(multipart());

app.use(session({
  secret: env.expressSecret,
  resave: true,
  saveUninitialized: false,
  name: env.appName,					    //	ここの名前は起動するnode.js毎にユニークにする
  store: new FileStore({
    ttl: global.env.session_ttl,	//	default 3600(s)
    reapInterval: global.env.session_ttl,
    path: global.env.session_path	//	default path
  }),

  cookie: {
    httpOnly: true,
    secure: false,
    maxage: null
  }
}));
app.use(passport.initialize());
app.use(passport.session());

app.set('views', './views');

app.engine('spy', sprightly);
app.set('view engine', 'spy');
//app.engine('ejs', ejs);
app.set('view engine', 'ejs');

app.use('/dist', express.static(path.join(__dirname, './dist')));
app.use('/style', express.static(path.join(__dirname, './front/stylesheets')));
app.use('/public', express.static(path.join(__dirname, './public')));

const screen = async (req, res, next) => {
  console.log('current', req.params.current);
  console.log('command', req.params.command);
  let per = modules.find((ent) => {
    return	( req.params.current === ent.name );
  })
  if	( per )	{
    const company = await getCompanyInfo();
  	if ( !per.authority || per.authority(req.session.user, company) )	{
    	res.render('index.spy', {
      	title: per.title,
      	term: req.session.term,
    	});
  	} else {
    	res.redirect('/home');
    }
  } else {
    next();
  }
}

const voucherFile = (req, res, next) => {
  console.log('/voucher/file', req.params.id);
  if ( req.session.user.accounting )	{
    models.VoucherFile.findOne({
      where: {
        id: req.params.id
      }
    }).then((content) => {
      res.set('Content-Type', content.mimeType);
      res.send(content.body);
    })
  } else {
    res.redirect('/home');
  }
}


app.use('/', homeRouter);

app.get('/voucher/file/:id', is_authenticated, voucherFile);
app.use('/forms', formsRouter);
app.use('/api', apiRouter);

app.use('/:current/:command/:arg1/:arg2/:arg3', is_authenticated, screen);
app.use('/:current/:command/:arg1/:arg2', is_authenticated, screen);
app.use('/:current/:command/:arg1', is_authenticated, screen);
app.use('/:current/:id', is_authenticated, screen);
app.use('/:current', is_authenticated, screen);

const spaFallback = (req, res, next) => {
  // API, フォーム、ファイルへのリクエストは除外
  if (req.path.startsWith('/api/') || req.path.startsWith('/forms/') || req.path.includes('.')) {
    return next();
  }
  // それ以外のパスはSPAのエントリポイントを返す
  res.render('index.spy', {
    title: 'Hieronymus',
    term: req.session.term,
  });
}
app.use(is_authenticated, spaFallback);

app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] 500エラー:`, {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        headers: req.headers
    });
    
    res.status(500).send(`
        <h1>500 - Internal Server Error</h1>
        <p>${err.message}</p>
    `);
});

export default app;

