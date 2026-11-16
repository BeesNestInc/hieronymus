import {Model} from 'sequelize';

// 予定の個別（例外）設定。月次予定の特定の月だけ、金額や内容を差し替える。
// 「ざくっと金額を入れておいて、確定したら本当の金額を入れる」用途。
// - 値が null の項目は元の予定の値を引き継ぐ
// - deleted: true のときはその月の予定自体を取り消す（表示しない）
// - (scheduleId, date) で一意。date は展開後の実際の発生日
// 単発（once）の予定には個別設定を使わない（直接編集すればよい）
export default (sequelize, DataTypes) => {
  class ScheduleOverride extends Model {
    static associate(models) {
      this.belongsTo(models.Schedule, {
        as: 'schedule',
        foreignKey: 'scheduleId',
        onDelete: 'CASCADE'
      });
    }
  }
  ScheduleOverride.init({
    scheduleId: DataTypes.INTEGER,
    date: DataTypes.DATEONLY,
    title: DataTypes.STRING,
    kind: DataTypes.STRING(8),
    amount: DataTypes.BIGINT,
    note: DataTypes.TEXT,
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'ScheduleOverride',
  });
  return ScheduleOverride;
};
