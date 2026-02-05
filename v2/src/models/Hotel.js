const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Hotel = sequelize.define('Hotel', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  address: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  postal_code: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  stars: {
    type: DataTypes.TINYINT.UNSIGNED,
    defaultValue: 3,
    validate: {
      min: 1,
      max: 5
    }
  },
  total_floors: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 1
  },
  checkin_time: {
    type: DataTypes.TIME,
    defaultValue: '15:00:00'
  },
  checkout_time: {
    type: DataTypes.TIME,
    defaultValue: '11:00:00'
  },
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  xotelo_hotel_key: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
}, {
  tableName: 'hotels',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Hotel;
