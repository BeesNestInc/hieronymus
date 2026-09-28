import { api } from './client.js';
import { previewSlip } from './tax.js';
import { validateDay, validateLines, normalizeLines } from './validate.js';

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

// 添付ファイルの本文（files[].body = Buffer/バイト列）は応答が巨大になり
// MCP がタイムアウトする原因になる（例: get_journal が46MB）。メタデータだけを残す。
// 本文が必要な場合は list_voucher_files で個別に取得する。
const stripFileBodies = (o) => {
  if ( Array.isArray(o) ) {
    return o.map(stripFileBodies);
  }
  if ( o && typeof o === 'object' && !Buffer.isBuffer(o) ) {
    const out = {};
    for ( const [k, v] of Object.entries(o) ) {
      if ( k === 'files' && Array.isArray(v) ) {
        out.files = v.map((f) => {
          if ( f && typeof f === 'object' && !Buffer.isBuffer(f) ) {
            const { body, ...rest } = f;
            return rest;
          }
          return f;
        });
      } else {
        out[k] = stripFileBodies(v);
      }
    }
    return out;
  }
  return o;
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

  get_journal: async (args) => {
    const data = await api.getJournal(args.year, args.month);
    return text(stripFileBodies(data.journal));
  },

  get_cross_slip: async (args) => {
    return text(stripFileBodies(await api.getCrossSlip(args.year, args.month, args.no)));
  },

  list_cross_slips: async (args) => {
    return text(stripFileBodies(await api.listCrossSlips(args.type)));
  },

  list_vouchers: async (args) => {
    if ( !args.date && !args.month ) {
      throw new Error('list_vouchers は month（例: 2026-03）または date（YYYY-MM-DD）の指定が必須です。先に get_fiscal_year で該当年月を確認してください。');
    }
    const params = {};
    for ( const key of ['date', 'month', 'company', 'voucherClassId', 'lower', 'upper'] ) {
      if ( args[key] !== undefined ) {
        params[key] = args[key];
      }
    }
    const data = await api.listVouchers(params);
    return text(stripFileBodies(data.vouchers));
  },

  create_cross_slip: async (args) => {
    requireWritable();
    const dayErr = validateDay(args.year, args.month, args.day);
    if ( dayErr ) {
      throw new Error(dayErr);
    }
    const createLines = normalizeLines(args.lines);
    const createAccounts = await api.getAccounts();
    const createLineErr = validateLines(createLines, createAccounts);
    if ( createLineErr ) {
      throw new Error(createLineErr);
    }
    const body = {
      year: args.year,
      month: args.month,
      day: args.day,
      lines: createLines
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
    const updateLines = normalizeLines(args.lines);
    const updateAccounts = await api.getAccounts();
    const updateLineErr = validateLines(updateLines, updateAccounts);
    if ( updateLineErr ) {
      throw new Error(updateLineErr);
    }
    const body = {
      year: args.year,
      month: args.month,
      day: args.day,
      no: args.no,
      lines: updateLines
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

  create_voucher_with_file: async (args) => {
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
    const result = await api.createVoucher(body);
    if ( args.filePath ) {
      await api.uploadVoucherFile(result.voucher.id, args.filePath);
    }
    return text(result);
  },

  get_voucher: async (args) => {
    return text(stripFileBodies(await api.getVoucher(args.id)));
  },

  attach_voucher_file: async (args) => {
    requireWritable();
    return text(await api.uploadVoucherFile(args.id, args.filePath));
  },

  list_voucher_files: async (args) => {
    return text(await api.listVoucherFiles(args.id));
  },

  delete_voucher_file: async (args) => {
    requireWritable();
    return text(await api.deleteVoucherFile(args.id));
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