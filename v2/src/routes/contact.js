const router = require('express').Router();
const { contactLimiter } = require('../middleware/rateLimit');
const { sendEmail } = require('../services/email');
const config = require('../config');

router.post('/', contactLimiter, async (req, res) => {
  try {
    // Honeypot check
    if (req.body.website) {
      return res.status(400).json({ success: false, message: 'Erreur de validation' });
    }
    const { name, firstname, email, phone, company, hotels_count, message } = req.body;
    if (!name || !firstname || !email) {
      return res.status(400).json({ success: false, message: 'Nom, prenom et email requis' });
    }
    // Email admin
    await sendEmail({
      to: config.email.adminEmail,
      subject: `[ACL GESTION] Nouvelle demande de ${firstname} ${name}`,
      html: `<h2>Nouvelle demande de contact</h2>
        <p><strong>Nom:</strong> ${name} ${firstname}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Tel:</strong> ${phone || 'Non renseigne'}</p>
        <p><strong>Societe:</strong> ${company || 'Non renseigne'}</p>
        <p><strong>Nombre d'hotels:</strong> ${hotels_count || 'Non renseigne'}</p>
        <p><strong>Message:</strong></p><p>${message || 'Aucun message'}</p>`
    });
    res.json({ success: true, message: 'Demande envoyee avec succes' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
