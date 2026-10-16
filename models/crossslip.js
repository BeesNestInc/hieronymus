import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
	class CrossSlip extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
 		static associate(models) {
			// 経費精算書への紐付け（承認時の自動起票で設定される）。
			// 精算書が消されたときは伝票は残り、紐付けだけが解除される
			this.belongsTo(models.ExpenseReport, {
				foreignKey: 'expenseReportId',
				as: 'expenseReport',
				onDelete: 'SET NULL'
			});
 			this.hasMany(models.CrossSlipDetail, {
				foreignKey: 'crossSlipId',
				as: 'lines'
			});
			this.hasOne(models.User, {
				foreignKey: 'id',
				sourceKey: 'createdBy',
				as: 'creater',
				onDelete: 'RESTRICT',
				onUpdate: 'CASCADE'
			});
			this.hasOne(models.User, {
				foreignKey: 'id',
				sourceKey: 'approvedBy',
				as: 'approver',
				onDelete: 'RESTRICT',
				onUpdate: 'CASCADE'
			});
			this.hasOne(models.User, {
				foreignKey: 'id',
				sourceKey: 'updatedBy',
				as: 'updater',
				onDelete: 'RESTRICT',
				onUpdate: 'CASCADE'
			});
		}
	};
 	CrossSlip.init({
 		year: DataTypes.INTEGER,
 		month: DataTypes.INTEGER,
 		day: DataTypes.INTEGER,
 		no: DataTypes.INTEGER,
 		lineCount: DataTypes.INTEGER,
 		term: DataTypes.INTEGER,
 		approvedAt: DataTypes.DATE,
 		approvedBy: DataTypes.INTEGER,
 		expenseReportId: DataTypes.INTEGER,
 		createdBy: DataTypes.INTEGER,
 		updatedBy: DataTypes.INTEGER
 	}, {
		sequelize,
		modelName: 'CrossSlip',
	});
	return CrossSlip;
};
