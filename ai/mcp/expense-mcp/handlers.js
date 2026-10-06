import { api } from './client.js';

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
// MCP がタイムアウトする原因になる。メタデータだけを残す。
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

export const handlers = {
  list_expense_mappings: async () => {
    const data = await api.listExpenseMappings();
    return text(data.values);
  },

  create_expense_mapping: async (args) => {
    requireWritable();
    const data = await api.createExpenseMapping(args);
    return text(data.values);
  },

  update_expense_mapping: async (args) => {
    requireWritable();
    if ( !args.id ) {
      throw new Error('id は必須です。');
    }
    const data = await api.updateExpenseMapping(args);
    return text(data.values);
  },

  delete_expense_mapping: async (args) => {
    requireWritable();
    if ( !args.id ) {
      throw new Error('id は必須です。');
    }
    const data = await api.deleteExpenseMapping(args.id);
    return text(data.values);
  },

  list_expense_reports: async (args) => {
    return text(stripFileBodies(await api.listExpenseReports(args.type)));
  },

  get_expense_report: async (args) => {
    return text(stripFileBodies(await api.getExpenseReport(args.id)));
  },

  update_expense_report: async (args) => {
    requireWritable();
    if ( !args.id ) {
      throw new Error('id は必須です。');
    }
    const body = { ...args };
    if ( body.lines ) {
      body.lines = body.lines.map((line, i) => ({
        lineNo: line.lineNo !== undefined ? line.lineNo : i,
        ...line
      }));
    }
    return text(stripFileBodies(await api.updateExpenseReport(body)));
  }
};
