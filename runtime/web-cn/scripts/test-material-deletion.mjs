import assert from 'node:assert/strict';
import { deleteOwnedMaterial } from '../src/lib/delete-owned-material.ts';

function fixture(options = {}) {
    const calls = { removed: [], deleted: 0, filters: [] };
    const client = {
        storage: { from: () => ({
            getPublicUrl: path => ({ data: { publicUrl: `https://storage.example/storage/v1/object/public/materials/${path}` } }),
            remove: async paths => { calls.removed.push(paths); return { error: options.storageError || null }; },
        }) },
        from: () => {
            let deleting = false;
            const query = {
                select: () => deleting ? Promise.resolve({ data: options.noRows ? [] : [{ id: 'm1' }], error: options.dbError || null }) : query,
                eq: (key, value) => { calls.filters.push([key, value]); return query; },
                single: async () => ({ data: options.missing ? null : { url: options.url || 'https://storage.example/storage/v1/object/public/materials/u1/%E4%B8%AD%E6%96%87.png' }, error: null }),
                delete: () => { deleting = true; calls.deleted++; return query; },
            };
            return query;
        },
    };
    return { calls, client };
}
for (const [name, options, expected] of [
    ['Chinese filename succeeds after both operations', {}, true],
    ['Storage failure retains the database record', { storageError: { message: 'denied' } }, false],
    ['Database failure does not report success', { dbError: { message: 'denied' } }, false],
    ['No affected rows does not report success', { noRows: true }, false],
    ['Missing material cannot be deleted', { missing: true }, false],
    ['Another owner URL is rejected', { url: 'https://storage.example/storage/v1/object/public/materials/u2/a.png' }, false],
    ['Another origin is rejected', { url: 'https://elsewhere.example/storage/v1/object/public/materials/u1/a.png' }, false],
    ['Encoded path escape is rejected', { url: 'https://storage.example/storage/v1/object/public/materials/u1/a%2F..%2Fb' }, false],
]) {
    const { client, calls } = fixture(options);
    assert.equal(await deleteOwnedMaterial(client, 'm1', 'u1'), expected, name);
    if (options.storageError || options.missing || options.url) assert.equal(calls.deleted, 0, name);
    if (expected) {
        assert.deepEqual(calls.removed, [['u1/中文.png']]);
        assert.equal(calls.filters.filter(([key, value]) => key === 'user_id' && value === 'u1').length, 2);
    }
    console.log(`PASS ${name}`);
}
