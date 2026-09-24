import db from './database.js';

export interface UsageRecord {
  tenantId: string;
  conversationId: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ttftMs: number | null;
  latencyMs: number;
  finishReason: string | null;
  retryCount: number;
  fallbackUsed: boolean;
}

export interface Conversation {
  id: string;
  tenantId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  provider: string | null;
  model: string | null;
  createdAt: string;
}

export function createConversation(
  tenantId: string,
  title: string
): Conversation {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO conversations (
      id,
      tenant_id,
      title,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    title,
    now,
    now
  );

  return {
    id,
    tenantId,
    title,
    createdAt: now,
    updatedAt: now,
  };
}

export function addMessage(
  conversationId: string,
  role: string,
  content: string,
  provider: string | null = null,
  model: string | null = null
): StoredMessage {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO messages (
      id,
      conversation_id,
      role,
      content,
      provider,
      model,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    conversationId,
    role,
    content,
    provider,
    model,
    now
  );

  return {
    id,
    conversationId,
    role,
    content,
    provider,
    model,
    createdAt: now,
  };
}

export function getMessages(
  tenantId: string,
  conversationId: string
): StoredMessage[] {
  return db
    .prepare(`
      SELECT
        m.id,
        m.conversation_id AS conversationId,
        m.role,
        m.content,
        m.provider,
        m.model,
        m.created_at AS createdAt
      FROM messages m
      INNER JOIN conversations c
        ON c.id = m.conversation_id
      WHERE c.id = ?
        AND c.tenant_id = ?
      ORDER BY m.created_at ASC
    `)
    .all(conversationId, tenantId) as StoredMessage[];
}

export function getConversation(
  tenantId: string,
  conversationId: string
): Conversation | null {
  const conversation = db
    .prepare(`
      SELECT
        id,
        tenant_id AS tenantId,
        title,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM conversations
      WHERE id = ?
        AND tenant_id = ?
    `)
    .get(conversationId, tenantId) as Conversation | undefined;

  return conversation ?? null;
}

export function recordUsage(
  usage: UsageRecord
): void {
  db.prepare(`
        INSERT INTO usage (
            id,
            tenant_id,
            conversation_id,
            provider,
            model,
            input_tokens,
            output_tokens,
            cost_usd,
            ttft_ms,
            latency_ms,
            finish_reason,
            retry_count,
            fallback_used,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
    crypto.randomUUID(),
    usage.tenantId,
    usage.conversationId,
    usage.provider,
    usage.model,
    usage.inputTokens,
    usage.outputTokens,
    usage.costUsd,
    usage.ttftMs,
    usage.latencyMs,
    usage.finishReason,
    usage.retryCount,
    usage.fallbackUsed ? 1 : 0,
    new Date().toISOString()
  );
}

export function getUsage(
  tenantId: string
): UsageRecord[] {
  return db
    .prepare(`
            SELECT
                tenant_id AS tenantId,
                conversation_id AS conversationId,
                provider,
                model,
                input_tokens AS inputTokens,
                output_tokens AS outputTokens,
                cost_usd AS costUsd,
                ttft_ms AS ttftMs,
                latency_ms AS latencyMs,
                finish_reason AS finishReason,
                retry_count AS retryCount,
                fallback_used AS fallbackUsed
            FROM usage
            WHERE tenant_id = ?
            ORDER BY created_at DESC
        `)
    .all(tenantId) as UsageRecord[];
}