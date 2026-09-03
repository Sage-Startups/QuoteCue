"use server";

import { z } from "zod";
import { getSiteSettings } from "@/lib/config/site-settings";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/utils/request";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/utils/result";
import { hashIp } from "@/lib/utils/tokens";
import { zodFieldErrors } from "@/lib/utils/zod-form";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120, "Name is too long."),
  email: z.email("Please enter a valid email address.").trim().max(200, "Email is too long."),
  company: z.string().trim().max(120, "Company name is too long.").optional().or(z.literal("")),
  message: z.string().trim().min(10, "Please tell us a little more (at least 10 characters).").max(4000, "Message is too long (4,000 characters maximum)."),
});

const SUCCESS_MESSAGE = "Thanks for getting in touch. We will reply by email as soon as we can.";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitContactAction(_previous: ActionResult<undefined> | null, formData: FormData): Promise<ActionResult<undefined>> {
  // Honeypot: real visitors never see or fill this field. Respond as if
  // successful so bots learn nothing.
  if (field(formData, "website").length > 0) return ok(undefined, SUCCESS_MESSAGE);

  const parsed = contactSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    company: field(formData, "company"),
    message: field(formData, "message"),
  });
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));

  const ip = await getClientIp();
  try {
    await enforceRateLimit("contactForm", ip ?? "unknown");
  } catch (error) {
    return fail(toUserMessage(error, "Too many messages. Please wait a few minutes and try again."));
  }

  const { name, email, company, message } = parsed.data;
  try {
    await prisma.contactSubmission.create({
      data: { name, email, company: company ? company : null, message, ipHash: hashIp(ip) },
    });
  } catch {
    return fail("We could not save your message. Please try again or email us directly.");
  }

  try {
    const settings = await getSiteSettings();
    await sendEmail({
      kind: "CONTACT_RECEIPT",
      to: settings["branding.supportEmail"],
      variables: { name, email, message },
      metadata: { company: company || null },
    });
  } catch {
    // The submission is stored and visible to admins even if the receipt fails.
  }

  return ok(undefined, SUCCESS_MESSAGE);
}
