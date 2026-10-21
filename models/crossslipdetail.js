import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class CrossSlipDetail extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			this.hasOne(models.CrossSlip, {
				sourceKey: 'crossSlipId',
				foreignKey: 'id',
				as: 'crossSlip',
				onDelete: 'cascade',
				onUpdate: 'cascade'
			});
			this.belongsTo(models.Voucher, {
				foreignKey: 'debitVoucherId',
				as: 'debitVoucher',
				onDelete: 'SET NULL',
				onUpdate: 'cascade'
			});
			this.belongsTo(models.Voucher, {
				foreignKey: 'creditVoucherId',
				as: 'creditVoucher',
				onDelete: 'SET NULL',
				onUpdate: 'cascade'
			});
			this.belongsTo(models.TaxRule, {
				sourceKey: 'debitTaxRuleId',
				as: 'debitTaxRule'
			});
			this.belongsTo(models.TaxRule, {
				sourceKey: 'creditTaxRuleId',
				as: 'creditTaxRule'
			});
			this.belongsTo(models.Project, {
				foreignKey: 'projectId',
				as: 'projectData'
			});
		}
	};
	CrossSlipDetail.init({
		crossSlipId: DataTypes.INTEGER,
		lineNo: DataTypes.INTEGER,
		debitAccount: DataTypes.STRING,
		debitSubAccount: DataTypes.INTEGER,
		debitAmount: DataTypes.DECIMAL(12),
		debitTax: DataTypes.DECIMAL(12),
		debitVoucherId: DataTypes.INTEGER,
		debitTaxRuleId: DataTypes.INTEGER,
		creditAccount: DataTypes.STRING,
		creditSubAccount: DataTypes.INTEGER,
		creditAmount: DataTypes.DECIMAL(12),
		creditTax: DataTypes.DECIMAL(12),
		creditVoucherId: DataTypes.INTEGER,
		creditTaxRuleId: DataTypes.INTEGER,
		projectId: DataTypes.INTEGER,
		application1: DataTypes.STRING,
		application2: DataTypes.STRING,
		// 取込明細行（BankStatementLine）との紐付け。
		// 伝票の更新は明細を再作成するため、行側の crossSlipDetailId だけでなく
		// 伝票側にも対象行を保持して、更新後の対応復元に使う
		statementLineId: DataTypes.INTEGER
	}, {
		sequelize,
		modelName: 'CrossSlipDetail',
	});
	return CrossSlipDetail;
};
