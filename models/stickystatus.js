import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class StickyStatus extends Model {
    static associate(models) {
      this.belongsTo(models.Sticky, {
        foreignKey: 'stickyId',
        onDelete: 'CASCADE'
      });
      this.belongsTo(models.User, {
        foreignKey: 'receiverId',
        onDelete: 'CASCADE'
      });
    }
  }
  StickyStatus.init({
    stickyId: DataTypes.INTEGER,
    receiverId: DataTypes.INTEGER,
    importance: DataTypes.INTEGER,
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    }
  }, {
    sequelize,
    modelName: 'StickyStatus',
  });
  return StickyStatus;
};