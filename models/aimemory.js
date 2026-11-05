import {Model} from 'sequelize';

// AI機能の「振り返り」メモリー。ユーザー単位の嗜好・定番パターンを記録し、
// manifests 実行時の文脈として読み戻す（履歴は使わない方針の代替品）。
// kind: 'profile'（固定の説明文、keyは空文字）/'learned'（振り返りで蓄える項目）
// key: learned の見出し（例: 'oxo 開発費の科目'）。value: 本文。
export default (sequelize, DataTypes) => {
  class Aimemory extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        foreignKey: 'userId',
        onDelete: 'CASCADE'
      });
    }
  }
  Aimemory.init({
    userId: DataTypes.INTEGER,
    kind: DataTypes.STRING(32),
    key: DataTypes.STRING(120),
    value: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Aimemory',
    tableName: 'Aimemories',
    indexes: [
      {
        unique: true,
        fields: [ 'userId', 'kind', 'key' ]
      }
    ]
  });
  return Aimemory;
};
