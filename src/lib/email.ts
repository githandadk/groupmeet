import nodemailer from 'nodemailer';
import { generateICS } from './utils';

const transporter = nodemailer.createTransport({
  host: 'mail.smtp2go.com',
  port: 2525,
  secure: false,
  auth: {
    user: process.env.SMTP2GO_USERNAME || '',
    pass: process.env.SMTP2GO_PASSWORD || '',
  },
});

const FROM_EMAIL = process.env.SMTP2GO_FROM_EMAIL || 'noreply@groupmeet.app';
const FROM_NAME = 'GroupMeet';

export async function sendNewResponseEmail(
  organizerEmail: string,
  eventName: string,
  participantName: string,
  eventSlug: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  await transporter.sendMail({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: organizerEmail,
    subject: `New response for "${eventName}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1f2937;">${eventName}</h2>
        <p style="color: #6b7280;"><strong>${participantName}</strong> just submitted their availability.</p>
        <a href="${appUrl}/event/${eventSlug}/results"
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          View Results
        </a>
      </div>
    `,
  });
}

export async function sendTimeSelectedEmail(
  recipientEmail: string,
  eventName: string,
  description: string | null,
  slotStart: string,
  slotEnd: string
) {
  const startDate = new Date(slotStart);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const icsContent = generateICS(eventName, description, slotStart, slotEnd);

  await transporter.sendMail({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: recipientEmail,
    subject: `Time selected for "${eventName}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1f2937;">${eventName}</h2>
        <p style="color: #6b7280;">A time has been selected!</p>
        <div style="background: #ecfdf5; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="color: #166534; font-weight: bold; margin: 0;">${formattedDate}</p>
          <p style="color: #166534; margin: 4px 0 0 0;">${formattedTime}</p>
        </div>
        <p style="color: #9ca3af; font-size: 14px;">
          An .ics calendar file is attached. Open it to add this event to your calendar.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `${eventName.replace(/\s+/g, '-').toLowerCase()}.ics`,
        content: icsContent,
        contentType: 'text/calendar',
      },
    ],
  });
}
