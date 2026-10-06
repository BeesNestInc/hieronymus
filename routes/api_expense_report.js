import models from '../models/index.js';
const Op = models.Sequelize.Op;
import { numeric } from '../libs/utils.js';
import { createSlipForReport } from '../libs/expense.js';
import * as vision from '../libs/vision.js';

// 閲覧権限: 会計/承認権限ユーザーは全員の経費精算書を、
// それ以外は自分が作成したもののみ扱える（既存の伝票承認パターンと同じ）。
const canAccessAll = (user) => {
  return Boolean(user.accounting || user.approvable);
};

const listQuery = {
  include: [
    { model: models.User, as: 'submitter' },
    { model: models.User, as: 'approver' },
    { model: models.Company, as: 'company' },
    { model: models.Task, as: 'task' },
    {
      model: models.CrossSlip, as: 'crossSlip'
    },
    {
      model: models.ExpenseReportLine,
      as: 'lines',
      include: [
        { model: models.Company, as: 'payee' },
        { model: models.ExpenseMapping, as: 'paymentMapping' },
        {
          model: models.Voucher, as: 'voucher',
          include: [{
            model: models.VoucherFile, as: 'files',
            attributes: [ 'id', 'mimeType' ]
          }]
        },
        { model: models.TaxRule, as: 'taxRule' }
      ]
    }
  ],
  order: [
    [ 'submittedAt', 'DESC' ],
    [ 'id', 'DESC' ],
    [{ model: models.ExpenseReportLine, as: 'lines' }, 'lineNo', 'ASC' ]
  ]
};

const getReport = async (id) => {
  return models.ExpenseReport.findByPk(id, listQuery);
};

export default {
  list: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const where = {};
      switch ( req.params.type ) {
        case 'not_approved':
          where.approvedAt = { [Op.eq]: null };
          if ( !canAccessAll(req.session.user) ) {
            where.createdBy = req.session.user.id;
          }
          break;
        default:
          if ( !canAccessAll(req.session.user) ) {
            where.createdBy = req.session.user.id;
          }
          break;
      }
      const reports = await models.ExpenseReport.findAll({
        where: where,
        ...listQuery
      });
      res.json(reports);
    } catch (e) {
      console.log(e);
      res.json({ code: -1 });
    }
  },
  get: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const report = await getReport(req.params.id);
      if ( !report ) {
        res.json({ code: -1, message: 'record not found' });
        return;
      }
      if (( !canAccessAll(req.session.user) ) &&
          ( report.createdBy !== req.session.user.id )) {
        res.status(403).json({ code: -10, message: 'permission denied' });
        return;
      }
      res.json(report);
    } catch (e) {
      console.log(e);
      res.json({ code: -1 });
    }
  },
  post: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const body = req.body;
      const report = await models.ExpenseReport.create({
        submittedBy: body.submittedBy || req.session.user.id,
        submittedAt: body.submittedAt || new Date(),
        companyId: body.companyId || null,
        taskId: body.taskId || null,
        purpose: body.purpose || null,
        settlementDate: body.settlementDate || null,
        settlementMappingId: body.settlementMappingId || null,
        createdBy: req.session.user.id,
        updatedBy: req.session.user.id
      });
      if ( body.lines && body.lines.length > 0 ) {
        for ( let i = 0; i < body.lines.length; i ++ ) {
          const line = body.lines[i];
          await models.ExpenseReportLine.create({
            expenseReportId: report.id,
            lineNo: i,
            paymentDate: line.paymentDate || null,
            companyId: line.companyId || null,
            description: line.description || null,
            amount: numeric(line.amount),
            paymentMappingId: line.paymentMappingId || null,
            note: line.note || null,
            voucherId: line.voucherId || null,
            taxRuleId: line.taxRuleId || null
          });
        }
      }
      const saved = await getReport(report.id);
      res.json(saved);
    } catch (e) {
      next(e);
    }
  },
  update: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const body = req.body;
      const report = await models.ExpenseReport.findByPk(body.id);
      if ( !report ) {
        res.json({ code: -1, message: 'record not found' });
        return;
      }
      if ( report.approvedAt ) {
        res.json({ code: -2, message: 'this report was approved' });
        return;
      }
      if (( !canAccessAll(req.session.user) ) &&
          ( report.createdBy !== req.session.user.id )) {
        res.status(403).json({ code: -10, message: 'permission denied' });
        return;
      }
      report.submittedAt = body.submittedAt || report.submittedAt;
      report.companyId = body.companyId !== undefined ? (body.companyId || null) : report.companyId;
      report.taskId = body.taskId !== undefined ? (body.taskId || null) : report.taskId;
      report.purpose = body.purpose !== undefined ? body.purpose : report.purpose;
      report.settlementDate = body.settlementDate !== undefined ? (body.settlementDate || null) : report.settlementDate;
      report.settlementMappingId = body.settlementMappingId !== undefined ? (body.settlementMappingId || null) : report.settlementMappingId;
      report.updatedBy = req.session.user.id;
      await report.save();
      if ( body.lines ) {
        await models.ExpenseReportLine.destroy({
          where: { expenseReportId: report.id }
        });
        for ( let i = 0; i < body.lines.length; i ++ ) {
          const line = body.lines[i];
          await models.ExpenseReportLine.create({
            expenseReportId: report.id,
            lineNo: i,
            paymentDate: line.paymentDate || null,
            companyId: line.companyId || null,
            description: line.description || null,
            amount: numeric(line.amount),
            paymentMappingId: line.paymentMappingId || null,
            note: line.note || null,
            voucherId: line.voucherId || null,
            taxRuleId: line.taxRuleId || null
          });
        }
      }
      const saved = await getReport(report.id);
      res.json(saved);
    } catch (e) {
      next(e);
    }
  },
  delete: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const report = await models.ExpenseReport.findByPk(req.body.id);
      if ( !report ) {
        res.json({ code: -1, message: 'record not found' });
        return;
      }
      if ( report.approvedAt ) {
        res.json({ code: -2, message: 'this report was approved' });
        return;
      }
      if (( !canAccessAll(req.session.user) ) &&
          ( report.createdBy !== req.session.user.id )) {
        res.status(403).json({ code: -10, message: 'permission denied' });
        return;
      }
      await models.ExpenseReportLine.destroy({
        where: { expenseReportId: report.id }
      });
      await report.destroy();
      res.json({ code: 0 });
    } catch (e) {
      next(e);
    }
  },
  // 承認/不承認。承認時は仕訳伝票を自動起票（未承認・承認待ち）して関連付ける。
  approve: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !req.session.user.approvable ) {
      res.json({ code: -10, message: 'this account can not approve' });
      return;
    }
    try {
      const body = req.body;
      const report = await models.ExpenseReport.findByPk(body.id, {
        include: [{ model: models.ExpenseReportLine, as: 'lines' }],
        order: [[{ model: models.ExpenseReportLine, as: 'lines' }, 'lineNo', 'ASC' ]]
      });
      if ( !report ) {
        res.json({ code: -1, message: 'record not found' });
        return;
      }
      if ( body.approvedAt ) {
        // 仕訳起票に成功してから承認状態を更新する
        const slip = await createSlipForReport(report, report.lines, req.session.user);
        report.approvedAt = body.approvedAt;
        report.approvedBy = req.session.user.id;
        report.updatedBy = req.session.user.id;
        await report.save();
        res.json({
          code: 0,
          id: report.id,
          slipNo: {
            year: slip.year,
            month: slip.month,
            day: slip.day,
            no: slip.no
          }
        });
      } else {
        // 不承認時は承認状態のみ解除する。起票済みの伝票は未承認のまま
        // 既存の伝票承認フロー（仕訳日記帳）で経理が管理する。
        report.approvedAt = null;
        report.approvedBy = null;
        report.updatedBy = req.session.user.id;
        await report.save();
        res.json({ code: 0, id: report.id });
      }
    } catch (e) {
      if (( e && (( e.name === 'ExpenseMappingNotFound' ) ||
                  ( e.name === 'ExpenseSubAccountNotFound' ) ||
                  ( e.name === 'ExpenseValidation' ))) ) {
        res.status(422).json({ code: -2, message: e.message });
        return;
      }
      next(e);
    }
  },
  // AIの利用可否。AI未設定環境ではボタンを非表示にするためのフラグ
  aiAvailable: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ available: vision.isAvailable() });
  },
  // 案件（Task）の簡易一覧。精算書への案件紐付けに必要なため認証済み全ユーザーに開放する
  // （/api/task 本体は companyManagement 権限が必要なため、idと名前のみの最小限を返す）
  tasks: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const tasks = await models.Task.findAll({
        attributes: [ 'id', 'name' ],
        order: [[ 'issueDate', 'DESC' ]]
      });
      res.json({ values: tasks });
    } catch (e) {
      console.log(e);
      res.json({ code: -1 });
    }
  },
  // 証憑ファイルをAIで読み取り、帳票情報（会社名/日付/金額等）を抽出する
  ocr: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const voucherId = req.body.voucherId;
      if ( !voucherId ) {
        res.status(422).json({ code: -2, message: 'voucherId is required' });
        return;
      }
      const voucher = await models.Voucher.findByPk(voucherId, {
        include: [{ model: models.VoucherFile, as: 'files' }]
      });
      if (( !voucher ) || ( !voucher.files ) || ( voucher.files.length === 0 )) {
        res.status(422).json({ code: -2, message: '証憑ファイルが添付されていません。' });
        return;
      }
      const file = voucher.files[0];
      const data = await vision.extract(file.body, file.mimeType);
      if ( !data ) {
        res.status(422).json({ code: -2, message: '帳票情報を読み取れませんでした。' });
        return;
      }
      res.json({ values: data });
    } catch (e) {
      if (( e && (( e.name === 'AiNotConfigured' ) || ( e.name === 'AiApiError' ))) ) {
        res.status(422).json({ code: -2, message: e.message });
        return;
      }
      next(e);
    }
  }
};
