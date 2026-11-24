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
    forCompany: DataTypes.BOOLEAN,
    forBook: DataTypes.BOOLEAN,
    bookId: DataTypes.INTEGER,
    // 連携専用種別（経費精算書の「精算書」等）。手動作成の種別selectには
    // 出さず、文書の中身は元データ側で編集する
    linked: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'TransactionKind',
  });
  return TransactionKind;
};
