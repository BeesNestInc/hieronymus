import models from '../models/index.js';
const Op = models.Sequelize.Op;
import fs from 'fs';
import Mime from 'mime';
import { numeric } from '../libs/utils.js';
import { createSlipForReport } from '../libs/expense.js';
import { findFiscalYearForTerm, isLocked } from '../libs/fiscal-lock.js';
import * as vision from '../libs/vision.js';
import { splitImage } from '../libs/imaging.js';

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
      // 未整理証憑（まるっとアップロードされた、明細に紐付かない証憑）
      model: models.Voucher, as: 'vouchers',
      include: [{
        model: models.VoucherFile, as: 'files',
        attributes: [ 'id', 'mimeType', 'name' ]
      }]
    },
    {
      model: models.ExpenseReportLine,
      as: 'lines',
      include: [
        { model: models.ExpenseMapping, as: 'payeeMapping' },
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
    [{ model: models.ExpenseReportLine, as: 'lines' }, 'lineNo', 'ASC' ],
    [{ model: models.Voucher, as: 'vouchers' }, 'id', 'ASC' ]
  ]
};

const getReport = async (id) => {
  return models.ExpenseReport.findByPk(id, listQuery);
};

// 未整理証憑の正規化: 精算書のパイルに置かれていた証憑が明細から
// 参照されるようになったら、パイル紐付け（expenseReportId）を解除する。
// 明細への紐付け（ExpenseReportLines.voucherId）が正で、パイルは一時置き場。
export const normalizePileVouchers = async (reportId, lines) => {
  const boundIds = [ ...new Set(lines
    .filter((line) => line.voucherId)
    .map((line) => Number(line.voucherId))) ];
  if ( boundIds.length > 0 ) {
    await models.Voucher.update(
      { expenseReportId: null },
      { where: {
        expenseReportId: reportId,
        id: { [Op.in]: boundIds }
      } }
    );
  }
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
            payeeMappingId: line.payeeMappingId || null,
            description: line.description || null,
            amount: numeric(line.amount),
            paymentMappingId: line.paymentMappingId || null,
            note: line.note || null,
            voucherId: line.voucherId || null,
            taxRuleId: line.taxRuleId || null
          });
        }
        await normalizePileVouchers(report.id, body.lines);
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
            payeeMappingId: line.payeeMappingId || null,
            description: line.description || null,
            amount: numeric(line.amount),
            paymentMappingId: line.paymentMappingId || null,
            note: line.note || null,
            voucherId: line.voucherId || null,
            taxRuleId: line.taxRuleId || null
          });
        }
        await normalizePileVouchers(report.id, body.lines);
      }
      const saved = await getReport(report.id);
      res.json(saved);
    } catch (e) {
      next(e);
    }
  },
  // 未整理証憑のまるっとアップロード（複数ファイル可）。
  // 会社・金額・種別が不明なままVoucherを作り、指定があれば精算書のパイルに
  // 紐付ける（指定なし=どこにも紐付かない浮遊証憑）。
  // 分離・金額の確定などは後続の整理（人またはAI）に任せる。
  uploadVouchers: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const reportId = req.params.id ? parseInt(req.params.id) : null;
      if ( reportId ) {
        const report = await models.ExpenseReport.findByPk(reportId);
        if ( !report ) {
          res.status(404).json({ code: -1, message: 'record not found' });
          return;
        }
        if ( report.approvedAt ) {
          res.status(422).json({ code: -2, message: 'this report was approved' });
          return;
        }
        if (( !canAccessAll(req.session.user) ) &&
            ( report.createdBy !== req.session.user.id )) {
          res.status(403).json({ code: -10, message: 'permission denied' });
          return;
        }
      }
      let files = ( req.files && req.files.file ) ? req.files.file : [];
      if ( !Array.isArray(files) ) {
        files = [ files ];
      }
      if ( files.length === 0 ) {
        res.status(422).json({ code: -2, message: 'file is required' });
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const created = [];
      for ( const f of files ) {
        const voucher = await models.Voucher.create({
          issueDate: today,
          expenseReportId: reportId,
          createdBy: req.session.user.id,
          updatedBy: req.session.user.id
        });
        await models.VoucherFile.create({
          voucherId: voucher.id,
          name: f.name,
          mimeType: f.type || Mime.getType(f.path),
          body: fs.readFileSync(f.path)
        });
        created.push({ id: voucher.id, name: f.name });
      }
      res.json({ code: 0, vouchers: created });
    } catch (e) {
      next(e);
    }
  },
  // 未整理証憑の分離: 1枚の画像に写った複数の証憑を幾何検出（AI不使用）して
  // 個別のVoucherに切り出す。元の証憑は残る。対象は画像ファイルが1枚添付された証憑
  splitVoucher: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const voucher = await models.Voucher.findByPk(req.body.voucherId);
      if ( !voucher ) {
        res.status(404).json({ code: -1, message: 'record not found' });
        return;
      }
      if ( !req.session.user.accounting && voucher.createdBy !== req.session.user.id ) {
        res.status(403).json({ code: -10, message: 'permission denied' });
        return;
      }
      if ( voucher.expenseReportId ) {
        const report = await models.ExpenseReport.findByPk(voucher.expenseReportId);
        if (( report ) && ( report.approvedAt )) {
          res.status(422).json({ code: -2, message: 'this report was approved' });
          return;
        }
      }
      const files = await models.VoucherFile.findAll({
        where: { voucherId: voucher.id }
      });
      if ( files.length !== 1 ) {
        res.status(422).json({
          code: -2,
          message: '分離できるのはファイルが1枚添付された証憑だけです。'
        });
        return;
      }
      const file = files[0];
      if ( !file.mimeType || !file.mimeType.match(/^image\//) ) {
        res.status(422).json({
          code: -2,
          message: '分離できるのは画像ファイルだけです（PDFは対象外）。'
        });
        return;
      }
      const result = await splitImage(file.body, file.mimeType);
      if ( !result ) {
        res.status(422).json({
          code: -2,
          message: '分離できる複数の証憑が見つかりませんでした。'
        });
        return;
      }
      const stem = ( file.name || 'voucher' ).replace(/\.[^.]*$/, '') || 'voucher';
      const ext = ( result.mime === 'image/jpeg' ) ? '.jpg' : '.png';
      const created = [];
      for ( let i = 0; i < result.parts.length; i += 1 ) {
        const part = await models.Voucher.create({
          issueDate: voucher.issueDate,
          expenseReportId: voucher.expenseReportId || null,
          description: ( voucher.description ?
              `${voucher.description}(${i + 1})` : `${stem}(${i + 1})` ),
          createdBy: req.session.user.id,
          updatedBy: req.session.user.id
        });
        await models.VoucherFile.create({
          voucherId: part.id,
          name: `${stem}(${i + 1})${ext}`,
          mimeType: result.mime,
          body: result.parts[i]
        });
        created.push({ id: part.id });
      }
      res.json({ code: 0, vouchers: created });
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
  // 再承認時、紐付伝票が未承納なら伝票番号を変えずに明細だけ更新する（reuse: true）。
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
        // 二重承認ガード: 承認済みの精算書への再承認は拒否する
        // （createSlipForReportの伝票再利用は「不承認→修正→再承認」の経路用）
        if ( report.approvedAt ) {
          res.status(422).json({ code: -2, message: 'this report was already approved' });
          return;
        }
        // 仕訳起票に成功してから承認状態を更新する
        const result = await createSlipForReport(report, report.lines, req.session.user);
        report.approvedAt = body.approvedAt;
        report.approvedBy = req.session.user.id;
        report.updatedBy = req.session.user.id;
        await report.save();
        res.json({
          code: 0,
          id: report.id,
          reuse: result.reuse,
          slipNo: {
            year: result.slip.year,
            month: result.slip.month,
            day: result.slip.day,
            no: result.slip.no
          }
        });
      } else {
        // 不承認時は精算書の承認状態のみ解除する。
        // 紐付伝票が未承納なら連動して伝票も不承認にする（伝票承認フローの承認待ちに戻す）。
        // 伝票が既に承認済み（経理が伝票承認フローで確定済み）の場合は連動せず
        // slipApproved を返す。crossSlipId は切らない。
        let slipApproved = false;
        if ( report.crossSlipId ) {
          const slip = await models.CrossSlip.findByPk(report.crossSlipId);
          if ( slip ) {
            const slipFy = await findFiscalYearForTerm(slip.term);
            if (( slipFy ) && ( isLocked(slipFy) )) {
              res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: slipFy.term });
              return;
            }
            if ( slip.approvedAt ) {
              slipApproved = true;
            } else {
              slip.approvedAt = null;
              slip.approvedBy = null;
              await slip.save();
            }
          }
        }
        report.approvedAt = null;
        report.approvedBy = null;
        report.updatedBy = req.session.user.id;
        await report.save();
        res.json({ code: 0, id: report.id, slipApproved: slipApproved });
      }
    } catch (e) {
      if (( e && (( e.name === 'ExpenseMappingNotFound' ) ||
                  ( e.name === 'ExpenseSubAccountNotFound' ) ||
                  ( e.name === 'ExpenseValidation' ))) ) {
        res.status(422).json({ code: -2, message: e.message });
        return;
      }
      if (( e ) && ( e.name === 'FiscalYearLocked' )) {
        res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: e.term });
        return;
      }
      next(e);
    }
  },
  // 紐付伝票の削除（未処理伝票の掃除用）。approvableユーザー限定。
  // 伝票が未承納の場合のみ削除できる。承認済みなら拒否。
  deleteSlip: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if ( !req.session.user.approvable ) {
      res.json({ code: -10, message: 'this account can not modify' });
      return;
    }
    try {
      const body = req.body;
      const report = await models.ExpenseReport.findByPk(body.id);
      if ( !report ) {
        res.json({ code: -1, message: 'record not found' });
        return;
      }
      if ( !report.crossSlipId ) {
        res.json({ code: -2, message: 'related slip not found' });
        return;
      }
      const slip = await models.CrossSlip.findByPk(report.crossSlipId);
      if ( !slip ) {
        // 参照は既に陳腐化（SET NULLは伝票削除時に済んでいるはずだが念のため）
        report.crossSlipId = null;
        await report.save();
        res.json({ code: 0 });
        return;
      }
      if ( slip.approvedAt ) {
        res.status(422).json({ code: -2, message: 'related slip was approved' });
        return;
      }
      const slipFy = await findFiscalYearForTerm(slip.term);
      if (( slipFy ) && ( isLocked(slipFy) )) {
        res.status(423).json({ code: -423, message: 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。', term: slipFy.term });
        return;
      }
      await models.CrossSlipDetail.destroy({
        where: { crossSlipId: slip.id }
      });
      await slip.destroy();
      report.crossSlipId = null;
      report.updatedBy = req.session.user.id;
      await report.save();
      res.json({ code: 0 });
    } catch (e) {
      next(e);
    }
  },
  // 紐付伝票の取得。slip-page等で連動伝票の精算書を逆引きするためのもの
  reportForSlip: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const report = await models.ExpenseReport.findOne({
        where: { crossSlipId: req.params.slipId },
        include: [
          { model: models.User, as: 'submitter' },
          { model: models.Task, as: 'task' }
        ]
      });
      if (( report ) &&
          (( req.session.user.accounting ) || ( req.session.user.approvable ) ||
           ( report.createdBy === req.session.user.id ))) {
        res.json({ id: report.id, purpose: report.purpose, task: report.task ? report.task.name : null });
      } else {
        res.json(null);
      }
    } catch (e) {
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
        attributes: [ 'id', 'subject' ],
        order: [[ 'issueDate', 'DESC' ]]
      });
      res.json({
        values: tasks.map((task) => {
          return { id: task.id, name: task.subject };
        })
      });
    } catch (e) {
      console.log(e);
      res.json({ code: -1, values: [] });
    }
  },
  // 証憑ファイルをAIで読み取り、帳票情報（会社名/日付/金額等）を抽出する。
  // multipart でファイルを直接渡すか、JSON {voucherId} で既存証憑を指定できる。
  ocr: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      let buffer;
      let mimeType;
      if (( req.files ) && ( req.files.file )) {
        buffer = fs.readFileSync(req.files.file.path);
        mimeType = req.files.file.type || Mime.getType(req.files.file.path);
      } else {
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
        buffer = voucher.files[0].body;
        mimeType = voucher.files[0].mimeType;
      }
      const data = await vision.extract(buffer, mimeType);
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
