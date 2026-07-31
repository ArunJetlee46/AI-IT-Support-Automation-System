import nodemailer from 'nodemailer';

interface TicketEmailPayload {
  to: string;
  name?: string;
  ticketId: string;
  title: string;
  category?: string;
  priority?: string;
  status?: string;
  message?: string;
}

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;

const transporter =
  smtpHost && smtpUser && smtpPass
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })
    : null;

const isEmailEnabled = () => Boolean(transporter && smtpFrom);

const sendEmail = async (to: string, subject: string, text: string) => {
  if (!isEmailEnabled()) {
    return;
  }

  try {
    await transporter!.sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
    });
  } catch {
    console.error('Failed to send email notification');
  }
};

export const notifyTicketCreated = async (payload: TicketEmailPayload) => {
  await sendEmail(
    payload.to,
    `Ticket ${payload.ticketId} created`,
    `Hello ${payload.name || 'User'},\n\nYour ticket has been created.\n\nTicket ID: ${payload.ticketId}\nTitle: ${payload.title}\nCategory: ${payload.category || 'Other'}\nPriority: ${payload.priority || 'Medium'}\n\nThank you.`
  );
};

export const notifyTicketStatusChanged = async (payload: TicketEmailPayload) => {
  await sendEmail(
    payload.to,
    `Ticket ${payload.ticketId} status updated`,
    `Hello ${payload.name || 'User'},\n\nTicket ${payload.ticketId} is now marked as ${payload.status}.\n\nTitle: ${payload.title}\n\n${payload.message || ''}`
  );
};

export const notifyTicketAssigned = async (payload: TicketEmailPayload) => {
  await sendEmail(
    payload.to,
    `Ticket ${payload.ticketId} assigned to you`,
    `Hello ${payload.name || 'Agent'},\n\nA ticket has been assigned to you.\n\nTicket ID: ${payload.ticketId}\nTitle: ${payload.title}\nPriority: ${payload.priority || 'Medium'}\nCategory: ${payload.category || 'Other'}\n\nPlease review it in the dashboard.`
  );
};

export const notifyTicketCommentAdded = async (payload: TicketEmailPayload) => {
  await sendEmail(
    payload.to,
    `New comment on ${payload.ticketId}`,
    `Hello ${payload.name || 'User'},\n\nA new comment was added to ticket ${payload.ticketId}.\n\nTitle: ${payload.title}\n\nComment:\n${payload.message || ''}`
  );
};

export const notifyITTeamOnNewTicket = async (ticketId: string, title: string, category: string, priority: string) => {
  const teamRecipients = (process.env.IT_TEAM_EMAILS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (teamRecipients.length === 0) {
    return;
  }

  await Promise.allSettled(
    teamRecipients.map((recipient) =>
      sendEmail(
        recipient,
        `New support ticket ${ticketId}`,
        `A new ticket has been created.\n\nTicket ID: ${ticketId}\nTitle: ${title}\nCategory: ${category}\nPriority: ${priority}`
      )
    )
  );
};
