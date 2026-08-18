const slipLineSchema = {
  type: 'object',
  properties: {
    debitAccount: { type: 'string', description: '借方の勘定科目コード（例: 1000001）' },
    debitSubAccount: { type: 'integer', description: '借方の補助科目コード（任意）' },
    debitAmount: { type: 'number', description: '借方の金額' },
    debitTaxRuleId: { type: 'integer', description: '借方の消費税率ルールID（任意。指定時はサーバ側で税額を計算します）' },
    debitVoucherId: { type: 'integer', description: '借方に紐付ける証憑ID（任意）' },
    creditAccount: { type: 'string', description: '貸方の勘定科目コード（例: 1000001）' },
    creditSubAccount: { type: 'integer', description: '貸方の補助科目コード（任意）' },
    creditAmount: { type: 'number', description: '貸方の金額' },
    creditTaxRuleId: { type: 'integer', description: '貸方の消費税率ルールID（任意。指定時はサーバ側で税額を計算します）' },
    creditVoucherId: { type: 'integer', description: '貸方に紐付ける証憑ID（任意）' },
    projectId: { type: 'integer', description: 'プロジェクトID（任意。部門会計利用時）' },
    application1: { type: 'string', description: '摘要（任意）' },
    application2: { type: 'string', description: '備考・補足（任意）' }
  },
  required: ['debitAccount', 'debitAmount', 'creditAccount', 'creditAmount']
};

export const toolDefinitions = [
  {
    name: 'get_accounts',
    description: '勘定科目と補助科目の一覧を取得します（仕訳入力時の科目コード・税区分の確認用）。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_companies',
    description: '取引先（会社）の一覧を取得します。証憑登録時の companyId 特定に利用します。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_voucher_classes',
    description: '伝票種別（VoucherClass）の一覧を取得します。証憑登録時の voucherClassId 特定に利用します。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_tax_rules',
    description: '指定日時点で有効な消費税率ルールを取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '基準日 YYYY-MM-DD（省略時は当日）' }
      }
    }
  },
  {
    name: 'get_fiscal_year',
    description: '指定の年月が属する会計年度（term, 税込表示等）を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        month: { type: 'integer' }
      },
      required: ['year', 'month']
    }
  },
  {
    name: 'get_cross_slip',
    description: '仕訳伝票を年/月/号で取得します（会計閲覧権限が必要）。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        month: { type: 'integer' },
        no: { type: 'integer' }
      },
      required: ['year', 'month', 'no']
    }
  },
  {
    name: 'list_cross_slips',
    description: '仕訳伝票の一覧を取得します。デフォルトは未承認の伝票（承認待ち一覧）。',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['not_approved'], description: '一覧種別（省略時は not_approved）' }
      }
    }
  },
  {
    name: 'list_vouchers',
    description: '証憑の一覧を取得します（期間・取引先・種別・金額範囲で絞り込み可）。',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '発行日または支払日が一致する証憑 YYYY-MM-DD' },
        month: { type: 'string', description: '月（例: 2026-03）' },
        company: { type: 'integer', description: '取引先ID' },
        voucherClassId: { type: 'integer', description: '伝票種別ID' },
        lower: { type: 'integer', description: '金額の下限' },
        upper: { type: 'integer', description: '金額の上限' }
      }
    }
  },
  {
    name: 'create_cross_slip',
    description: '仕訳伝票を作成します。税額はサーバ側で自動計算・上書きされます。承認権限が無いユーザーが作成した場合は承認待ちになります。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: '年' },
        month: { type: 'integer', description: '月' },
        day: { type: 'integer', description: '日（1-31）' },
        lines: { type: 'array', items: slipLineSchema, description: '仕訳明細行' }
      },
      required: ['year', 'month', 'day', 'lines']
    }
  },
  {
    name: 'update_cross_slip',
    description: '未承認の仕訳伝票を更新します（作成者または会計権限者に限る。承認済みは変更不可）。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        month: { type: 'integer' },
        day: { type: 'integer' },
        no: { type: 'integer', description: '伝票番号' },
        lines: { type: 'array', items: slipLineSchema }
      },
      required: ['year', 'month', 'no', 'day', 'lines']
    }
  },
  {
    name: 'approve_cross_slip',
    description: '承認待ちの仕訳伝票を承認します（承認権限が必要）。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        month: { type: 'integer' },
        no: { type: 'integer' }
      },
      required: ['year', 'month', 'no']
    }
  },
  {
    name: 'disapprove_cross_slip',
    description: '承認済みの仕訳伝票を不承認に戻します（承認権限が必要）。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        month: { type: 'integer' },
        no: { type: 'integer' }
      },
      required: ['year', 'month', 'no']
    }
  },
  {
    name: 'delete_cross_slip',
    description: '未承認の仕訳伝票を削除します（承認権限が必要）。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        month: { type: 'integer' },
        day: { type: 'integer' },
        no: { type: 'integer' }
      },
      required: ['year', 'month', 'day', 'no']
    }
  },
  {
    name: 'create_voucher',
    description: '証憑（電子化証票）を登録します。税額は指定した税率ルールからサーバ側で自動計算されます。',
    inputSchema: {
      type: 'object',
      properties: {
        voucherClassId: { type: 'integer', description: '伝票種別ID（get_voucher_classes で確認）' },
        issueDate: { type: 'string', description: '発行日 YYYY-MM-DD' },
        companyId: { type: 'integer', description: '取引先ID（get_companies で確認）' },
        amount: { type: 'number', description: '金額（税抜）' },
        taxRuleId: { type: 'integer', description: '消費税率ルールID（省略時は税額0）' },
        paymentDate: { type: 'string', description: '支払日 YYYY-MM-DD（任意）' },
        description: { type: 'string', description: '説明（任意）' },
        invoiceNo: { type: 'string', description: '請求番号（任意）' }
      },
      required: ['voucherClassId', 'issueDate', 'companyId', 'amount']
    }
  },
  {
    name: 'update_voucher',
    description: '証憑を更新します（作成者または会計権限者に限る）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: '証憑ID' },
        voucherClassId: { type: 'integer' },
        issueDate: { type: 'string' },
        companyId: { type: 'integer' },
        amount: { type: 'number' },
        taxRuleId: { type: 'integer' },
        paymentDate: { type: 'string' },
        description: { type: 'string' },
        invoiceNo: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_voucher',
    description: '証憑を削除します（作成者または会計権限者に限る）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' }
      },
      required: ['id']
    }
  },
  {
    name: 'compute_slip_taxes',
    description: '仕訳明細の税額計算と仮払/仮受消費税行の生成をプレビューします（保存はしません）。実際の保存時の税額はサーバ側で再計算されます。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        month: { type: 'integer' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              debitAccount: { type: 'string' },
              debitAmount: { type: 'number' },
              debitTaxRuleId: { type: 'integer' },
              creditAccount: { type: 'string' },
              creditAmount: { type: 'number' },
              creditTaxRuleId: { type: 'integer' }
            }
          }
        }
      },
      required: ['year', 'month', 'lines']
    }
  }
];