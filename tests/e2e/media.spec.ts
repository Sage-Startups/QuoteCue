import { test, expect } from "@playwright/test";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { registerAndVerify, completeOnboarding, withDb } from "./helpers";

// A tiny real WAV so the upload carries decodable audio rather than random bytes.
function makeWav(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "qc-audio-"));
  const file = path.join(dir, "voice-note.wav");
  const sampleRate = 16000;
  const seconds = 1;
  const samples = sampleRate * seconds;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 8000), i * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
  return file;
}

function makeJpeg(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "qc-photo-"));
  const file = path.join(dir, "consumer-unit.jpg");
  execFileSync("node", ["-e", `require('sharp')({create:{width:900,height:600,channels:3,background:{r:40,g:60,b:90}}}).jpeg().toFile(${JSON.stringify(file)})`], { cwd: process.cwd() });
  return file;
}


/** Registers, onboards and opens a new quote at the enquiry step. Returns the quote URL. */
async function newQuoteAtEnquiry(page: import("@playwright/test").Page, who: string): Promise<string> {
  await registerAndVerify(page, who);
  await completeOnboarding(page, `${who} Ltd`);
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Create a new customer" }).click();
  await page.getByLabel("Contact name").fill("Dana Ruiz");
  await page.getByRole("button", { name: "Save customer" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL(/step=2/);
  return page.url();
}

test.describe("Quote media", () => {
  test.describe.configure({ mode: "serial" });
  let quoteUrl = "";

  test("photo and audio upload, transcription, and both reach the analysis", async ({ page }) => {
    quoteUrl = await newQuoteAtEnquiry(page, "Media Trader");

    // Photograph: the failure the user reported.
    await page.setInputFiles('input[type="file"][accept*="image"]:not([capture])', makeJpeg());
    await expect(page.getByRole("img", { name: /consumer-unit/i }).or(page.locator("figure img")).first()).toBeVisible({ timeout: 30_000 });

    // Audio file upload, which triggers transcription automatically.
    await page.setInputFiles('input[type="file"][accept*="audio"]', makeWav());
    await expect(page.getByLabel("Transcript")).toBeVisible({ timeout: 45_000 });
    const transcript = await page.getByLabel("Transcript").inputValue();
    expect(transcript.trim().length).toBeGreaterThan(0);

    await page.getByLabel("Enquiry").fill("Two double sockets in the living room and a light fitting swap.");
    await page.getByRole("button", { name: "Save and analyse" }).click();
    await page.waitForURL(/step=3/);
    await page.getByRole("button", { name: "Analyse with AI" }).click();
    await expect(page.getByRole("heading", { name: "Suggested work" })).toBeVisible({ timeout: 60_000 });

    // The stored objects must exist in the bucket, and the transcript on the quote.
    const quoteId = quoteUrl.match(/quotes\/([0-9a-f-]{36})/)![1];
    const rows = await withDb(async (db) => (await db.query<{ kind: string; transcript: string | null; objectKey: string }>(
      `SELECT m.kind, m.transcript, o."key" AS "objectKey" FROM "QuoteMedia" m JOIN "StoredObject" o ON o.id = m."storedObjectId" WHERE m."quoteId" = $1`,
      [quoteId],
    )).rows);
    expect(rows.map((r) => r.kind).sort()).toEqual(["AUDIO", "IMAGE"]);
    expect(rows.find((r) => r.kind === "AUDIO")?.transcript?.trim().length ?? 0).toBeGreaterThan(0);
    // Objects must live in the bucket under the expected prefixes.
    expect(rows.find((r) => r.kind === "IMAGE")?.objectKey).toContain("quotes/images/");
    expect(rows.find((r) => r.kind === "AUDIO")?.objectKey).toContain("quotes/audio/");
  });

  test("recording with the microphone produces an attachable voice note", async ({ page, context }) => {
    await context.grantPermissions(["microphone"]);
    quoteUrl = await newQuoteAtEnquiry(page, "Voice Trader");
    await page.getByRole("button", { name: "Record voice note" }).click();
    await expect(page.getByRole("button", { name: /Stop \(/ })).toBeVisible();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /Stop \(/ }).click();
    await expect(page.getByRole("button", { name: "Use this recording" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Use this recording" }).click();
    // A second transcript block appears once the recording is stored and transcribed.
    await expect(page.getByLabel("Transcript")).toBeVisible({ timeout: 45_000 });
    const quoteId = quoteUrl.match(/quotes\/([0-9a-f-]{36})/)![1];
    const audioCount = await withDb(async (db) => Number((await db.query(`SELECT COUNT(*) c FROM "QuoteMedia" WHERE kind = 'AUDIO' AND "quoteId" = $1`, [quoteId])).rows[0].c));
    expect(audioCount).toBe(1);
  });
});
