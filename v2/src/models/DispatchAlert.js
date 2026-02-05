const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DispatchAlert = sequelize.define('DispatchAlert', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  hotel_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'hotels',
      key: 'id'
    }
  },
  alert_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  alert_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  consecutive_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  notified_hotel_manager: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  notified_groupe_manager: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  notified_admin: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  }
}, {
  tableName: 'dispatch_alerts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = DispatchAlert;
