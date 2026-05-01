const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this if using another provider, but app password is required for Gmail
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendAccountCreationEmail = async (toEmail, role, identifierCode, username, password) => {
    try {
        const baseUrl = process.env.LOGIN_URL || 'http://localhost:5173/login';
        const loginUrl = (role === 'vendor' || role === 'buyer') ? `${baseUrl}?type=${role}` : baseUrl;
        
        const fromEmail = process.env.EMAIL_FROM || '"Saravana Graphics Supporting Team" <support@saravanagraphics.com>';
        const supportEmail = process.env.SMTP_USER || 'support@saravanagraphics.com';
        const contactNo = '+91 0000000000'; // Default, update as needed

        const identifierLabel = role === 'vendor' ? 'Vendor Number' : 'Buyer Code';

        const frontendUrl = process.env.FRONTEND_URL || 'https://saravanagraphics.onrender.com';
        
        const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
            <div style="background-color: white; padding: 15px; text-align: center; border-bottom: 3px solid #0b6bc7;">
                <img src="${frontendUrl}/logo.png" alt="Saravana Graphics Connect" style="height: 60px; width: auto;" />
            </div>
            <div style="padding: 20px;">
                <p>Dear Sir/Madam,</p>
                <p>Your account is created.</p>
                
                <p style="margin-bottom: 5px;"><strong>${identifierLabel}:</strong> ${identifierCode}</p>
                <p style="margin-bottom: 5px; margin-top: 5px;"><strong>User Name:</strong> ${username}</p>
                <p style="margin-bottom: 5px; margin-top: 5px;"><strong>Password:</strong> ${password}</p>
                <p style="margin-top: 5px;"><strong>Login URL:</strong> <a href="${loginUrl}">Login Link</a></p>
                
                <p style="font-size: 13px; color: #555;">(Click the link above to access your account.)</p>
                
                <p style="margin-top: 30px; margin-bottom: 5px;">Thank You,</p>
                <p style="margin-bottom: 5px; margin-top: 5px;"><strong>Saravana Graphics Supporting Team</strong></p>
                <p style="margin-bottom: 5px; margin-top: 5px;">Help Desk Email ID: <span style="background-color: #f0f0f0; padding: 2px 5px;">${supportEmail}</span></p>
                <p style="margin-top: 5px;">Contact No: ${contactNo}</p>
                
                <hr style="border-top: 1px solid #ccc; margin-top: 20px;" />
                
                <p style="margin-bottom: 5px; font-weight: bold; font-size: 14px;">Note:</p>
                <ul style="margin-top: 0; padding-left: 20px; font-size: 13px;">
                    <li>Password is case-sensitive.</li>
                    <li>This is an auto-generated email. Please do not reply.</li>
                </ul>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; font-size: 11px; color: #777; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0;">This email and any attachment(s) are privileged and confidential material of Saravana Graphics and should not be disclosed to, used by or copied in any manner by anyone other than the intended addressee. If this email has been sent to you in error, please delete this message and/or re-direct it to the sender. The views expressed in this Email message(including the enclosure/attachments) are those of the individual sender, except where the sender expressly, and with authority, states them to be the views of Saravana Graphics.</p>
            </div>
        </div>
        `;

        const mailOptions = {
            from: fromEmail,
            to: toEmail,
            subject: `Account Created - Saravana Graphics Connect`,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = sendAccountCreationEmail;
