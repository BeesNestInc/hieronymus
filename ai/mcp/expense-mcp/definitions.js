const mappingSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'マッピングID（更新・削除時に必須）' },
    kind: { type: 'string', enum: ['payee', 'payment'], description: '種別。payee=支払先（経費科目へのマッピング）、payment=出金元（貸方科目へのマッピング）' },
    key: { type: 'string', description: '検索キー（任意）' },
    name: { type: 'string', description: '名前（例: 「個人立て替え」「○○銀行」「水道光熱費」など。選択肢として表示される）' },
    companyId: { type: ['integer', 'null'], description: '取引先ID（kind=payee の場合、この支払先で証憑登録する際の companyId。null 可）' },
    account: { type: 'string', description: '対応する勘定科目コード（例: 7030040）' },
    subAccount: { type: ['integer', 'null'], description: '補助科目コード（任意。advance=true の場合は立替者から自動解決されるため通常不要）' },
    advance: { type: 'boolean', description: '立替フラグ。true の場合、貸方は仮払金（提出者から補助科目を自動解決）' }
  },
  required: ['kind', 'account']
};

export const toolDefinitions = [
  {
    name: 'list_expense_mappings',
    description: '経費精算マッピング（支払先/出金元と勘定科目の対応）の一覧を取得します。',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_expense_mapping',
    description: '経費精算マッピングを追加します（会計権限が必要）。',
    inputSchema: { type: 'object', properties: mappingSchema.properties, required: mappingSchema.required }
  },
  {
    name: 'update_expense_mapping',
    description: '経費精算マッピングを変更します（会計権限が必要）。id が必須。',
    inputSchema: { type: 'object', properties: mappingSchema.properties, required: ['id', 'kind', 'account'] }
  },
  {
    name: 'delete_expense_mapping',
    description: '経費精算マッピングを削除します（会計権限が必要）。id が必須。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'マッピングID' } },
      required: ['id']
    }
  },
  {
    name: 'list_expense_reports',
    description: '経費精算書の一覧を取得します。デフォルトは全件（未承認のみは type=not_approved）。自分が作成したもの、または会計/承認権限がある場合は全員のものが返ります。',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['not_approved'], description: '一覧種別（省略時は全件）' }
      }
    }
  },
  {
    name: 'get_expense_report',
    description: '経費精算書を1件取得します（明細行を含む）。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: '精算書ID' } },
      required: ['id']
    }
  },
  {
    name: 'update_expense_report',
    description: '経費精算書（未承認のもの）を更新します。明細行の作成・修正に利用します。lines を省略するとヘッダのみ更新します。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: '精算書ID' },
        submittedAt: { type: ['string', 'null'], description: '提出日 YYYY-MM-DD' },
        companyId: { type: ['integer', 'null'], description: '取引先ID' },
        taskId: { type: ['integer', 'null'], description: '案件ID' },
        purpose: { type: ['string', 'null'], description: '目的' },
        lines: {
          type: 'array',
          description: '明細行（指定時は全行を差し替え）',
          items: {
            type: 'object',
            properties: {
              lineNo: { type: 'integer', description: '行番号（0始まり。省略時は配列順）' },
              paymentDate: { type: ['string', 'null'], description: '支払日 YYYY-MM-DD' },
              payeeMappingId: { type: ['integer', 'null'], description: '支払先マッピングID（list_expense_mappings の kind=payee のエントリ。ここから経費科目・補助科目・証憑登録用の取引先が決まる）' },
              description: { type: ['string', 'null'], description: '内容（摘要）' },
              amount: { type: 'number', description: '支払金額' },
              paymentMappingId: { type: ['integer', 'null'], description: '出金元マッピングID' },
              note: { type: ['string', 'null'], description: '備考' },
              voucherId: { type: ['integer', 'null'], description: '証憑ID（原則セット推奨。任意）' }
            },
            required: ['amount']
          }
        }
      },
      required: ['id']
    }
  }
];
