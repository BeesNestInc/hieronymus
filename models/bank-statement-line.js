import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class BankStatementLine extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			this.belongsTo(models.BankStatement, {
				foreignKey: 'statementId',
				onDelete: 'CASCADE'
			});
			// 突合で対応が確定した仕訳明細行
			this.belongsTo(models.CrossSlipDetail, {
				foreignKey: 'crossSlipDetailId',
				as: 'crossSlipDetail',
				onDelete: 'SET NULL'
			});
			// この行から起票した伝票が持つ証憑
			this.belongsTo(models.Voucher, {
				foreignKey: 'voucherId',
				as: 'voucher',
				onDelete: 'SET NULL'
			});
			// 個人カード立替で精算書の明細になった行
			this.belongsTo(models.ExpenseReportLine, {
				foreignKey: 'expenseReportLineId',
				as: 'expenseReportLine',
				onDelete: 'SET NULL'
			});
		}
	};
	BankStatementLine.init({
		statementId: DataTypes.INTEGER,
		lineNo: DataTypes.INTEGER,
		date: DataTypes.DATEONLY,
		// 取り込み元の摘要（正規化前）
		rawDescription: DataTypes.STRING,
		// 正規化後の摘要
		description: DataTypes.STRING,
		// 銀行系: 入金額/出金額/差引残高
		amountIn: DataTypes.DECIMAL(12),
		amountOut: DataTypes.DECIMAL(12),
		balance: DataTypes.DECIMAL(12),
		// カード系: 利用額/利用店名/外貨明細
		amount: DataTypes.DECIMAL(12),
		merchant: DataTypes.STRING,
		foreignAmount: DataTypes.DECIMAL(12),
		foreignCurrency: DataTypes.STRING,
		// 'normal'|'interest'|'fee'|'card_payment'|'tax'|'transfer'|'other'
		category: DataTypes.STRING,
		// 'unmatched'|'matched'|'booked'|'ignored'
		status: DataTypes.STRING,
		// 取り込み元のメモ欄（精算対象判定のヒント）
		memo: DataTypes.STRING
	}, {
		sequelize,
		modelName: 'BankStatementLine',
	});
	return BankStatementLine;
};
