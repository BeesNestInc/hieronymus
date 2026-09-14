// libs/server-data.js
// サーバ(Node)側専用: init-*.js がブラウザでは axios で叩く /api/* を、
// サーバ上ではHTTP経由せずDB/ロジック直読みで解決する。
// ブラウザバンドルに含まれないよう、呼び出し側は
//   await import(/* @vite-ignore */ './server-data.js')
// で動的importすること。
import models from '../models/index.js';
import Accounts from './accounts.js';
import trialBalance from './trial_balance.js';
import {fetchJournal} from '../routes/api_journal.js';
import {get_details} from '../routes/api_ledger.js';

const plain = (v) => (v && typeof v.toJSON === 'function' ? v.toJSON() : v);

const getTerm = async (term) => {
  const fy = await models.FiscalYear.findOne({where: {term: parseInt(term)}});
  return plain(fy);
};

const getLedger = async (term, account, subAccount) => {
  const fy = await models.FiscalYear.findOne({where: {term: parseInt(term)}});
  if (!fy) throw new Error(`Fiscal year for term ${term} not found.`);
  const sub = subAccount !== undefined ? parseInt(subAccount) : NaN;
  const ledger = await get_details(fy, account, sub, undefined);
  return ledger.map(plain);
};

const getTrialBalance = async (term) => {
  const t = parseInt(term);
  const fy = await models.FiscalYear.findOne({where: {term: t}});
  if (!fy) throw new Error(`Fiscal year for term ${term} not found.`);
  const ret = await trialBalance(t, new Date(fy.endDate), {autoDisapprove: true, actor: undefined});
  return ret.lines;
};

// axios.get(path) と同じ {data} 形状を返すディスパッチャ
export const apiGet = async (path) => {
  let m;
  if ((m = path.match(/^\/api\/term\/(\d+)$/))) {
    return {data: await getTerm(m[1])};
  }
  if ((m = path.match(/^\/api\/journal\/(\d+)\/(\d+)$/))) {
    return {data: {journal: await fetchJournal(parseInt(m[1]), parseInt(m[2]))}};
  }
  if ((m = path.match(/^\/api\/ledger\/([^/]+)\/([^/]+)\/([^/]+)$/))) {
    return {data: await getLedger(decodeURIComponent(m[1]), decodeURIComponent(m[2]), decodeURIComponent(m[3]))};
  }
  if ((m = path.match(/^\/api\/ledger\/([^/]+)\/([^/]+)$/))) {
    return {data: await getLedger(decodeURIComponent(m[1]), decodeURIComponent(m[2]), undefined)};
  }
  if (path === '/api/accounts') {
    return {data: await Accounts.all()};
  }
  if ((m = path.match(/^\/api\/accounts2\/([^/]+)$/))) {
    return {data: await Accounts.all2(decodeURIComponent(m[1]))};
  }
  if ((m = path.match(/^\/api\/trial-balance\/([^/]+)$/))) {
    return {data: await getTrialBalance(decodeURIComponent(m[1]))};
  }
  throw new Error(`server-data: unsupported api path: ${path}`);
};

export default {apiGet};
