/**
 * ACL GESTION v2 - Service de taches planifiees (Cron)
 * Remplace api/cron.php et api/cron_runner.php
 */
const cron = require('node-cron');
const logger = require('../config/logger');

let jobs = [];

function initCronJobs(models) {
  const { Hotel, Room, RoomDispatch, MaintenanceTicket, Notification, LeaveRequest,
          Task, Automation, AccessLog, DailyClosure } = models;
  const { Op } = require('sequelize');

  // Dispatch incomplet - 12h00 chaque jour
  jobs.push(cron.schedule('0 12 * * *', async () => {
    logger.info('[CRON] Verification dispatch incomplet');
    try {
      const today = new Date().toISOString().split('T')[0];
      const hotels = await Hotel.findAll({ where: { status: 'active' } });

      for (const hotel of hotels) {
        const rooms = await Room.findAll({ where: { hotel_id: hotel.id, status: 'active' } });
        const dispatched = await RoomDispatch.count({
          include: [{ model: Room, where: { hotel_id: hotel.id } }],
          where: { dispatch_date: today }
        });

        if (dispatched === 0 && rooms.length > 0) {
          logger.warn(`[CRON] Aucun dispatch pour ${hotel.name}`);
          // Notifier les managers
          await notifyHotelManagers(models, hotel.id,
            'Dispatch incomplet',
            `Aucune chambre n'a ete dispatchee aujourd'hui pour ${hotel.name}.`,
            'warning'
          );
        }
      }
    } catch (error) {
      logger.error('[CRON] Erreur dispatch:', error);
    }
  }, { timezone: 'Europe/Paris' }));

  // Controles incomplets - 19h00 chaque jour
  jobs.push(cron.schedule('0 19 * * *', async () => {
    logger.info('[CRON] Verification controles incomplets');
    try {
      const today = new Date().toISOString().split('T')[0];
      const hotels = await Hotel.findAll({ where: { status: 'active' } });

      for (const hotel of hotels) {
        const nonControlled = await RoomDispatch.count({
          include: [{ model: Room, where: { hotel_id: hotel.id } }],
          where: { dispatch_date: today, status: 'completed' }
        });

        if (nonControlled > 0) {
          await notifyHotelManagers(models, hotel.id,
            'Controles incomplets',
            `${nonControlled} chambre(s) nettoyee(s) non controlees pour ${hotel.name}.`,
            'warning'
          );
        }
      }
    } catch (error) {
      logger.error('[CRON] Erreur controles:', error);
    }
  }, { timezone: 'Europe/Paris' }));

  // Maintenance alertes - 09h00 chaque jour
  jobs.push(cron.schedule('0 9 * * *', async () => {
    logger.info('[CRON] Verification tickets maintenance');
    try {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      // Tickets ouverts > 2 jours non notifies
      const tickets2d = await MaintenanceTicket.findAll({
        where: {
          status: 'open',
          created_at: { [Op.lt]: twoDaysAgo },
          notified_2days: 0
        }
      });

      for (const ticket of tickets2d) {
        await ticket.update({ notified_2days: 1 });
        await notifyHotelManagers(models, ticket.hotel_id,
          'Ticket non pris en charge',
          `Ticket #${ticket.id} ouvert depuis plus de 2 jours (${ticket.category}).`,
          'warning'
        );
      }

      // Tickets en cours > 5 jours non notifies
      const tickets5d = await MaintenanceTicket.findAll({
        where: {
          status: 'in_progress',
          created_at: { [Op.lt]: fiveDaysAgo },
          notified_5days: 0
        }
      });

      for (const ticket of tickets5d) {
        await ticket.update({ notified_5days: 1 });
        await notifyHotelManagers(models, ticket.hotel_id,
          'Ticket non resolu depuis 5 jours',
          `Ticket #${ticket.id} en cours depuis plus de 5 jours. Action urgente requise.`,
          'danger'
        );
      }
    } catch (error) {
      logger.error('[CRON] Erreur maintenance:', error);
    }
  }, { timezone: 'Europe/Paris' }));

  // Rappel conges en attente - Lundi 09h00
  jobs.push(cron.schedule('0 9 * * 1', async () => {
    logger.info('[CRON] Rappel conges en attente');
    try {
      const pending = await LeaveRequest.findAll({
        where: { status: 'pending' },
        include: [{ model: models.User, as: 'employee' }]
      });

      // Grouper par hotel
      const byHotel = {};
      for (const leave of pending) {
        const hotelId = leave.hotel_id || 'global';
        if (!byHotel[hotelId]) byHotel[hotelId] = [];
        byHotel[hotelId].push(leave);
      }

      for (const [hotelId, leaves] of Object.entries(byHotel)) {
        if (hotelId !== 'global') {
          await notifyHotelManagers(models, parseInt(hotelId),
            'Conges en attente',
            `${leaves.length} demande(s) de conges en attente de validation.`,
            'info'
          );
        }
      }
    } catch (error) {
      logger.error('[CRON] Erreur conges:', error);
    }
  }, { timezone: 'Europe/Paris' }));

  // Taches a echeance - 09h00 chaque jour
  jobs.push(cron.schedule('0 9 * * *', async () => {
    logger.info('[CRON] Verification taches a echeance');
    try {
      const today = new Date().toISOString().split('T')[0];
      const dueTasks = await Task.findAll({
        where: {
          due_date: { [Op.lte]: today },
          is_completed: 0
        }
      });

      for (const task of dueTasks) {
        if (task.assigned_to) {
          await Notification.create({
            user_id: task.assigned_to,
            type: 'warning',
            title: 'Tache a echeance',
            message: `La tache "${task.title}" arrive a echeance.`,
            created_at: new Date()
          });
        }
      }
    } catch (error) {
      logger.error('[CRON] Erreur taches:', error);
    }
  }, { timezone: 'Europe/Paris' }));

  // Clotures manquantes - 13h00 chaque jour
  jobs.push(cron.schedule('0 13 * * *', async () => {
    logger.info('[CRON] Verification clotures manquantes');
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hotels = await Hotel.findAll({ where: { status: 'active' } });

      for (const hotel of hotels) {
        const closure = await DailyClosure.findOne({
          where: { hotel_id: hotel.id, closure_date: yesterday }
        });

        if (!closure) {
          await notifyHotelManagers(models, hotel.id,
            'Cloture manquante',
            `La cloture journaliere du ${yesterday} n'a pas ete effectuee pour ${hotel.name}.`,
            'warning'
          );
        }
      }
    } catch (error) {
      logger.error('[CRON] Erreur clotures:', error);
    }
  }, { timezone: 'Europe/Paris' }));

  // Nettoyage - 03h00 chaque jour
  jobs.push(cron.schedule('0 3 * * *', async () => {
    logger.info('[CRON] Nettoyage donnees anciennes');
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      // Supprimer les notifications lues > 90 jours
      await Notification.destroy({
        where: { is_read: 1, created_at: { [Op.lt]: ninetyDaysAgo } }
      });

      // Supprimer les access_logs > 90 jours (selon retention RGPD)
      await AccessLog.destroy({
        where: { created_at: { [Op.lt]: ninetyDaysAgo } }
      });

      logger.info('[CRON] Nettoyage termine');
    } catch (error) {
      logger.error('[CRON] Erreur nettoyage:', error);
    }
  }, { timezone: 'Europe/Paris' }));

  logger.info(`[CRON] ${jobs.length} taches planifiees initialisees`);
}

// Helper: Notifier les managers d'un hotel
async function notifyHotelManagers(models, hotelId, title, message, type = 'info') {
  const { User, UserHotel, Notification } = models;

  try {
    // Trouver les managers de cet hotel
    const managers = await User.findAll({
      include: [{
        model: models.Hotel,
        through: { model: UserHotel },
        where: { id: hotelId }
      }],
      where: {
        role: ['admin', 'groupe_manager', 'hotel_manager'],
        status: 'active'
      }
    });

    // Aussi notifier tous les admins (meme s'ils ne sont pas assignes a cet hotel)
    const admins = await User.findAll({
      where: { role: 'admin', status: 'active' }
    });

    const allRecipients = new Map();
    [...managers, ...admins].forEach(u => allRecipients.set(u.id, u));

    for (const [userId] of allRecipients) {
      await Notification.create({
        user_id: userId,
        type,
        title,
        message,
        created_at: new Date()
      });
    }
  } catch (error) {
    logger.error('[CRON] Erreur notification managers:', error);
  }
}

function stopCronJobs() {
  jobs.forEach(job => job.stop());
  jobs = [];
  logger.info('[CRON] Toutes les taches arretees');
}

module.exports = { initCronJobs, stopCronJobs };
