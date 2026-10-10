export interface GitGraphCommit {
    hash: string;
    short_hash: string;
    parents: string[];
    subject: string;
    author_name: string;
    author_email: string;
    authored_date: string;
    refs: string[];
}
