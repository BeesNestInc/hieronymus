import trial_balance from '../libs/trial_balance.js';
import models from '../models/index.js';

export default {
  get: async (req, res, next) => {
    try {
      let term;
      let lastDate;
      const param = req.params.param;
      let ym;
      if  ( param ) {
        const params = param.split('-');
        if  ( params[1] ) {
          ym = params;
          if (!req.session || !req.session.term) {
            return res.status(401).json({ error: 'Unauthorized: term not set in session.' });
          } else {
            term = req.session.term;
          }
        } else {
          term = parseInt(params[0]);
        }
      } else {
        if (!req.session || !req.session.term) {
          return res.status(401).json({ error: 'Unauthorized: term not set in session.' });
        } else {
          term = req.session.term;
        }
      }
      if (ym) {
        const year = parseInt(ym[0]);
        const monthIndex = parseInt(ym[1]) - 1;
        // 期間の終わりを「月の最終日」に設定する
        // 次の月の0日目を指定すると、対象月の最終日が得られる
        lastDate = new Date(year, monthIndex + 1, 0);
      } else {
        // 月の指定がない場合は、termからfyを取得し、会計年度の最終日をセットする
        const fy = await models.FiscalYear.findOne({ where: { term: term }});
        if (!fy) {
          return res.status(404).json({ error: `Fiscal year for term ${term} not found.` });
        }
        lastDate = new Date(fy.endDate);
      }

      const ret = await trial_balance(term, lastDate);
      res.json(ret.lines);
    } catch(err) {
      next(err);
    }
  },
}