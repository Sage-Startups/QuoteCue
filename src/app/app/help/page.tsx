import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionForPage } from "@/lib/auth";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getMarketingSection } from "@/lib/config/marketing-content";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help" };

const GUIDES = [
  { title: "Create a quote from a customer message", body: "Go to New quote, choose or create the customer, paste the message into the enquiry step and run the AI analysis. Review each suggestion, confirm quantities, then price the work from your catalogue." },
  { title: "Record a voice note on site", body: "In the enquiry step tap Record, speak your notes and stop. The recording is transcribed and added to the analysis. You can also upload MP3, WAV, M4A or WebM files." },
  { title: "Add photographs from your phone", body: "Tap Add photos on the enquiry step; on a phone you can open the camera directly. Photos are described with clear caveats: AI never claims a photo proves hidden conditions or compliance." },
  { title: "Match work to your rates", body: "AI suggestions are matched to your service catalogue. Anything without a match is flagged as unpriced until you pick a catalogue item or enter a price. Update rates under Service catalogue." },
  { title: "Send and track", body: "From the review step download the PDF, email the quote or copy the secure link. You are notified when the customer opens, accepts or declines. Expired quotes can be reactivated from the quote page." },
  { title: "Revisions and accepted quotes", body: "Accepted versions are locked and preserved. Create a revision to make changes; the customer sees the latest version and the acceptance record is kept." },
  { title: "Manage AI generations", body: "Each successful analysis or wording generation uses one AI generation. Regenerating a single section, transcription and failed runs are free. Buy extra credits or upgrade under Billing." },
];

export default async function HelpPage() {
  await requireSessionForPage("/app/help");
  const [settings, faq] = await Promise.all([getSiteSettings(), getMarketingSection("faq")]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Help" description={`Guides and answers. Need more? Email ${settings["branding.supportEmail"]}.`} />
      <div className="grid gap-4 md:grid-cols-2">
        {GUIDES.map((g) => (
          <Card key={g.title}>
            <CardHeader>
              <CardTitle>{g.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{g.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Frequently asked questions</CardTitle>
          <CardDescription>
            Also available on the{" "}
            <Link href="/faq" className="underline">
              public FAQ page
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {faq.items.map((item) => (
              <details key={item.question} className="group py-3">
                <summary className="cursor-pointer list-none font-medium marker:content-none">{item.question}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contact support</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            Email{" "}
            <a href={`mailto:${settings["branding.supportEmail"]}`} className="font-semibold underline">
              {settings["branding.supportEmail"]}
            </a>{" "}
            with your quote number if it relates to a specific quote. Pro workspaces receive priority responses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
