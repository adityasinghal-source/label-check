// Every message the user can see when something goes wrong, in one place.
export const MESSAGES = {
  pasteLabel: "Please paste your label text.",
  notALabel: "This doesn't look like product label text. Please paste your label text.",
  tooLong: "That's too long for one label. Paste just the label text.",
  imageUnreadable: "We couldn't read that. Please paste your label text.",
  uploadRules: "Upload up to 3 files: PNG, JPG, WebP or PDF, up to 10 MB each.",
  chooseMarket: "Please choose a market.",
  pasteRejection: "Please paste the rejection message you received.",
  notARejection: "This doesn't look like a rejection or compliance notice. Paste the message you received.",
  rejectionIgnored: "The rejection box doesn't look like a rejection message, so only your label was checked.",
  addLabelToConfirm: "Paste your label text too, to confirm which parts of the label caused the rejection.",
  checkerFailed: "The checker couldn't run. Please try again.",
  missingKey:
    "The checker isn't set up yet. Add your OpenRouter API key to .env.local, then restart the app.",
};

export function noIssuesHeading(version: string) {
  return `No issues found against rule pack v${version}`;
}
