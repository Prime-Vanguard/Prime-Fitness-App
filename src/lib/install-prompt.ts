export type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
let prompt: InstallEvent | undefined;
export const currentInstallPrompt = () => prompt;
export function rememberInstallPrompt(event: InstallEvent | undefined) {
  prompt = event;
  window.dispatchEvent(new Event("pf-install-prompt"));
}
