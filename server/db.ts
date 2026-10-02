import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

function getWritableDataDir(): string {
  // If explicitly on Vercel or serverless read-only environment
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = path.join('/tmp', 'imagelink_data');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
  }

  const standardDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(standardDir)) {
      fs.mkdirSync(standardDir, { recursive: true });
    }
    // Verify write permissions
    const testFile = path.join(standardDir, '.write_test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return standardDir;
  } catch {
    const fallbackDir = path.join('/tmp', 'imagelink_data');
    if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
    return fallbackDir;
  }
}

const DATA_DIR = getWritableDataDir();
const DB_PATH = path.join(DATA_DIR, 'imagelink.sqlite');

export interface ImageLinkRecord {
  id: number;
  shortId: string;
  originalFileName: string;
  imageUrl: string;
  processedImageUrl: string;
  destinationUrl: string;
  description: string;
  framingMode: 'crop_16_9' | 'full';
  createdAt: string;
  clickCount: number;
  status: 'active' | 'disabled';
  telegramUserId?: string | null;
  updatedAt?: string;
}

export interface ClickEventRecord {
  id: number;
  imageLinkId: number;
  timestamp: string;
  userAgent: string;
  referer: string;
}

export interface BotSession {
  user_id: string;
  step: 'IDLE' | 'AWAITING_IMAGE' | 'AWAITING_URL' | 'AWAITING_DESCRIPTION' | 'AWAITING_FRAMING';
  temp_data: {
    original_file_name?: string;
    temp_image_key?: string;
    telegram_file_id?: string;
    destination_url?: string;
    description?: string;
    framing_mode?: 'crop_16_9' | 'full';
  };
  updated_at: string;
}

class DatabaseService {
  private db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(DB_PATH);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ImageLinks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shortId TEXT UNIQUE NOT NULL,
        originalFileName TEXT DEFAULT '',
        imageUrl TEXT NOT NULL,
        processedImageUrl TEXT NOT NULL,
        destinationUrl TEXT NOT NULL,
        description TEXT NOT NULL,
        framingMode TEXT NOT NULL DEFAULT 'crop_16_9',
        createdAt TEXT NOT NULL,
        clickCount INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        telegramUserId TEXT,
        updatedAt TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_imagelinks_shortid ON ImageLinks(shortId);
      CREATE INDEX IF NOT EXISTS idx_imagelinks_createdat ON ImageLinks(createdAt);
      CREATE INDEX IF NOT EXISTS idx_imagelinks_status ON ImageLinks(status);
      CREATE INDEX IF NOT EXISTS idx_imagelinks_telegram ON ImageLinks(telegramUserId);

      CREATE TABLE IF NOT EXISTS ClickEvents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        imageLinkId INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        userAgent TEXT DEFAULT '',
        referer TEXT DEFAULT '',
        FOREIGN KEY (imageLinkId) REFERENCES ImageLinks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_clickevents_linkid ON ClickEvents(imageLinkId);
      CREATE INDEX IF NOT EXISTS idx_clickevents_timestamp ON ClickEvents(timestamp);

      CREATE TABLE IF NOT EXISTS bot_sessions (
        user_id TEXT PRIMARY KEY,
        step TEXT NOT NULL,
        temp_data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Ensure columns exist on older databases
    try {
      this.db.exec("ALTER TABLE ImageLinks ADD COLUMN reportCount INTEGER DEFAULT 0;");
    } catch {}
    try {
      this.db.exec("ALTER TABLE ImageLinks ADD COLUMN imageWidth INTEGER DEFAULT 1200;");
    } catch {}
    try {
      this.db.exec("ALTER TABLE ImageLinks ADD COLUMN imageHeight INTEGER DEFAULT 630;");
    } catch {}
  }

  // --- ImageLinks CRUD ---

  createImageLink(data: {
    shortId: string;
    originalFileName?: string;
    imageUrl: string;
    processedImageUrl: string;
    destinationUrl: string;
    description: string;
    framingMode?: 'crop_16_9' | 'full';
    telegramUserId?: string;
  }): ImageLinkRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO ImageLinks (
        shortId, originalFileName, imageUrl, processedImageUrl,
        destinationUrl, description, framingMode, createdAt,
        clickCount, status, telegramUserId, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)
    `);

    const result = stmt.run(
      data.shortId,
      data.originalFileName || '',
      data.imageUrl,
      data.processedImageUrl,
      data.destinationUrl,
      data.description,
      data.framingMode || 'crop_16_9',
      now,
      data.telegramUserId || null,
      now
    );

    const link = this.getLinkById(Number(result.lastInsertRowid));
    if (!link) throw new Error('Failed to retrieve newly created ImageLink');
    return link;
  }

  getLinkById(id: number): ImageLinkRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM ImageLinks WHERE id = ?');
    return stmt.get(id) as unknown as ImageLinkRecord | undefined;
  }

  getLinkByShortId(shortId: string): ImageLinkRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM ImageLinks WHERE shortId = ?');
    return stmt.get(shortId) as unknown as ImageLinkRecord | undefined;
  }

  getAllLinks(limit = 100, offset = 0): ImageLinkRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ImageLinks 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as unknown as ImageLinkRecord[];
  }

  getUserLinks(telegramUserId: string, limit = 50): ImageLinkRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ImageLinks 
      WHERE telegramUserId = ? 
      ORDER BY id DESC 
      LIMIT ?
    `);
    return stmt.all(telegramUserId, limit) as unknown as ImageLinkRecord[];
  }

  recordClick(linkId: number, shortId: string, metadata?: { userAgent?: string; referer?: string }) {
    const now = new Date().toISOString();
    // 1. Increment click counter
    const updateStmt = this.db.prepare(`
      UPDATE ImageLinks 
      SET clickCount = clickCount + 1, updatedAt = ? 
      WHERE id = ?
    `);
    updateStmt.run(now, linkId);

    // 2. Insert ClickEvent
    const eventStmt = this.db.prepare(`
      INSERT INTO ClickEvents (imageLinkId, timestamp, userAgent, referer)
      VALUES (?, ?, ?, ?)
    `);
    eventStmt.run(
      linkId,
      now,
      metadata?.userAgent || '',
      metadata?.referer || ''
    );
  }

  getLinkClickEvents(linkId: number, limit = 50): ClickEventRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ClickEvents 
      WHERE imageLinkId = ? 
      ORDER BY id DESC 
      LIMIT ?
    `);
    return stmt.all(linkId, limit) as unknown as ClickEventRecord[];
  }

  updateLinkStatus(id: number, status: 'active' | 'disabled'): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE ImageLinks 
      SET status = ?, updatedAt = ? 
      WHERE id = ?
    `);
    const res = stmt.run(status, now, id);
    return Number(res.changes) > 0;
  }

  deleteLink(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM ImageLinks WHERE id = ?');
    const res = stmt.run(id);
    return Number(res.changes) > 0;
  }

  reportLink(shortId: string): { success: boolean; disabled: boolean; reportCount: number } {
    const link = this.getLinkByShortId(shortId);
    if (!link) return { success: false, disabled: false, reportCount: 0 };

    const newReportCount = ((link as any).reportCount || 0) + 1;
    const shouldDisable = newReportCount >= 5;
    const newStatus = shouldDisable ? 'disabled' : link.status;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE ImageLinks 
      SET reportCount = ?, status = ?, updatedAt = ? 
      WHERE id = ?
    `);
    stmt.run(newReportCount, newStatus, now, link.id);
    return { success: true, disabled: shouldDisable, reportCount: newReportCount };
  }

  getOverallStats() {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as totalLinks, SUM(clickCount) as totalClicks FROM ImageLinks');
    const total = totalStmt.get() as { totalLinks: number; totalClicks: number };
    const activeStmt = this.db.prepare("SELECT COUNT(*) as activeLinks FROM ImageLinks WHERE status = 'active'");
    const active = activeStmt.get() as { activeLinks: number };
    const disabledStmt = this.db.prepare("SELECT COUNT(*) as disabledLinks FROM ImageLinks WHERE status = 'disabled'");
    const disabled = disabledStmt.get() as { disabledLinks: number };

    return {
      totalLinks: total?.totalLinks || 0,
      totalClicks: total?.totalClicks || 0,
      activeLinks: active?.activeLinks || 0,
      disabledLinks: disabled?.disabledLinks || 0
    };
  }

  getUserStats(telegramUserId: string) {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as totalLinks,
        SUM(clickCount) as totalClicks,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeLinks,
        SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) as disabledLinks
      FROM ImageLinks 
      WHERE telegramUserId = ?
    `);
    const res = stmt.get(telegramUserId) as {
      totalLinks: number;
      totalClicks: number;
      activeLinks: number;
      disabledLinks: number;
    };
    return {
      totalLinks: res?.totalLinks || 0,
      totalClicks: res?.totalClicks || 0,
      activeLinks: res?.activeLinks || 0,
      disabledLinks: res?.disabledLinks || 0
    };
  }

  // --- Bot Conversation Session Operations ---

  getSession(user_id: string): BotSession | null {
    const stmt = this.db.prepare('SELECT * FROM bot_sessions WHERE user_id = ?');
    const row = stmt.get(user_id) as { user_id: string; step: string; temp_data: string; updated_at: string } | undefined;
    if (!row) return null;
    try {
      return {
        user_id: row.user_id,
        step: row.step as BotSession['step'],
        temp_data: JSON.parse(row.temp_data),
        updated_at: row.updated_at
      };
    } catch {
      return null;
    }
  }

  setSession(user_id: string, step: BotSession['step'], temp_data: BotSession['temp_data']) {
    const stmt = this.db.prepare(`
      INSERT INTO bot_sessions (user_id, step, temp_data, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        step = excluded.step,
        temp_data = excluded.temp_data,
        updated_at = excluded.updated_at
    `);
    const now = new Date().toISOString();
    stmt.run(user_id, step, JSON.stringify(temp_data), now);
  }

  clearSession(user_id: string) {
    const stmt = this.db.prepare('DELETE FROM bot_sessions WHERE user_id = ?');
    stmt.run(user_id);
  }
}

export const dbService = new DatabaseService();
