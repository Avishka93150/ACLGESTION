const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MonthlyClosure = sequelize.define('MonthlyClosure', {
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
  month: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  total_cash: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  total_expenses: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  total_remises: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'validated'),
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
  }
}, {
  tableName: 'monthly_closures',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = MonthlyClosure;
