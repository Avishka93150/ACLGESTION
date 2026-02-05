/**
 * ACL GESTION v2 - Auth Routes
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, Hotel, UserHotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const { logAccess } = require('../middleware/rgpd');
const config = require('../config');

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Compte desactive. Contactez votre administrateur.'
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects'
      });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiry }
    );

    // Return user without password
    const userData = user.toJSON();
    delete userData.password;

    res.json({
      success: true,
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion'
    });
  }
});

// GET /auth/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouve'
      });
    }

    // Get user hotels
    const userHotels = await UserHotel.findAll({
      where: { user_id: user.id }
    });

    const hotelIds = userHotels.map(uh => uh.hotel_id);
    let hotels = [];
    if (hotelIds.length > 0) {
      hotels = await Hotel.findAll({
        where: { id: { [Op.in]: hotelIds }, status: 'active' }
      });
    }

    res.json({
      success: true,
      user: { ...user.toJSON(), hotels }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// PUT /auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouve'
      });
    }

    const updates = {};
    if (req.body.email) updates.email = req.body.email.toLowerCase().trim();
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.password) {
      updates.password = await bcrypt.hash(req.body.password, 10);
    }

    await user.update(updates);

    const userData = user.toJSON();
    delete userData.password;

    res.json({
      success: true,
      message: 'Profil mis a jour',
      user: userData
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /auth/management-info
router.get('/management-info', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let hotels = [];
    if (userRole === 'admin') {
      hotels = await Hotel.findAll({ where: { status: 'active' } });
    } else {
      const userHotels = await UserHotel.findAll({ where: { user_id: userId } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      if (hotelIds.length > 0) {
        hotels = await Hotel.findAll({
          where: { id: { [Op.in]: hotelIds }, status: 'active' }
        });
      }
    }

    const hotelIds = hotels.map(h => h.id);

    // Count managed users (users assigned to same hotels)
    let managedUsersCount = 0;
    if (hotelIds.length > 0) {
      const managedAssignments = await UserHotel.findAll({
        where: { hotel_id: { [Op.in]: hotelIds } },
        attributes: ['user_id'],
        group: ['user_id']
      });
      managedUsersCount = managedAssignments.length;
    }

    res.json({
      success: true,
      hotels,
      managedUsersCount
    });
  } catch (error) {
    console.error('Management info error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;
