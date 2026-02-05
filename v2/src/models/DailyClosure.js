const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DailyClosure = sequelize.define('DailyClosure', {
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
  closure_date: {
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
  cash_difference: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  expense_receipt: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  remise_banque: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'validated', 'rejected'),
    defaultValue: 'draft'
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  validated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  validated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'daily_closures',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['hotel_id', 'closure_date'],
      name: 'unique_closure'
    }
  ]
});

module.exports = DailyClosure;
