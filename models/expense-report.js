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
			this.belongsTo(models.CrossSlip, {
				foreignKey: 'crossSlipId',
				as: 'crossSlip',
				onDelete: 'SET NULL'
			});
			this.belongsTo(models.ExpenseMapping, {
				foreignKey: 'settlementMappingId',
				onDelete: 'SET NULL'
			});
			this.hasMany(models.ExpenseReportLine, {
				foreignKey: 'expenseReportId',
				as: 'lines',
				onDelete: 'CASCADE'
			});
		}
	};
	ExpenseReport.init({
		submittedBy: DataTypes.INTEGER,
		submittedAt: DataTypes.DATE,
		companyId: DataTypes.INTEGER,
		taskId: DataTypes.INTEGER,
		purpose: DataTypes.TEXT,
		settlementDate: DataTypes.DATEONLY,
		settlementMappingId: DataTypes.INTEGER,
		approvedAt: DataTypes.DATE,
		approvedBy: DataTypes.INTEGER,
		crossSlipId: DataTypes.INTEGER,
		createdBy: DataTypes.INTEGER,
		updatedBy: DataTypes.INTEGER
	}, {
		sequelize,
		modelName: 'ExpenseReport',
	});
	return ExpenseReport;
};
