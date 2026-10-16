import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class ExpenseReport extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			this.belongsTo(models.User, {
				foreignKey: 'submittedBy',
				as: 'submitter'
			});
			this.belongsTo(models.User, {
				foreignKey: 'approvedBy',
				as: 'approver'
			});
			this.belongsTo(models.User, {
				foreignKey: 'createdBy',
				as: 'creater'
			});
			this.belongsTo(models.Company, {
				foreignKey: 'companyId',
				as: 'company',
				onDelete: 'SET NULL'
			});
 			this.belongsTo(models.Task, {
 				foreignKey: 'taskId',
 				as: 'task',
 				onDelete: 'SET NULL'
 			});
			// 紐付伝票は1:n（伝票側のexpenseReportIdが正）。
			// 精算書削除時は伝票は残り、紐付けだけが解除される
			this.hasMany(models.CrossSlip, {
				foreignKey: 'expenseReportId',
				as: 'crossSlips',
				onDelete: 'SET NULL'
			});
 			this.hasMany(models.ExpenseReportLine, {
 				foreignKey: 'expenseReportId',
 				as: 'lines',
 				onDelete: 'CASCADE'
 			});
 			this.hasMany(models.Voucher, {
 				foreignKey: 'expenseReportId',
 				as: 'vouchers',
 				onDelete: 'SET NULL'
 			});
		}
	};
 	ExpenseReport.init({
 		submittedBy: DataTypes.INTEGER,
 		submittedAt: DataTypes.DATE,
 		companyId: DataTypes.INTEGER,
 		taskId: DataTypes.INTEGER,
 		purpose: DataTypes.TEXT,
 		approvedAt: DataTypes.DATE,
 		approvedBy: DataTypes.INTEGER,
 		createdBy: DataTypes.INTEGER,
 		updatedBy: DataTypes.INTEGER
 	}, {
		sequelize,
		modelName: 'ExpenseReport',
	});
	return ExpenseReport;
};
