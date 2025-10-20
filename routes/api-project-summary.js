import models from '../models/index.js';
import { dc, numeric } from '../libs/parse_account_code.js';
const Op = models.Sequelize.Op;

const getSummary = async (project, startDate, endDate) => {
  // 1. プロジェクトに紐づくLabelのIDリストと順序を取得
  const projectLabels = await models.ProjectLabel.findAll({
    where: { projectId: project.id },
    order: [['displayOrder', 'ASC']]
  });
  const labelIds = projectLabels.map(pl => pl.labelId);

  // ラベルがなくても「その他」の集計は行うので、早期リターンはしない

  // 2. ラベルと勘定科目の基本情報を取得
  const labelsWithAccounts = labelIds.length > 0 ? await models.Label.findAll({
    where: { id: { [Op.in]: labelIds } },
    include: [{
      model: models.Account,
      as: 'accounts'
    }]
  }) : [];

  // 3. LabelAccountsからsummaryTypeの情報を別途取得
  const labelAccountLinks = labelIds.length > 0 ? await models.LabelAccount.findAll({
    where: { labelId: { [Op.in]: labelIds } }
  }) : [];
  const summaryTypeMap = new Map();
  for (const link of labelAccountLinks) {
    summaryTypeMap.set(`${link.labelId}-${link.accountCode}`, link.summaryType);
  }

  // 4. 取得したラベルを、プロジェクトに設定された順序に並び替える
  const labels = labelIds.map(id => labelsWithAccounts.find(l => l.id === id)).filter(Boolean);

  // 5. 勘定科目コードからラベル情報（集計方法を含む）へのマッピングを作成
  const codeToLabelMap = new Map();
  for (const label of labels) {
    for (const account of label.accounts) {
      const key = `${label.id}-${account.accountCode}`;
      codeToLabelMap.set(account.accountCode, {
        name: label.name,
        summaryType: summaryTypeMap.get(key)
      });
    }
  }
  
  // ★ 新規: 全勘定科目情報を取得し、Mapを作成
  const allAccounts = await models.Account.findAll();
  const accountMap = new Map(allAccounts.map(acc => [acc.accountCode, acc]));

  // 6. projectIdで明細を絞り込み、それに紐づく伝票を期間で絞り込む
  const fromYear = startDate.getFullYear();
  const fromMonth = startDate.getMonth() + 1;
  const toYear = endDate.getFullYear();
  const toMonth = endDate.getMonth() + 1;

  const periodConditions = [];
  if (fromYear === toYear) {
    periodConditions.push({ year: fromYear, month: { [Op.between]: [fromMonth, toMonth] } });
  } else {
    periodConditions.push({ year: fromYear, month: { [Op.gte]: fromMonth } });
    periodConditions.push({ year: toYear, month: { [Op.lte]: toMonth } });
    if (toYear > fromYear + 1) {
      periodConditions.push({ year: { [Op.between]: [fromYear + 1, toYear - 1] } });
    }
  }

  const details = await models.CrossSlipDetail.findAll({
    where: {
      projectId: project.id
    },
    include: [{
      model: models.CrossSlip,
      as: 'crossSlip',
      where: {
        approvedAt: { [Op.ne]: null },
        [Op.or]: periodConditions
      }
    }]
  });

  // 7. 月ごと、ラベルごとに集計マップを初期化
  const monthlySummary = new Map();
  for (let mon = new Date(startDate); mon <= endDate; mon.setMonth(mon.getMonth() + 1)) {
    const year = mon.getFullYear();
    const month = mon.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const initialData = { year, month };
    labels.forEach(l => initialData[l.name] = 0);
    initialData['その他'] = 0; // 「その他」を追加
    monthlySummary.set(monthKey, initialData);
  }

  // 8. 取得した明細を振り分ける (最終確定ロジック)
  for (const detail of details) {
    const year = detail.crossSlip.year;
    const month = detail.crossSlip.month;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthData = monthlySummary.get(monthKey);

    if (monthData) {
      // 借方側の処理
      if (detail.debitAccount) {
        if (codeToLabelMap.has(detail.debitAccount)) {
          const labelInfo = codeToLabelMap.get(detail.debitAccount);
          if (labelInfo.summaryType === 'debit') {
            const amount = numeric(detail.debitAmount);
            monthData[labelInfo.name] += amount;
          }
        } else {
          // ★ 「その他」の処理を追加
          const account = accountMap.get(detail.debitAccount);
          if (account) {
            const accountCode = account.accountCode;
            // 費用科目（売上原価 '7' or 営業外費用 '9'）のみを集計
            if (accountCode.startsWith('7') || accountCode.startsWith('9')) {
              const amount = numeric(detail.debitAmount);
              monthData['その他'] += amount;
            }
          }
        }
      }
      // 貸方側の処理
      if (detail.creditAccount && codeToLabelMap.has(detail.creditAccount)) {
        const labelInfo = codeToLabelMap.get(detail.creditAccount);
        if (labelInfo.summaryType === 'credit') {
          const amount = numeric(detail.creditAmount);
          monthData[labelInfo.name] += amount;
        }
      }
    }
  }

  // 9. ヘッダー情報とボディ情報を返す
  const header = labels.map(l => ({ name: l.name }));
  header.push({ name: 'その他' }); // ヘッダーに「その他」を追加
  const body = Array.from(monthlySummary.values()).sort((a, b) => a.year - b.year || a.month - b.month);
  
  return { header, body };
};

export default {
  get: async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      const { from, to } = req.query; // YYYY-MM形式

      if (!from || !to) {
        return res.status(400).send('Query parameters \'from\' and \'to\' are required.');
      }

      const project = await models.Project.findByPk(projectId);
      if (!project) {
        return res.status(404).send('Project not found');
      }

      const startDate = new Date(from + '-01T00:00:00Z');
      const [toYear, toMonth] = to.split('-').map(Number);
      const endDate = new Date(Date.UTC(toYear, toMonth, 0, 23, 59, 59, 999));

      const summary = await getSummary(project, startDate, endDate);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }
};
