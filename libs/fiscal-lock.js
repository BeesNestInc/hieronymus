import models from '../models/index.js';
const Op = models.Sequelize.Op;

// lockedAt が NULL でなければ確定済み。isLocked カラムは持たない。
export const isLocked = (fy) => {
  return Boolean(fy && fy.lockedAt);
};

export const lockErrorBody = (fy) => {
  return {
    code: -423,
    message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。',
    term: fy ? fy.term : undefined
  };
};

// 日付(issueDate/伝票日付) → FiscalYear。既存3箇所と同一条件。
export const findFiscalYearForDate = async (date, options = {}) => {
  const d = (date instanceof Date) ? date : new Date(date);
  if ( Number.isNaN(d.getTime()) ) {
    return null;
  }
  // 既存実装(tax-calc / cross_slip / api-term)に合わせ、境界の時差吸収のため+1日側で比較する
  const fromDate = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return models.FiscalYear.findOne({
    where: {
      startDate: { [Op.lte]: fromDate },
      endDate: { [Op.gte]: dayStart }
    },
    ...options
  });
};

export const findFiscalYearForTerm = async (term, options = {}) => {
  if ( term === undefined || term === null || term === '' ) {
    return null;
  }
  return models.FiscalYear.findOne({
    where: {
      term: parseInt(term, 10)
    },
    ...options
  });
};

// 確定済みなら true。未確定・FYなしなら false。
// FYなしの扱い(日付エラー等)は呼び出し側の既存バリデーションに委ねる。
export const checkDateLocked = async (date) => {
  const fy = await findFiscalYearForDate(date);
  if ( !fy ) {
    return { locked: false, fy: null };
  }
  return { locked: isLocked(fy), fy };
};

export const checkTermLocked = async (term) => {
  const fy = await findFiscalYearForTerm(term);
  if ( !fy ) {
    return { locked: false, fy: null };
  }
  return { locked: isLocked(fy), fy };
};

// Express用: 確定済みなら 423 を返して true、そうでなければ false。
export const rejectIfLocked = (req, res, fy) => {
  if ( isLocked(fy) ) {
    res.status(423).json(lockErrorBody(fy));
    return true;
  }
  return false;
};

export default {
  isLocked,
  lockErrorBody,
  findFiscalYearForDate,
  findFiscalYearForTerm,
  checkDateLocked,
  checkTermLocked,
  rejectIfLocked
};
