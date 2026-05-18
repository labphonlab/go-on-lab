import "server-only";
import crypto from "node:crypto";
import { type ExperimentDesign, isValidDesignId } from "../design";
import type {
  Backend,
  DesignStore,
  PutResult,
  ResultFileInfo,
  ResultsStore,
  SecretsStore,
  StoredResult,
} from "./types";

type Firestore = import("@google-cloud/firestore").Firestore;

let cachedFirestore: Firestore | null = null;

async function getFirestore(): Promise<Firestore> {
  if (cachedFirestore) return cachedFirestore;
  const mod = await import("@google-cloud/firestore");
  const Ctor = mod.Firestore;
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIRESTORE_PROJECT_ID;
  const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
  const firestore = new Ctor({
    ...(projectId ? { projectId } : {}),
    ...(databaseId !== "(default)" ? { databaseId } : {}),
    ignoreUndefinedProperties: true,
  });
  cachedFirestore = firestore as unknown as Firestore;
  return cachedFirestore;
}

function collectionPrefix(): string {
  return process.env.FIRESTORE_COLLECTION_PREFIX || "go_on_lab_";
}

function designsCol(): string {
  return `${collectionPrefix()}designs`;
}

function resultsCol(experimentId: string): string {
  return `${collectionPrefix()}results__${experimentId}`;
}

function secretsCol(): string {
  return `${collectionPrefix()}secrets`;
}

class FirestoreDesignStore implements DesignStore {
  async list(): Promise<ExperimentDesign[]> {
    const db = await getFirestore();
    const snap = await db
      .collection(designsCol())
      .orderBy("updatedAt", "desc")
      .get();
    return snap.docs.map((d) => d.data() as ExperimentDesign);
  }
  async get(id: string): Promise<ExperimentDesign | null> {
    if (!isValidDesignId(id)) return null;
    const db = await getFirestore();
    const doc = await db.collection(designsCol()).doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as ExperimentDesign;
  }
  async put(id: string, design: ExperimentDesign): Promise<ExperimentDesign> {
    if (!isValidDesignId(id)) throw new Error("invalid id");
    const db = await getFirestore();
    await db.collection(designsCol()).doc(id).set(design, { merge: false });
    return design;
  }
  async delete(id: string): Promise<boolean> {
    if (!isValidDesignId(id)) return false;
    const db = await getFirestore();
    const doc = db.collection(designsCol()).doc(id);
    const snap = await doc.get();
    if (!snap.exists) return false;
    await doc.delete();
    return true;
  }
}

class FirestoreResultsStore implements ResultsStore {
  async put(args: {
    experimentId: string;
    participantId: string;
    idempotencyKey: string | null;
    payload: string;
    sha256: string;
  }): Promise<PutResult> {
    if (!isValidDesignId(args.experimentId))
      throw new Error("invalid experiment id");
    const db = await getFirestore();
    const col = db.collection(resultsCol(args.experimentId));
    const receivedAt = new Date().toISOString();

    if (args.idempotencyKey) {
      const existing = await col
        .where("idempotencyKey", "==", args.idempotencyKey)
        .limit(1)
        .get();
      if (!existing.empty) {
        const doc = existing.docs[0];
        const data = doc.data() as { sha256: string; receivedAt: string };
        return {
          filename: doc.id,
          sha256: data.sha256,
          receivedAt: data.receivedAt,
          duplicated: true,
        };
      }
    }

    const safePid = args.participantId.replace(/[^A-Z0-9-]/g, "_");
    const stamp = receivedAt.replace(/[:.]/g, "-");
    const docId = `${safePid}__${stamp}__${args.sha256.slice(0, 8)}`;

    let payloadObj: unknown;
    try {
      payloadObj = JSON.parse(args.payload);
    } catch {
      payloadObj = {};
    }

    await col.doc(docId).create({
      payload: payloadObj,
      participantId: args.participantId,
      experimentId: args.experimentId,
      idempotencyKey: args.idempotencyKey,
      sha256: args.sha256,
      receivedAt,
      size: Buffer.byteLength(args.payload, "utf8"),
      deletedAt: null,
    });

    return {
      filename: docId,
      sha256: args.sha256,
      receivedAt,
      duplicated: false,
    };
  }

  async list(experimentId: string): Promise<ResultFileInfo[]> {
    if (!isValidDesignId(experimentId)) return [];
    const db = await getFirestore();
    const snap = await db
      .collection(resultsCol(experimentId))
      .where("deletedAt", "==", null)
      .orderBy("receivedAt", "desc")
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as {
        sha256?: string;
        receivedAt?: string;
        size?: number;
        participantId?: string;
        deletedAt?: string | null;
      };
      return {
        filename: d.id,
        size: typeof data.size === "number" ? data.size : 0,
        mtime: typeof data.receivedAt === "string" ? data.receivedAt : "",
        sha256: data.sha256,
        participantId: data.participantId,
        deletedAt: data.deletedAt ?? null,
      };
    });
  }

  async get(experimentId: string, filename: string): Promise<StoredResult | null> {
    if (!isValidDesignId(experimentId)) return null;
    if (!/^[A-Z0-9_.-]+$/i.test(filename)) return null;
    const db = await getFirestore();
    const doc = await db.collection(resultsCol(experimentId)).doc(filename).get();
    if (!doc.exists) return null;
    const data = doc.data() as { payload?: unknown };
    return {
      content: JSON.stringify(data.payload ?? {}),
      contentType: "application/json; charset=utf-8",
    };
  }

  async softDelete(experimentId: string, filename: string): Promise<boolean> {
    if (!isValidDesignId(experimentId)) return false;
    const db = await getFirestore();
    const ref = db.collection(resultsCol(experimentId)).doc(filename);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.update({ deletedAt: new Date().toISOString() });
    return true;
  }
}

class FirestoreSecretsStore implements SecretsStore {
  async getOrCreateAdminSecret(): Promise<string> {
    if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length >= 32) {
      return process.env.ADMIN_SECRET;
    }
    const db = await getFirestore();
    const ref = db.collection(secretsCol()).doc("admin");
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (doc.exists) {
        const v = doc.data()?.value;
        if (typeof v === "string" && v.length >= 32) return v;
      }
      const fresh = crypto.randomBytes(48).toString("hex");
      tx.set(ref, { value: fresh, createdAt: new Date().toISOString() });
      return fresh;
    });
  }
}

export class FirestoreBackend implements Backend {
  readonly name = "firestore";
  readonly designs = new FirestoreDesignStore();
  readonly results = new FirestoreResultsStore();
  readonly secrets = new FirestoreSecretsStore();
}
