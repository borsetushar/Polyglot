import db from './database.js';

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