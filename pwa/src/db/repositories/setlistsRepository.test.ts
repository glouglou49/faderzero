import { SetlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { SetlistsRepository } from '@/db/repositories/setlistsRepository';
import { destroyTestDatabase, createTestDatabase } from '@/test/dbTestUtils';

describe('SetlistsRepository', () => {
  it('creates, updates and soft deletes setlists', async () => {
    const database = await createTestDatabase('setlists-repository');
    const repository = new SetlistsRepository(database);
    const setlistSongsRepository = new SetlistSongsRepository(database);

    const olderSetlist = await repository.create({
      name: 'Older Set',
    });
    const newerSetlist = await repository.create({
      name: 'Newer Set',
      notes: 'festival',
    });
    await setlistSongsRepository.create({
      setlistId: newerSetlist.id,
      songId: 'song-1',
      position: 0,
    });

    let setlists = await repository.list();
    expect(setlists[0]?.id).toBe(newerSetlist.id);
    expect(setlists[1]?.id).toBe(olderSetlist.id);

    const updatedSetlist = await repository.update(olderSetlist.id, {
      notes: 'updated',
      date: '2026-06-25',
    });
    expect(updatedSetlist.notes).toBe('updated');
    expect(updatedSetlist.date).toBe('2026-06-25');

    await repository.softDelete(newerSetlist.id);

    setlists = await repository.list();
    expect(setlists).toHaveLength(1);
    expect(setlists[0]?.id).toBe(olderSetlist.id);
    expect(await setlistSongsRepository.listBySetlistId(newerSetlist.id)).toHaveLength(0);

    const summaries = await repository.listSummaries({ includeDeleted: true });
    const olderSummary = summaries.find((summary) => summary.id === olderSetlist.id);
    expect(olderSummary?.songCount).toBe(0);

    await destroyTestDatabase(database);
  });
});
