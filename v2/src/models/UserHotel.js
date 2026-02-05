const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserHotel = sequelize.define('UserHotel', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  hotel_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'hotels',
      key: 'id'
    }
  }
}, {
  tableName: 'user_hotels',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'hotel_id'],
      name: 'unique_assignment'
    }
  ]
});

module.exports = UserHotel;
