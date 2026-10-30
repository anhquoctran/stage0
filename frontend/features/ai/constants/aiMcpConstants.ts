import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

export const openUrlInBrowser = async (url: string) => {
  if (getApplicationServices().platform.capabilities.externalLinks) {
    try {
      await getApplicationServices().externalLinks.openExternalUrl({ url });
      return;
    } catch {
      // fallback
    }
  }
  window.open(url, '_blank');
};

