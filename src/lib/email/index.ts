export { sendEmail, resolveEmailTemplate } from "./send";
export type { SendEmailOptions, SendEmailOutcome } from "./send";
export { DEFAULT_EMAIL_TEMPLATES, EMAIL_KINDS } from "./templates";
export { renderEmailHtml, renderEmailText, substituteVariables, findUnsupportedVariables, extractTemplateVariables } from "./render";
export { getEmailProvider, setEmailProvider } from "./providers";
