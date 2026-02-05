const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LinenTransaction = sequelize.define('LinenTransaction', {
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
  transaction_type: {
    type: DataTypes.ENUM('collecte', 'reception', 'stock'),
    allowNull: false
  },
  transaction_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  petit_draps: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  petite_housse: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  grand_draps: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  grande_housse: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  document_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'linen_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = LinenTransaction;
