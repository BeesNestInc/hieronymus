import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class TransactionDetail extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
			this.hasOne(models.TransactionDocument, {
				sourceKey: 'transactionDocumentId',
				foreignKey: 'id',
				as: 'transactionDocument',
				onDelete: 'CASCADE'
			});
			this.hasOne(models.Item, {
				sourceKey: 'itemId',
				foreignKey: 'id',
				as: 'item'
			});
			this.belongsTo(models.TaxRule, {
				sourceKey: 'taxRuleId',
				as: 'taxRule'
			});
    }
  }
  TransactionDetail.init({
    transactionDocumentId: DataTypes.INTEGER,
    lineNo: DataTypes.INTEGER,
    itemId: DataTypes.INTEGER,
    itemName: DataTypes.TEXT,
    itemSpec: DataTypes.TEXT,
    unitPrice: DataTypes.DECIMAL(12),
    itemNumber: DataTypes.DECIMAL(8,2),
    unit: DataTypes.STRING,
    amount: DataTypes.DECIMAL(12),
    tax: DataTypes.DECIMAL(12),
    taxRuleId: DataTypes.INTEGER,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'TransactionDetail',
  });
  return TransactionDetail;
};