import type { MrDiffPayload } from '../../git/types/MrDiffPayload';
import type { NewMrDraft } from '../types/NewMrDraft';

export function createNewMrDescriptionDraft(
  draftMr: NewMrDraft,
  diffPayload: MrDiffPayload | null
) {
  const commitList =
    draftMr.commits && draftMr.commits.length > 0
      ? draftMr.commits.map((c) => `- ${c.subject} (\`${c.shortHash}\`)`).join('\n')
      : diffPayload?.files && diffPayload.files.length > 0
        ? diffPayload.files
            .slice(0, 8)
            .map((f) => `- Modified \`${f.path}\``)
            .join('\n')
        : '- Ongoing branch changes';

  const fileList =
    diffPayload?.files && diffPayload.files.length > 0
      ? diffPayload.files
          .slice(0, 10)
          .map((f) => `- \`${f.path}\` (${(f.status || 'MODIFIED').toLowerCase()})`)
          .join('\n')
      : '';
  const totalFiles = diffPayload?.files?.length || 0;
  const moreFiles = totalFiles > 10 ? `\n- ...and ${totalFiles - 10} more files` : '';

  const draft = `## Summary\nAutomated virtual merge request for \`${draftMr.compareBranch}\` into \`${draftMr.baseBranch}\`.\n\n### Key Changes\n${commitList}${fileList ? `\n\n### Changed Files (${totalFiles})\n${fileList}${moreFiles}` : ''}\n\n### Testing & Verification\n- [ ] Virtual mergeability verified\n- [ ] Local build & tests pass\n- [ ] AI bot reviews completed\n`;

  return draft;
}
