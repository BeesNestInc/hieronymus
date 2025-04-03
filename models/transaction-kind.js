import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class TransactionKind extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.TransactionDocument, {
        foreignKey: 'kindId',
        as: 'documents'
      });
			this.belongsTo(models.VoucherClass, {
				sourceKey: 'bookId',
        as: 'book'
			});
    }
  };
  TransactionKind.init({
    label: DataTypes.STRING,
    displayOrder: DataTypes.INTEGER,
    hasDetails: DataTypes.BOOLEAN,
    hasDocument: DataTypes.INTEGER,
    forCustomer: DataTypes.BOOLEAN,
    bookId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'TransactionKind',
  });
  return TransactionKind;
};
