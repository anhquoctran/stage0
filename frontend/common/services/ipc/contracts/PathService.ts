/** Paths retain the host OS semantics, including drive roots and UNC paths. */
export interface PathService {
  homeDirectory(): Promise<string>;
  isAbsolute(path: string): Promise<boolean>;
  join(...parts: string[]): Promise<string>;
}
