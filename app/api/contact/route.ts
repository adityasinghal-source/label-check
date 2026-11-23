import nodemailer from "nodemailer";

export const maxDuration = 30;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const br = (s: string) => esc(s).split(String.fromCharCode(10)).join("<br>");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Saves a contact-form submission to Supabase (insert-only via RLS), then emails the owner and the sender.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!name || !message || !EMAIL.test(email)) {
    return Response.json({ ok: false, error: "Please fill in your name, a valid email and a message." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: "Server is missing Supabase settings." }, { status: 500 });

  const res = await fetch(`${url}/rest/v1/contact_messages`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ name, email, message }),
  });
  if (!res.ok) {
    console.error("Supabase insert failed:", res.status, await res.text());
    return Response.json({ ok: false, error: "Could not save your message. Please try again." }, { status: 502 });
  }

  // The row is saved; email problems are reported but don't lose the message.
  // With GMAIL_* set, mail goes through Gmail. Otherwise it goes to a throwaway Ethereal test inbox
  // (no real delivery) and the preview links are returned so the emails can be shown.
  try {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    let transport: ReturnType<typeof nodemailer.createTransport>;
    let from: string;
    const test = !gmailUser || !gmailPass;
    if (test) {
      const acct = await nodemailer.createTestAccount();
      transport = nodemailer.createTransport({ host: acct.smtp.host, port: acct.smtp.port, secure: acct.smtp.secure, auth: { user: acct.user, pass: acct.pass } });
      from = acct.user;
    } else {
      transport = nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailPass.split(" ").join("") } });
      from = gmailUser;
    }
    const owner = process.env.OWNER_EMAIL || from;
    const [ownerMail, ackMail] = await Promise.all([
      transport.sendMail({
        from: `ShelfReady <${from}>`,
        to: owner,
        replyTo: email,
        subject: `New ShelfReady question from ${name}`,
        html: `<p><b>${esc(name)}</b> (${esc(email)}) wrote:</p><p>${br(message)}</p>`,
      }),
      transport.sendMail({
        from: `ShelfReady <${from}>`,
        to: email,
        subject: "Thanks for contacting ShelfReady",
        html: `<p>Hi ${esc(name)},</p><p>Thanks for your question. We received it and will reply soon.</p><p>Your message:</p><blockquote>${br(message)}</blockquote><p>The ShelfReady team</p>`,
      }),
    ]);
    return Response.json({
      ok: true,
      emailed: true,
      testInbox: test,
      previews: test ? { owner: nodemailer.getTestMessageUrl(ownerMail), reply: nodemailer.getTestMessageUrl(ackMail) } : undefined,
    });
  } catch (error) {
    console.error("Email failed:", error);
    return Response.json({ ok: true, emailed: false });
  }
}
