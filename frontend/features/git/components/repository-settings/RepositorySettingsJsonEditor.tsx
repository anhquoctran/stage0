import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PreferencesJsonEditor } from '../../../preferences/components/PreferencesJsonEditor';
import type { JsonEditorDocumentAdapter } from '../../../preferences/types/JsonEditorDocumentAdapter';
import { loadRepositorySettings, saveRepositorySettingsSource } from '../../../virtual-mr/services/repositorySettingsDocuments';
import type { RepositorySettingsDocument } from '../../../virtual-mr/types/RepositorySettingsDocument';

export function RepositorySettingsJsonEditor({ repoId, repoPath, onClose }: {
  repoId: string; repoPath: string; onClose: () => void;
}) {
  const { t } = useTranslation();
  const adapter = useMemo<JsonEditorDocumentAdapter>(() => {
    const display = (doc: RepositorySettingsDocument) => ({ ...doc,
      path: `${repoPath.replace(/[\\/]+$/, '')}/.stage0/repos.json`,
    });
    return {
      load: async () => display(await loadRepositorySettings(repoId)),
      saveText: async (content, revision) => display(await saveRepositorySettingsSource(repoId, content, revision)),
    };
  }, [repoId, repoPath]);
  return <PreferencesJsonEditor adapter={adapter} onClose={onClose}
    description={t('git.repoSettingsModal.editorDescription')} conflictMessage={t('git.repoSettingsModal.fileConflict')}
    title={t('git.repoSettingsModal.editorTitle')} />;
}
