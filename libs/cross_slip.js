import models from '../models/index.js';
const Op = models.Sequelize.Op;

const createDetail = (line, slipId, lineNo) => {
  return models.CrossSlipDetail.create({
    crossSlipId: slipId,
    lineNo: lineNo,
    debitAccount: line.debitAccount,
    debitSubAccount: line.debitSubAccount,
    debitAmount: line.debitAmount,
    debitTax: line.debitTax,
    debitVoucherId: line.debitVoucherId,
    debitTaxRuleId: line.debitTaxRuleId,
    creditAccount: line.creditAccount,
    creditSubAccount: line.creditSubAccount,
    creditAmount: line.creditAmount,
    creditTax: line.creditTax,
    creditVoucherId: line.creditVoucherId,
    creditTaxRuleId: line.creditTaxRuleId,
    projectId: line.projectId,
    application1: line.application1,
    application2: line.application2
  });
}

export const create = async (body, user) => {
  let fy = await models.FiscalYear.findOne({
    where: {
      startDate: {
        [Op.lte]: new Date(body.year, body.month - 1, 2)
      },
      endDate: {
        [Op.gte]: new Date(body.year, body.month - 1, 2)
      }
    }
  });
  //console.log('fy', fy);
  if  ( !fy ) return;
  let ml = await models.MonthlyLog.findOne({
    where: {
      term: fy.term,
      month: body.month
    }
  });
  if	( !ml )	{
    ml = await models.MonthlyLog.create({
      term: fy.term,
          month: body.month,
          slipCount: 0,
          voucharCount: 0
    })
  }
  //console.log('ml', ml);
  ml.slipCount += 1;
  
  let approvedAt;
  let approvedBy;
  if	( user.approvable )	{
    approvedAt = new Date();
    approvedBy = user.id;
  }
  let slip = await models.CrossSlip.create({
    year: body.year,
    month: body.month,
    day: body.day,
    no: ml.slipCount,
    lineCount: body.lines.length,
    createdBy: user.id,
    approvedAt: approvedAt,
    approvedBy: approvedBy,
    term: body.term
  });
  ml.save();
  
  let lines = [];
  for ( let i = 0; i < body.lines.length ; i ++ ) {
    let line = body.lines[i];
    await createDetail(line, slip.id, i);
    lines.push(line);
  }
  return  ({
    year: body.year,
    month: body.month,
    day: body.day,
    no: slip.no,
    lines: lines
  })
}

export const update = async (slip, body, user) => {
  slip.lineCount = body.lines.length;
  slip.day = body.day;
  slip.updatedBy = user.id;
  if	( user.approvable )	{
    slip.approvedAt = new Date();
    slip.approvedBy = user.id;
  }
  slip.save();
  await models.CrossSlipDetail.destroy({
    where: {
      crossSlipId: slip.id
    }
  });
  for ( let i = 0; i < body.lines.length ; i ++ ) {
    let line = body.lines[i];
    await createDetail(line, slip.id, i);
  }
}