import { parseTrainingCsv, type ImportOptions } from "./training-import";
// Parse locally off the UI thread and send progress or a validation error to the wizard.
self.onmessage = (event: MessageEvent<{ text: string; options: ImportOptions }>) => {
  try {
    const workouts = parseTrainingCsv(event.data.text, event.data.options, (rows) =>
      self.postMessage({ progress: rows }),
    );
    self.postMessage({ workouts });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
