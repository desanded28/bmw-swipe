import type { Client, InArgs, InStatement, Transaction, TransactionMode } from "@libsql/client";

/**
 * Serialise writes to a local SQLite file.
 *
 * The local libsql client runs every statement synchronously and gives each
 * transaction its own connection. Two writers in the same Node process would
 * therefore fail instantly with SQLITE_BUSY (a busy timeout doesn't help: the
 * waiting connection blocks the event loop the lock holder needs to finish).
 *
 * This wrapper queues write statements and whole transactions behind an async
 * mutex. Reads are untouched — with WAL they never block or get blocked.
 *
 * Rule that follows: inside a db.transaction() callback, write through `tx`,
 * never through the root `db` (it would wait for the transaction to finish).
 */

class Mutex {
  #tail: Promise<void> = Promise.resolve();

  lock(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const acquired = this.#tail.then(() => release);
    this.#tail = this.#tail.then(() => next);
    return acquired;
  }
}

const WRITE = /^\s*(insert|update|delete|replace|create|drop|alter|pragma|vacuum|reindex|with\b[\s\S]*\b(insert|update|delete)\b)/i;

function sqlOf(stmt: InStatement): string {
  return typeof stmt === "string" ? stmt : stmt.sql;
}

function bindAll<T extends object>(target: T, overrides: Partial<Record<keyof T, unknown>>): T {
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop in overrides) return overrides[prop as keyof T];
      const value = Reflect.get(t, prop, receiver);
      return typeof value === "function" ? value.bind(t) : value;
    },
  });
}

export function serializeWrites(client: Client): Client {
  const mutex = new Mutex();
  const guarded =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const release = await mutex.lock();
      try {
        return await fn(...args);
      } finally {
        release();
      }
    };

  const wrapTransaction = (tx: Transaction, release: () => void): Transaction => {
    let released = false;
    const done = () => {
      if (!released) {
        released = true;
        release();
      }
    };
    return bindAll(tx, {
      commit: async () => {
        try {
          return await tx.commit();
        } finally {
          done();
        }
      },
      rollback: async () => {
        try {
          return await tx.rollback();
        } finally {
          done();
        }
      },
      close: () => {
        try {
          return tx.close();
        } finally {
          done();
        }
      },
    });
  };

  return bindAll(client, {
    execute: (async (stmt: InStatement, args?: InArgs) => {
      const call = () => (args === undefined ? client.execute(stmt) : client.execute(sqlOf(stmt), args));
      return WRITE.test(sqlOf(stmt)) ? guarded(call)() : call();
    }) as Client["execute"],
    batch: guarded(client.batch.bind(client)) as Client["batch"],
    migrate: guarded(client.migrate.bind(client)) as Client["migrate"],
    executeMultiple: guarded(client.executeMultiple.bind(client)),
    transaction: (async (mode?: TransactionMode) => {
      const release = await mutex.lock();
      try {
        return wrapTransaction(await client.transaction(mode), release);
      } catch (err) {
        release();
        throw err;
      }
    }) as Client["transaction"],
  });
}
