const nodemailer = require('nodemailer');

const sendTestEmail = async (smtpConfig, toEmail) => {
    // Smart detection of security settings: 
    // Port 465 -> Always SSL (secure: true)
    // Port 587 -> Always STARTTLS (secure: false)
    // Other ports -> Respect user's encryption toggle

    let secure = smtpConfig.encryption === 'ssl';
    if (Number(smtpConfig.port) === 587) secure = false;
    else if (Number(smtpConfig.port) === 465) secure = true;

    const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: secure,
        auth: {
            user: smtpConfig.username,
            pass: smtpConfig.password,
        },
    });

    const sender = smtpConfig.fromName
        ? `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`
        : smtpConfig.fromEmail;

    const info = await transporter.sendMail({
        from: sender,
        to: toEmail,
        subject: "SMTP Test Mail",
        text: "This is a test email to verify your SMTP settings.",
        html: "<b>This is a test email to verify your SMTP settings.</b>",
    });

    return info;
};

module.exports = {
    sendTestEmail
};
