//! Persistent, per-folder full-text search over extracted passages.

use std::collections::HashMap;
use std::fs::{self, Metadata};
use std::path::Path;
use std::time::SystemTime;

use rusqlite::{params, Connection, Transaction, TransactionBehavior};

use crate::folder_search::{passages, Doc, Excerpt, MAX_EXCERPTS};

const SCHEMA: &str = "
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY,
        root TEXT NOT NULL,
        rel_path TEXT NOT NULL,
        size INTEGER NOT NULL,
        mtime INTEGER,
        text TEXT,
        text_bytes INTEGER,
        read_limit INTEGER,
        cut INTEGER NOT NULL,
        UNIQUE(root, rel_path)
    );
    CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY,
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        rel_path TEXT NOT NULL,
        text TEXT NOT NULL,
        page_hint INTEGER
    );
    CREATE INDEX IF NOT EXISTS chunks_file ON chunks(file_id);
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        rel_path, text, content='chunks', content_rowid='id', tokenize='unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS chunks_insert AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, rel_path, text) VALUES (new.id, new.rel_path, new.text);
    END;
    CREATE TRIGGER IF NOT EXISTS chunks_delete AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, rel_path, text)
        VALUES ('delete', old.id, old.rel_path, old.text);
    END;
";

#[derive(Clone, Copy, PartialEq)]
pub struct Stamp {
    size: i64,
    mtime: Option<i64>,
}

impl Stamp {
    pub fn new(metadata: &Metadata) -> Self {
        let mtime = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
            .and_then(|duration| i64::try_from(duration.as_nanos()).ok());
        Self {
            size: i64::try_from(metadata.len()).unwrap_or(i64::MAX),
            mtime,
        }
    }
}

#[derive(Clone, Copy)]
pub struct IndexedFile {
    pub text_bytes: Option<u32>,
    pub cut: bool,
}

struct PreviousFile {
    stamp: Stamp,
    read_limit: Option<u32>,
    entry: IndexedFile,
}

pub struct FolderIndex<'a> {
    tx: Transaction<'a>,
    root: &'a str,
    previous: HashMap<String, PreviousFile>,
}

pub fn open(cache_dir: &Path) -> Result<Connection, String> {
    fs::create_dir_all(cache_dir).map_err(|err| err.to_string())?;
    let conn =
        Connection::open(cache_dir.join("folder_index.db")).map_err(|err| err.to_string())?;
    conn.execute_batch(SCHEMA).map_err(|err| err.to_string())?;
    Ok(conn)
}

impl<'a> FolderIndex<'a> {
    pub fn begin(conn: &'a mut Connection, root: &'a str) -> rusqlite::Result<Self> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let previous = {
            let mut stmt = tx.prepare(
                "SELECT rel_path, size, mtime, text_bytes, read_limit, cut FROM files WHERE root = ?",
            )?;
            let rows = stmt.query_map([root], |row| {
                Ok((
                    row.get(0)?,
                    PreviousFile {
                        stamp: Stamp {
                            size: row.get(1)?,
                            mtime: row.get(2)?,
                        },
                        entry: IndexedFile {
                            text_bytes: row.get(3)?,
                            cut: row.get(5)?,
                        },
                        read_limit: row.get(4)?,
                    },
                ))
            })?;
            rows.collect::<Result<_, _>>()?
        };
        Ok(Self { tx, root, previous })
    }

    pub fn keep(
        &mut self,
        path: &str,
        stamp: Stamp,
        read_limit: Option<u32>,
    ) -> Option<IndexedFile> {
        let old = self.previous.get(path)?;
        let same_read = old.read_limit == read_limit
            || (!old.entry.cut
                && old.entry.text_bytes.is_some()
                && read_limit.is_some_and(|limit| stamp.size <= i64::from(limit)));
        if stamp.mtime.is_none() || old.stamp != stamp || !same_read {
            return None;
        }
        let entry = old.entry;
        self.previous.remove(path);
        Some(entry)
    }

    pub fn replace(
        &mut self,
        path: &str,
        stamp: Stamp,
        read_limit: Option<u32>,
        text: Option<&str>,
        cut: bool,
    ) -> rusqlite::Result<()> {
        if self.previous.remove(path).is_some() {
            self.tx.execute(
                "DELETE FROM files WHERE root = ? AND rel_path = ?",
                params![self.root, path],
            )?;
        }
        self.tx.execute(
            "INSERT INTO files(root, rel_path, size, mtime, text, text_bytes, read_limit, cut)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                self.root,
                path,
                stamp.size,
                stamp.mtime,
                text,
                text.map(|text| text.len() as u32),
                read_limit,
                cut
            ],
        )?;
        if let Some(text) = text {
            let id = self.tx.last_insert_rowid();
            let mut insert = self.tx.prepare_cached(
                "INSERT INTO chunks(file_id, rel_path, text, page_hint) VALUES (?, ?, ?, ?)",
            )?;
            for (text, page) in passages(path, text) {
                insert.execute(params![id, path, text, page])?;
            }
        }
        Ok(())
    }

    pub fn prune(&mut self) -> rusqlite::Result<()> {
        let mut delete = self
            .tx
            .prepare_cached("DELETE FROM files WHERE root = ? AND rel_path = ?")?;
        for path in self.previous.drain().map(|(path, _)| path) {
            delete.execute(params![self.root, path])?;
        }
        Ok(())
    }

    pub fn commit(self) -> rusqlite::Result<()> {
        self.tx.commit()
    }

    pub fn documents(&self) -> rusqlite::Result<Vec<Doc>> {
        let mut stmt = self.tx.prepare(
            "SELECT rel_path, text FROM files WHERE root = ? AND text IS NOT NULL ORDER BY rel_path",
        )?;
        let rows = stmt.query_map([self.root], |row| {
            Ok(Doc {
                path: row.get(0)?,
                text: row.get(1)?,
            })
        })?;
        rows.collect()
    }

    pub fn search(&self, terms: &[String], max_chars: usize) -> rusqlite::Result<Vec<Excerpt>> {
        // search_terms folds plurals. Match prefixes to find the original form
        // as well, and quote every term so user text cannot add FTS operators.
        // If the full query misses, the caller tries the partial-match ranker.
        let query = terms
            .iter()
            .filter(|term| !term.is_empty() && term.chars().all(char::is_alphanumeric))
            .take(32)
            .map(|term| format!("\"{}\"*", term.chars().take(64).collect::<String>()))
            .collect::<Vec<_>>()
            .join(" AND ");
        if query.is_empty() || max_chars == 0 {
            return Ok(Vec::new());
        }
        let mut stmt = self.tx.prepare(
            "SELECT c.rel_path, c.text, c.page_hint
             FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid
             JOIN files f ON f.id = c.file_id
             WHERE chunks_fts MATCH ? AND f.root = ?
             ORDER BY bm25(chunks_fts, 2.0, 1.0), c.id LIMIT 128",
        )?;
        let rows = stmt.query_map(params![query, self.root], |row| {
            Ok(Excerpt {
                path: row.get(0)?,
                text: row.get(1)?,
                page_hint: row.get(2)?,
            })
        })?;
        let mut excerpts = Vec::new();
        let mut remaining = max_chars;
        for row in rows {
            let mut excerpt = row?;
            let trimmed = excerpt.text.trim();
            let length = trimmed.chars().count();
            if length <= remaining {
                excerpt.text = trimmed.to_owned();
                excerpts.push(excerpt);
                remaining -= length;
                if excerpts.len() == MAX_EXCERPTS {
                    break;
                }
            }
        }
        Ok(excerpts)
    }
}
