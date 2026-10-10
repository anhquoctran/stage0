export interface CommitMessageSearchResult {
    query: string;
    caseSensitive: boolean;
    hashes: Set<string>;
}
