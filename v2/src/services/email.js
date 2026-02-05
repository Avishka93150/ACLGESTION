/**
 * ACL GESTION v2 - Service Email
 */
const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../config/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!config.email.enabled) {
    logger.info('[EMAIL] SMTP desactive');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.pass
    }
  });

  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  const transport = getTransporter();
  if (!transport) {
    logger.warn(`[EMAIL] Non envoye (SMTP desactive): ${subject}`);
    return false;
  }

  try {
    await transport.sendMail({
      from: `"${config.app.name}" <${config.email.from}>`,
      to,
      subject,
      html,
      text
    });
    logger.info(`[EMAIL] Envoye a ${to}: ${subject}`);
    return true;
  } catch (error) {
    logger.error(`[EMAIL] Erreur envoi a ${to}:`, error);
    return false;
  }
}

// Templates email predefinis
function leaveNotificationHTML(toName, employeeName, typeLabel, dateRange, days, isUrgent) {
  const bgColor = isUrgent ? '#e74c3c' : '#1E3A5F';
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Inter', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="background: ${bgColor}; color: white; padding: 30px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 15px;">${isUrgent ? '&#x1F3E5;' : '&#x1F4C5;'}</div>
      <h1 style="margin: 0; font-size: 24px;">${isUrgent ? 'Arret Maladie' : 'Demande de Conges'}</h1>
    </div>
    <div style="padding: 30px;">
      <p>Bonjour ${escHtml(toName)},</p>
      <p>Une nouvelle demande necessite votre attention :</p>
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Collaborateur:</strong> ${escHtml(employeeName)}</div>
        <div style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Type:</strong> ${escHtml(typeLabel)}</div>
        <div style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Periode:</strong> ${escHtml(dateRange)}</div>
        <div style="padding: 10px 0;"><strong>Duree:</strong> ${days} jour(s)</div>
      </div>
      <p>Connectez-vous a ACL GESTION pour traiter cette demande.</p>
      <center><a href="${config.app.url}" style="display: inline-block; background: #1E3A5F; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; margin-top: 20px;">Acceder a la plateforme</a></center>
    </div>
    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
      <p style="margin: 0;">ACL GESTION - Plateforme de gestion hoteliere</p>
    </div>
  </div>
</body>
</html>`;
}

function maintenanceNotificationHTML(ticketId, hotelName, roomInfo, category, priority, description, creatorName, type) {
  const bgColor = priority === 'critical' || type !== 'created' ? '#DC2626' : '#1E3A5F';
  const titles = {
    created: 'Nouveau Ticket Maintenance',
    reminder_2days: 'Ticket en attente depuis 2 jours',
    reminder_5days: 'Ticket non resolu depuis 5 jours'
  };

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: ${bgColor}; color: white; padding: 20px; text-align: center;">
      <h2 style="margin: 0;">${titles[type] || titles.created}</h2>
      <p style="margin: 10px 0 0; opacity: 0.9;">Ticket #${ticketId}</p>
    </div>
    <div style="padding: 25px; background: #f9f9f9;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Hotel</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${escHtml(hotelName)}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Localisation</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${escHtml(roomInfo)}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Categorie</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${escHtml(category)}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Priorite</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${escHtml(priority)}</td></tr>
        <tr><td style="padding: 10px 0;"><strong>Signale par</strong></td><td style="padding: 10px 0;">${escHtml(creatorName)}</td></tr>
      </table>
      <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 5px; border-left: 4px solid #1E3A5F;">
        <strong>Description:</strong>
        <p style="margin: 10px 0 0; color: #333;">${escHtml(description)}</p>
      </div>
    </div>
    <div style="padding: 15px; background: #1E3A5F; color: white; text-align: center; font-size: 12px;">
      <p style="margin: 0;">ACL GESTION - Systeme de gestion hoteliere</p>
    </div>
  </div>
</body>
</html>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  sendEmail,
  leaveNotificationHTML,
  maintenanceNotificationHTML
};
