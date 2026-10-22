// Every message the user can see when something goes wrong, in one place.
export const MESSAGES = {
  pasteLabel: "Please paste your label text.",
  notALabel: "This doesn't look like product label text. Please paste your label text.",
  tooLong: "That's too long for one label. Paste just the label text.",
  imageUnreadable: "We couldn't read that. Please paste your label text.",
  choosePack: "Please choose a rule pack.",
  pasteRejection: "Please paste the rejection message you received.",
  notARejection: "This doesn't look like a rejection or compliance notice. Paste the message you received.",
  checkerFailed: "The checker couldn't run. Please try again.",
  missingKey:
    "The checker isn't set up yet. Add your OpenRouter API key to .env.local, then restart the app.",
};

export function noIssuesHeading(version: string) {
  return `No issues found against rule pack v${version}`;
}
