import { describe, expect, it } from 'vitest';

import {
    addMessage,
    createConversation,
    getMessages,
} from './conversation-repository.js';

import { createTenant } from './tenant-repository.js';

describe('tenant isolation', () => {
    it('prevents one tenant from reading another tenant conversation', () => {
        const tenantA = createTenant('Tenant A');
        const tenantB = createTenant('Tenant B');

        const conversationA = createConversation(
            tenantA.id,
            'Tenant A conversation'
        );

        addMessage(
            conversationA.id,
            'user',
            'Secret message from Tenant A'
        );

        const tenantACanRead = getMessages(
            tenantA.id,
            conversationA.id
        );

        const tenantBCanRead = getMessages(
            tenantB.id,
            conversationA.id
        );

        expect(tenantACanRead).toHaveLength(1);
        expect(tenantACanRead[0]?.content).toBe(
            'Secret message from Tenant A'
        );

        expect(tenantBCanRead).toHaveLength(0);
    });
});