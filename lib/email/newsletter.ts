import { prisma } from "@/lib/db/prisma";
import { resend, resolveSenderFrom } from "@/lib/email/client";
import { NewsletterEmail } from "@/lib/email/templates/newsletter";
import { siteUrl } from "@/lib/seo/site";

export interface SendNewsletterArgs {
  subject: string;
  bodyMarkdown: string;
}

export interface SendNewsletterResult {
  recipientCount: number;
  successCount: number;
  failureCount: number;
  newsletterSendId: string;
}

// Sends a newsletter to every guest with marketingOptIn=true and a
// non-empty unsubscribeToken. Sends are sequential so a single Resend
// hiccup doesn't fail the rest — the audit row records aggregate
// success/failure counts. Per-recipient delivery is tracked by Resend.
//
// We deliberately allocate a token before sending if one is missing:
// guest could have been seeded or imported without one, and a
// missing-token email would be undeliverable as marketing without
// the unsubscribe footer.
export async function sendNewsletter(args: SendNewsletterArgs): Promise<SendNewsletterResult> {
  const recipients = await prisma.guest.findMany({
    where: { marketingOptIn: true },
    select: { id: true, email: true, firstName: true, unsubscribeToken: true },
  });

  let successCount = 0;
  let failureCount = 0;
  const from = await resolveSenderFrom();
  const baseUrl = siteUrl();

  for (const guest of recipients) {
    let token = guest.unsubscribeToken;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      await prisma.guest
        .update({
          where: { id: guest.id },
          data: { unsubscribeToken: token },
        })
        .catch((err) => {
          console.error(`[newsletter] could not allocate token for ${guest.email}:`, err);
        });
    }

    const unsubscribeUrl = `${baseUrl}/unsubscribe?t=${token}`;

    try {
      const { error } = await resend.emails.send({
        from,
        to: guest.email,
        subject: args.subject,
        // List-Unsubscribe: standardised one-click unsubscribe header
        // recognised by Gmail / Apple / Outlook. Lets users unsubscribe
        // from inside the email client without round-tripping our site.
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        react: NewsletterEmail({
          subject: args.subject,
          bodyMarkdown: args.bodyMarkdown,
          unsubscribeUrl,
        }),
      });
      if (error) {
        console.error(`[newsletter] Resend rejected for ${guest.email}:`, error);
        failureCount += 1;
      } else {
        successCount += 1;
      }
    } catch (err) {
      console.error(`[newsletter] failed to send to ${guest.email}:`, err);
      failureCount += 1;
    }
  }

  const send = await prisma.newsletterSend.create({
    data: {
      subject: args.subject,
      bodyMarkdown: args.bodyMarkdown,
      recipientCount: recipients.length,
      successCount,
      failureCount,
    },
  });

  return {
    recipientCount: recipients.length,
    successCount,
    failureCount,
    newsletterSendId: send.id,
  };
}
