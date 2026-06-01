import { storiesStore } from './stories';
import { jobProfilesStore } from './jobProfiles';
import { settingsStore } from './settings';
import { initWhatsNew } from './whatsNew';

export async function initStores(): Promise<void> {
  await Promise.all([
    storiesStore.init(),
    jobProfilesStore.init(),
    settingsStore.init(),
  ]);
  // Non-blocking — badge updates when ready
  initWhatsNew();
}
