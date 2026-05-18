import type { ExperimentDesign } from "../design";

export interface ResultFileInfo {
  filename: string;
  size: number;
  mtime: string;
  sha256?: string;
  participantId?: string;
  deletedAt?: string | null;
}

export interface StoredResult {
  content: string;
  contentType: string;
}

export interface PutResult {
  filename: string;
  sha256: string;
  receivedAt: string;
  duplicated: boolean;
}

export interface DesignStore {
  list(): Promise<ExperimentDesign[]>;
  get(id: string): Promise<ExperimentDesign | null>;
  put(id: string, design: ExperimentDesign): Promise<ExperimentDesign>;
  delete(id: string): Promise<boolean>;
}

export interface ResultsStore {
  put(args: {
    experimentId: string;
    participantId: string;
    idempotencyKey: string | null;
    payload: string;
    sha256: string;
  }): Promise<PutResult>;
  list(experimentId: string): Promise<ResultFileInfo[]>;
  get(experimentId: string, filename: string): Promise<StoredResult | null>;
  softDelete?(experimentId: string, filename: string): Promise<boolean>;
}

export interface SecretsStore {
  getOrCreateAdminSecret(): Promise<string>;
}

export interface Backend {
  readonly name: string;
  designs: DesignStore;
  results: ResultsStore;
  secrets: SecretsStore;
}
