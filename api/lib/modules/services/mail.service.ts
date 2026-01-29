import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, link: string) {
    const from = process.env.MAIL_FROM || 'Blog <onboarding@resend.dev>';

    await resend.emails.send({
        from,
        to,
        subject: 'Aktywuj konto',
        html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Aktywacja konta</h2>
        <p>Kliknij w link, aby aktywować konto:</p>
        <a href="${link}"></a>
        <p>Jeśli to nie Ty – zignoruj tę wiadomość.</p>
      </div>
    `,
    });
}
