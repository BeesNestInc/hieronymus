import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class Voucher extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
			this.hasOne(models.Company, {
				foreignKey: 'id',
				sourceKey: 'companyId',
        as: 'company'
			});
			this.hasOne(models.User, {
				foreignKey: 'id',
				sourceKey: 'createdBy',
        as: 'createUser'
			});
			this.hasOne(models.User, {
				foreignKey: 'id',
				sourceKey: 'updatedBy',
        as: 'updateUser'
			});
			// OK済み（「この証憑は問題ないので誰ももう処理しない」の意思表示）の
			// 監査付き状態。承認と同じsettledAt/settledByパターン
			this.hasOne(models.User, {
				foreignKey: 'id',
				sourceKey: 'settledBy',
        as: 'settleUser'
			});
      this.hasMany(models.VoucherFile, {
        foreignKey: 'voucherId',
        as: 'files'
      })
			this.belongsTo(models.VoucherClass, {
				sourceKey: 'voucherClassId',
        as: 'voucherClass'
			});
 			this.belongsTo(models.TaxRule, {
 				sourceKey: 'taxRuleId',
         as: 'taxRule'
 			});
 			this.belongsTo(models.ExpenseReport, {
 				foreignKey: 'expenseReportId',
         as: 'expenseReport',
         onDelete: 'SET NULL'
 			});
			this.hasOne(models.TransactionDocument, {
				foreignKey: 'voucherId',
				onDelete: 'SET NULL'
			});
    }
  }
  Voucher.init({
    voucherClassId: DataTypes.INTEGER,
    issueDate: DataTypes.DATEONLY,
    paymentDate: DataTypes.DATEONLY,
    companyId: DataTypes.INTEGER,
    expenseReportId: DataTypes.INTEGER,
    amount: DataTypes.DECIMAL(12),
    tax: DataTypes.DECIMAL(12),
    taxRuleId: DataTypes.INTEGER,
    description: DataTypes.TEXT,
    invoiceNo: DataTypes.TEXT,
    settledAt: DataTypes.DATE,
    settledBy: DataTypes.INTEGER,
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Voucher',
  });
  return Voucher;
};