import {DatabaseSync} from 'node:sqlite';
import {mkdir,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export const SCHEMA_VERSION=1;
export async function openDatabase(dataDir,{recoverJobs=true}={}) {
  await mkdir(dataDir,{recursive:true,mode:0o700});
  const path=resolve(dataDir,'community.sqlite'),db=new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version>SCHEMA_VERSION) {db.close();throw new Error('This database was written by a newer server. No downgrade was attempted.');}
  db.exec(`
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      salt TEXT NOT NULL, hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player',
      restricted INTEGER NOT NULL DEFAULT 0, restriction_reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions(
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS items(
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
      creator TEXT NOT NULL, locked INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS versions(
      id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id), number INTEGER NOT NULL,
      name TEXT NOT NULL, description TEXT NOT NULL, genre TEXT NOT NULL, tags TEXT NOT NULL, creator TEXT NOT NULL, thumbnail TEXT NOT NULL DEFAULT '',
      rating TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'public', payload TEXT NOT NULL,
      hash TEXT NOT NULL, dependencies TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL, UNIQUE(item_id,number)
    );
    CREATE TABLE IF NOT EXISTS assets(
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), hash TEXT NOT NULL,
      mime TEXT NOT NULL, data TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS version_assets(
      version_id TEXT NOT NULL REFERENCES versions(id), asset_id TEXT NOT NULL REFERENCES assets(id),
      PRIMARY KEY(version_id,asset_id)
    );
    CREATE TABLE IF NOT EXISTS operations(
      user_id TEXT NOT NULL REFERENCES users(id), operation_id TEXT NOT NULL, request_hash TEXT NOT NULL,
      result TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,operation_id)
    );
    CREATE TABLE IF NOT EXISTS ratings(
      item_id TEXT NOT NULL REFERENCES items(id), user_id TEXT NOT NULL REFERENCES users(id),
      score INTEGER NOT NULL, comment TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL,
      PRIMARY KEY(item_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS reports(
      id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id), reporter_id TEXT NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL, details TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '',
      snapshot_hash TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'open', reply_draft TEXT NOT NULL DEFAULT '',
      reply_sent_at INTEGER, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit(
      id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), report_id TEXT REFERENCES reports(id),
      target TEXT NOT NULL, action TEXT NOT NULL, note TEXT NOT NULL, at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS provider_jobs(
      id TEXT PRIMARY KEY, actor_key TEXT NOT NULL, kind TEXT NOT NULL, request_hash TEXT NOT NULL,
      state TEXT NOT NULL, error TEXT, result TEXT, started_at INTEGER NOT NULL, completed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS versions_discovery ON versions(status,rating,created_at);
    CREATE INDEX IF NOT EXISTS versions_item ON versions(item_id,number DESC);
    CREATE INDEX IF NOT EXISTS reports_queue ON reports(state,created_at);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    PRAGMA user_version=1;
  `);
  await chmod(path,0o600).catch(()=>{});
  // Never replay a possibly successful model operation after an interrupted server session.
  if(recoverJobs)db.prepare("UPDATE provider_jobs SET state='interrupted-unknown',error='Server restarted before a conclusive response was recorded.' WHERE state='running'").run();
  return db;
}
export function transaction(db,work) {
  db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}
}
export function audit(db,actor,target,action,note='',reportId=null) {
  db.prepare('INSERT INTO audit(id,actor_id,report_id,target,action,note,at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),actor.id,reportId,target,action,note,Date.now());
}
export function userSummary(user) {return user?{id:user.id,username:user.username,role:user.role,restricted:!!user.restricted}:null;}
