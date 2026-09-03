import { Resend } from "resend";
import { getEnv } from "@/lib/env";

export interface OutgoingEmail {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  status: "SENT" | "PREVIEW" | "FAILED";
  providerMessageId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly name: "resend" | "preview";
  send(email: OutgoingEmail): Promise<EmailSendResult>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(email: OutgoingEmail): Promise<EmailSendResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: email.from,
        to: [email.to],
        replyTo: email.replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (error) return { status: "FAILED", error: error.message };
      return { status: "SENT", providerMessageId: data?.id };
    } catch (error) {
      return { status: "FAILED", error: (error as Error).message };
    }
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const { error } = await this.client.domains.list();
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "Resend API reachable" };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }
}

/**
 * Development preview provider. Nothing is delivered; the rendered email is
 * stored in the EmailEvent table with status PREVIEW so it can be inspected at
 * /app/dev/emails. This provider is refused in production.
 */
export class PreviewEmailProvider implements EmailProvider {
  readonly name = "preview" as const;

  async send(_email: OutgoingEmail): Promise<EmailSendResult> {
    return { status: "PREVIEW" };
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: "Email preview mode: RESEND_API_KEY is not configured, nothing is delivered." };
  }
}

const globalRef = globalThis as unknown as { __emailProvider?: EmailProvider };

export function getEmailProvider(): EmailProvider {
  if (globalRef.__emailProvider) return globalRef.__emailProvider;
  const env = getEnv();
  const provider: EmailProvider = env.RESEND_API_KEY ? new ResendEmailProvider(env.RESEND_API_KEY) : new PreviewEmailProvider();
  globalRef.__emailProvider = provider;
  return provider;
}

export function setEmailProvider(provider: EmailProvider | undefined): void {
  globalRef.__emailProvider = provider;
}
