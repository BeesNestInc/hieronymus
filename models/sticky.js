import {Model} from 'sequelize';

export default (sequelize, DataTypes) => {
  class Sticky extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        as: 'author',
        foreignKey: 'authorId',
        onDelete: 'CASCADE'
      });
      this.hasMany(models.StickyStatus, {
        foreignKey: 'stickyId',
        onDelete: 'CASCADE'
      });
    }
  }
  Sticky.init({
    authorId: DataTypes.INTEGER,
    // 'handoff'（申し送り: 他人に伝える）/ 'memo'（メモ: 自分用）
    kind: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'handoff'
    },
    message: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Sticky',
  });
  return Sticky;
};