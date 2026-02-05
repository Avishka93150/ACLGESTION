const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CashTracking = sequelize.define('CashTracking', {
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
  tracking_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  cash_opening: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  cash_closing: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'cash_tracking',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = CashTracking;
