const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RevenueEntry = sequelize.define('RevenueEntry', {
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
  entry_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  occupancy_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  revpar: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
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
  tableName: 'revenue_entries',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = RevenueEntry;
