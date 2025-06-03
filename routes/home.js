import express from 'express';
const router = express.Router();
import {is_authenticated, passport} from '../libs/user.js';
import models from '../models/index.js';
const Op = models.Sequelize.Op;


const home =  async (req, res, next) => {
  //console.log('term', req.params.term, req.session.term);
  const countFy = await models.FiscalYear.count();
  if ( countFy === 0 ){
    res.redirect('/setup');
  }else{
    if	( !req.params.term )	{
      if  ( !req.session.term ) {
        req.session.term = 1;
      }
      res.render('index.spy', {
        term: req.session.term
      });
    } else {
      req.session.term = req.params.term;
      req.session.save(() => {
        res.redirect('/home');
      });
    }
  }
};

const login =  async (req, res, next) => {
  res.render('login.spy', {
  });
};

const setup  =  async (req, res, next) => {
  const countFy = await models.FiscalYear.count();
  if ( countFy === 0 ){
    res.render('setup.spy', {
      title: 'Setup'
    });
  }else{
    res.redirect('/home');
  }
};

router.get('/setup', is_authenticated, setup);
router.get('/home/:term', is_authenticated, home);
router.get('/home', is_authenticated, home);
router.get('/login', login);
router.get('/logout', (req, res, next) => {
  //console.log('logout', req.user);
  req.logout((err) => {
    if (err) { return next(err); }
    req.session.destroy();
  });
  res.redirect('/login');
});
router.get('/signup', (req, res, next) => {
  res.render('index.spy', {
    title: '',
    msg_type: '',
    message: ''
  });
});
router.get('/', is_authenticated, home);

export default router;
