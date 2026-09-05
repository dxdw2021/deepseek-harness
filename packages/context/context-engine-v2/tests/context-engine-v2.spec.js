import { afterEach, describe, expect, it } from 'vitest';
import { Context } from '@deepseek-ai/cordis';
import { ContextEngineV2Service } from "../src/index.js";
/**
 * A minimal Cordis context stub for unit-testing the service without spinning
 * up the full plugin host. The ContextEngineV2Service only needs `ctx.emit`
 * for its event side-effects; everything else is in-memory.
 */
function makeBareContext() {
    const ctx = new Context();
    // Make the Cordis runtime available so `ctx.on` works for the few tests
    // that listen to events. Cordis' own Context constructor already wires this
    // when the loader starts a fiber; without one we provide the minimal
    // surface the service uses.
    const listeners = new Map();
    const origEmit = ctx.emit?.bind(ctx);
    ctx.emit = ((event, ...args) => {
        for (const cb of listeners.get(event) ?? [])
            cb(...args);
        return origEmit ? origEmit(event, ...args) : false;
    });
    ctx.on = (event, cb) => {
        const arr = listeners.get(event) ?? [];
        arr.push(cb);
        listeners.set(event, arr);
        return () => {
            const i = arr.indexOf(cb);
            if (i >= 0)
                arr.splice(i, 1);
        };
    };
    return ctx;
}
const contexts = [];
function setup() {
    const ctx = makeBareContext();
    contexts.push(ctx);
    // The Service constructor calls `ctx.reflect.provide` which is wired by
    // the bare Context constructor; emit/on are the only side-channels we
    // need to exercise from the service's methods.
    const service = new ContextEngineV2Service(ctx);
    return { ctx, service };
}
afterEach(async () => {
    await Promise.all(contexts.splice(0).map(ctx => ctx.fiber?.dispose?.() ?? Promise.resolve()));
});
describe('ContextEngineV2Service', () => {
    it('adds entries and assigns an id, createdAt, and updatedAt', () => {
        const { service } = setup();
        const entry = service.add({
            type: 'memory',
            scope: 'project',
            activation: 'relevant',
            content: 'project: prefers tabs',
            priority: 5,
            tags: ['preferences'],
        });
        expect(entry.id).toMatch(/^ctx-/);
        expect(entry.createdAt).toBeInstanceOf(Date);
        expect(entry.updatedAt).toEqual(entry.createdAt);
    });
    it('emits entry-added and supports update and remove', () => {
        const { ctx, service } = setup();
        const addedEvents = [];
        const removedEvents = [];
        ctx.on('context-engine-v2/entry-added', (e) => addedEvents.push(e));
        ctx.on('context-engine-v2/entry-removed', (e) => removedEvents.push(e));
        const entry = service.add({
            type: 'instruction', scope: 'global', activation: 'pinned',
            content: 'always run tests', priority: 10, tags: [],
        });
        expect(addedEvents).toHaveLength(1);
        const updated = service.update(entry.id, { content: 'always run unit tests' });
        expect(updated?.content).toBe('always run unit tests');
        expect(service.get(entry.id)?.content).toBe('always run unit tests');
        expect(service.remove(entry.id)).toBe(true);
        expect(service.get(entry.id)).toBeUndefined();
        expect(removedEvents).toHaveLength(1);
    });
    it('returns pinned and relevant entries for a query', () => {
        const { service } = setup();
        service.add({ type: 'instruction', scope: 'global', activation: 'pinned', content: 'release notes policy', priority: 10, tags: [] });
        service.add({ type: 'memory', scope: 'project', activation: 'relevant', content: 'project uses vitest for tests', priority: 5, tags: [] });
        service.add({ type: 'memory', scope: 'project', activation: 'relevant', content: 'release branch cut on Friday', priority: 1, tags: [] });
        const ctx = service.getContextForQuery('test runner');
        const ids = new Set(ctx.map(e => e.id));
        expect(ids.size).toBe(ctx.length); // no duplicates
        // Pinned entry is always included.
        expect(ctx.find(e => e.activation === 'pinned')).toBeDefined();
    });
    it('prunes entries by overlapping source seqs', () => {
        const { service } = setup();
        const kept = service.add({ type: 'memory', scope: 'session', activation: 'relevant', content: 'keep', priority: 1, tags: [], sourceEventSeqs: [10, 11] });
        const stale = service.add({ type: 'memory', scope: 'session', activation: 'relevant', content: 'stale', priority: 1, tags: [], sourceEventSeqs: [5, 6, 7] });
        const removed = service.pruneBySourceSeqs([5, 6]);
        expect(removed).toBe(1);
        expect(service.get(stale.id)).toBeUndefined();
        expect(service.get(kept.id)).toBeDefined();
    });
    it('creates a memory entry from a compaction summary and prunes shadowed seqs', () => {
        const { service } = setup();
        const stale = service.add({ type: 'memory', scope: 'session', activation: 'relevant', content: 'old', priority: 1, tags: [], sourceEventSeqs: [1] });
        const entry = service.handleCompactionSummary([{ type: 'text', text: 'Compacted turn 1: did X then Y' }], [1], 'deepseek', 'deepseek-reasoner');
        expect(entry).toBeDefined();
        expect(entry?.type).toBe('memory');
        expect(entry?.content).toContain('Compacted turn 1');
        expect(entry?.metadata?.shadowedSeqs).toEqual([1]);
        expect(service.get(stale.id)).toBeUndefined();
    });
    it('clears expired entries when expiration is enabled', () => {
        const { service } = setup();
        const past = new Date(Date.now() - 60_000);
        const entry = service.add({ type: 'memory', scope: 'project', activation: 'relevant', content: 'old', priority: 1, tags: [], expiresAt: past });
        const cleared = service.clearExpired();
        expect(cleared).toBe(1);
        expect(service.get(entry.id)).toBeUndefined();
    });
});
//# sourceMappingURL=context-engine-v2.spec.js.map