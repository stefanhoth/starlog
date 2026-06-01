import { storiesStore } from './stories';
import { jobProfilesStore } from './jobProfiles';
import { settingsStore } from './settings';

export async function initStores(): Promise<void> {
  await Promise.all([
    storiesStore.init(),
    jobProfilesStore.init(),
    settingsStore.init(),
  ]);
}
