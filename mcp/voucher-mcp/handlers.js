import { api } from './client.js';
import { previewSlip } from './tax.js';
import { validateDay, validateLines } from './validate.js';

const READONLY = process.env.HIERONYMUS_READONLY === '1';

const errMsg = (e) => {
  if ( e.response && e.response.data && e.response.data.message ) {
    return e.response.data.message;
  }
  if ( e.message ) {
    return e.message;
  }
  return String(e);
};

export { errMsg };

const requireWritable = () => {
  if ( READONLY ) {
    throw new Error('HIERONYMUS_READONLY=1 のため書き込み操作は無効です。');
  }
};

const text = (data) => {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
  };
};

const pad2 = (n) => String(n).padStart(2, '0');

export const handlers = {
  get_accounts: async () => {
    return text(await api.getAccounts());
  },

  get_companies: async () => {
    const data = await api.getCompanies();
    return text(data.companies);
  },

  get_voucher_classes: async () => {
    const data = await api.getVoucherClasses();
    return text(data.values);
  },

  get_tax_rules: async (args) => {
    const date = args.date || new Date().toISOString().slice(0, 10);
    const data = await api.getTaxRules(date);
    return text(data.values);
  },

  get_fiscal_year: async (args) => {
    const fy = await api.getFiscalYear(args.year, args.month);
    if ( !fy ) {
      throw new Error('指定の年月に該当する会計年度がありません。');
    }
    return text(fy);
  },

  get_cross_slip: async (args) => {
    return text(await api.getCrossSlip(args.year, args.month, args.no));
  },

  list_cross_slips: async (args) => {
    return text(await api.listCrossSlips(args.type));
  },

  list_vouchers: async (args) => {
    const params = {};
    for ( const key of ['date', 'month', 'company', 'voucherClassId', 'lower', 'upper'] ) {
      if ( args[key] !== undefined ) {
        params[key] = args[key];
      }
    }
    const data = await api.listVouchers(params);
    return text(data.vouchers);
  },

  create_cross_slip: async (args) => {
    requireWritable();
    const dayErr = validateDay(args.year, args.month, args.day);
    if ( dayErr ) {
      throw new Error(dayErr);
    }
    const lineErr = validateLines(args.lines);
    if ( lineErr ) {
      throw new Error(lineErr);
    }
    const body = {
      year: args.year,
      month: args.month,
      day: args.day,
      lines: args.lines
    };
    const result = await api.createCrossSlip(body);
    return text(result);
  },

  update_cross_slip: async (args) => {
    requireWritable();
    const dayErr = validateDay(args.year, args.month, args.day);
    if ( dayErr ) {
      throw new Error(dayErr);
    }
    const lineErr = validateLines(args.lines);
    if ( lineErr ) {
      throw new Error(lineErr);
    }
    const body = {
      year: args.year,
      month: args.month,
      day: args.day,
      no: args.no,
      lines: args.lines
    };
    return text(await api.updateCrossSlip(body));
  },

  approve_cross_slip: async (args) => {
    requireWritable();
    return text(await api.approve({
      year: args.year,
      month: args.month,
      no: args.no,
      approvedAt: new Date().toISOString()
    }));
  },

  disapprove_cross_slip: async (args) => {
    requireWritable();
    return text(await api.approve({
      year: args.year,
      month: args.month,
      no: args.no,
      approvedAt: null
    }));
  },

  delete_cross_slip: async (args) => {
    requireWritable();
    return text(await api.deleteCrossSlip({
      year: args.year,
      month: args.month,
      day: args.day,
      no: args.no
    }));
  },

  create_voucher: async (args) => {
    requireWritable();
    const body = {
      voucherClassId: args.voucherClassId,
      issueDate: args.issueDate,
      companyId: args.companyId,
      amount: args.amount,
      taxRuleId: args.taxRuleId,
      paymentDate: args.paymentDate,
      description: args.description,
      invoiceNo: args.invoiceNo
    };
    return text(await api.createVoucher(body));
  },

  update_voucher: async (args) => {
    requireWritable();
    const body = { id: args.id };
    for ( const key of ['voucherClassId', 'issueDate', 'companyId', 'amount', 'taxRuleId', 'paymentDate', 'description', 'invoiceNo'] ) {
      if ( args[key] !== undefined ) {
        body[key] = args[key];
      }
    }
    return text(await api.updateVoucher(body));
  },

  delete_voucher: async (args) => {
    requireWritable();
    return text(await api.deleteVoucher({ id: args.id }));
  },

  compute_slip_taxes: async (args) => {
    const date = `${args.year}-${pad2(args.month)}-01`;
    const [fy, taxData, companyData, accounts] = await Promise.all([
      api.getFiscalYear(args.year, args.month),
      api.getTaxRules(date),
      api.getCompanyInfo(),
      api.getAccounts()
    ]);
    if ( !fy ) {
      throw new Error('指定の年月に該当する会計年度がありません。');
    }
    const ctx = {
      fy: { taxIncluded: fy.taxIncluded },
      accounts: accounts,
      taxRules: taxData.values,
      roundingMethod: companyData.company ? companyData.company.roundingMethod : 2
    };
    const lines = previewSlip(args.lines, ctx);
    const debit = lines.reduce((s, l) => s + l.debitAmount, 0);
    const credit = lines.reduce((s, l) => s + l.creditAmount, 0);
    return text({
      fy: { term: fy.term, taxIncluded: fy.taxIncluded, roundingMethod: companyData.company ? companyData.company.roundingMethod : 2 },
      lines: lines,
      totals: { debit: debit, credit: credit }
    });
  }
};

export default handlers;