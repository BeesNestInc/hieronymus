import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class Company extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
			this.belongsTo(models.CompanyClass, {
				sourceKey: 'companyClassId',
        as: 'companyClass'
			});
    }
  }
  Company.init({
    companyClassId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    chargeName: DataTypes.STRING,
    ruby: DataTypes.STRING,
    zip: DataTypes.STRING,
    address1: DataTypes.STRING,
    address2: DataTypes.STRING,
    description: DataTypes.TEXT,
    key: DataTypes.STRING,
    closingDate: DataTypes.INTEGER,
    paymentDate: DataTypes.INTEGER,
    telNo: DataTypes.STRING,
    faxNo: DataTypes.STRING,
    email: DataTypes.STRING,
    url: DataTypes.STRING,
    logoURL: DataTypes.STRING,
    bankName: DataTypes.STRING,
    bankBranchName: DataTypes.STRING,
    accountType: DataTypes.INTEGER,
    accountNo: DataTypes.STRING,
    invoiceNo: DataTypes.TEXT,
    companyNo: DataTypes.TEXT,
    DUNS: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Company',
  });
  return Company;
}