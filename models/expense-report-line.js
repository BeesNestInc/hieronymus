import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class ExpenseReportLine extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			this.belongsTo(models.ExpenseReport, {
				foreignKey: 'expenseReportId',
				onDelete: 'CASCADE'
			});
			this.belongsTo(models.ExpenseMapping, {
				foreignKey: 'payeeMappingId',
				as: 'payeeMapping',
				onDelete: 'SET NULL'
			});
			this.belongsTo(models.ExpenseMapping, {
				foreignKey: 'paymentMappingId',
				as: 'paymentMapping',
				onDelete: 'SET NULL'
			});
			this.belongsTo(models.Voucher, {
				foreignKey: 'voucherId',
				as: 'voucher',
				onDelete: 'SET NULL'
			});
			this.belongsTo(models.TaxRule, {
				foreignKey: 'taxRuleId',
				as: 'taxRule'
			});
			// この明細行が載った仕訳伝票（承認時の分割起票で記録される）
			this.belongsTo(models.CrossSlip, {
				foreignKey: 'crossSlipId',
				as: 'crossSlip',
				onDelete: 'SET NULL'
			});
		}
	};
	ExpenseReportLine.init({
		expenseReportId: DataTypes.INTEGER,
		lineNo: DataTypes.INTEGER,
		paymentDate: DataTypes.DATEONLY,
		payeeMappingId: DataTypes.INTEGER,
		description: DataTypes.STRING,
		amount: DataTypes.DECIMAL(12),
		paymentMappingId: DataTypes.INTEGER,
		note: DataTypes.STRING,
		voucherId: DataTypes.INTEGER,
		taxRuleId: DataTypes.INTEGER,
		crossSlipId: DataTypes.INTEGER
	}, {
		sequelize,
		modelName: 'ExpenseReportLine',
	});
	return ExpenseReportLine;
};
