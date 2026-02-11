const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');

const getTransporter = async () => {
    const settings = await Settings.findOne();
    if (!settings || !settings.smtp || !settings.smtp.host) {
        throw new Error("SMTP settings not configured");
    }

    const { smtp } = settings;
    let secure = smtp.encryption === 'ssl';
    if (Number(smtp.port) === 587) secure = false;
    else if (Number(smtp.port) === 465) secure = true;

    return nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: secure,
        auth: {
            user: smtp.username,
            pass: smtp.password,
        },
    });
};

const sendTestEmail = async (smtpConfig, toEmail) => {
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

const sendEmail = async (to, subject, text, html) => {
    try {
        const settings = await Settings.findOne();
        const transporter = await getTransporter();

        const sender = settings.smtp.fromName
            ? `"${settings.smtp.fromName}" <${settings.smtp.fromEmail}>`
            : settings.smtp.fromEmail;

        const info = await transporter.sendMail({
            from: sender,
            to,
            subject,
            text,
            html: html || text,
        });

        return info;
    } catch (error) {
        console.error("Email Sending Error:", error);
        throw error;
    }
};

module.exports = {
    sendTestEmail,
    sendEmail
};
