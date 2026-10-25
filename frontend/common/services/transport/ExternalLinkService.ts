/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface ExternalLinkService {
  openExternalUrl(input: {
    url: string;
  }): Promise<unknown>;
}
