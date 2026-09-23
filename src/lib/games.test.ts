// Unit tests for game listing, lookup, and filtering data-access helpers.

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getFilteredGames,
    getGameById,
} from './games';

interface FilterFixtureIds {
    strategyCategoryId: number;
    puzzleCategoryId: number;
    firstPublisherId: number;
    secondPublisherId: number;
}

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterGames(db: Database): Promise<FilterFixtureIds> {
    const [strategyCategory] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'Strategy games' })
        .returning({ id: categories.id });
    const [puzzleCategory] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'Puzzle games' })
        .returning({ id: categories.id });
    const [firstPublisher] = await db
        .insert(publishers)
        .values({ name: 'Publisher One', description: 'First publisher' })
        .returning({ id: publishers.id });
    const [secondPublisher] = await db
        .insert(publishers)
        .values({ name: 'Publisher Two', description: 'Second publisher' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Zulu Strategy',
            description: 'Strategy game from publisher one',
            starRating: 4.1,
            categoryId: strategyCategory.id,
            publisherId: firstPublisher.id,
        },
        {
            title: 'Alpha Strategy',
            description: 'Strategy game from publisher two',
            starRating: 4.2,
            categoryId: strategyCategory.id,
            publisherId: secondPublisher.id,
        },
        {
            title: 'Beta Puzzle',
            description: 'Puzzle game from publisher one',
            starRating: 4.3,
            categoryId: puzzleCategory.id,
            publisherId: firstPublisher.id,
        },
        {
            title: 'Gamma Puzzle',
            description: 'Puzzle game from publisher two',
            starRating: 4.4,
            categoryId: puzzleCategory.id,
            publisherId: secondPublisher.id,
        },
    ]);

    return {
        strategyCategoryId: strategyCategory.id,
        puzzleCategoryId: puzzleCategory.id,
        firstPublisherId: firstPublisher.id,
        secondPublisherId: secondPublisher.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    describe('getFilteredGames', () => {
        it('returns all games ordered by title when filters are empty', async () => {
            await seedFilterGames(db);

            const filtered = await getFilteredGames(db);

            expect(filtered.map((game) => game.title)).toEqual([
                'Alpha Strategy',
                'Beta Puzzle',
                'Gamma Puzzle',
                'Zulu Strategy',
            ]);
        });

        it('filters by one category', async () => {
            const fixtureIds = await seedFilterGames(db);

            const filtered = await getFilteredGames(db, {
                categoryIds: [fixtureIds.strategyCategoryId],
            });

            expect(filtered.map((game) => game.title)).toEqual([
                'Alpha Strategy',
                'Zulu Strategy',
            ]);
        });

        it('combines multiple categories with OR semantics', async () => {
            const fixtureIds = await seedFilterGames(db);

            const filtered = await getFilteredGames(db, {
                categoryIds: [
                    fixtureIds.puzzleCategoryId,
                    fixtureIds.strategyCategoryId,
                ],
            });

            expect(filtered.map((game) => game.title)).toEqual([
                'Alpha Strategy',
                'Beta Puzzle',
                'Gamma Puzzle',
                'Zulu Strategy',
            ]);
        });

        it('filters by publisher', async () => {
            const fixtureIds = await seedFilterGames(db);

            const filtered = await getFilteredGames(db, {
                publisherId: fixtureIds.firstPublisherId,
            });

            expect(filtered.map((game) => game.title)).toEqual([
                'Beta Puzzle',
                'Zulu Strategy',
            ]);
        });

        it('combines category and publisher filters with AND semantics', async () => {
            const fixtureIds = await seedFilterGames(db);

            const filtered = await getFilteredGames(db, {
                categoryIds: [fixtureIds.puzzleCategoryId],
                publisherId: fixtureIds.secondPublisherId,
            });

            expect(filtered.map((game) => game.title)).toEqual(['Gamma Puzzle']);
        });

        it('returns an empty list when no games match', async () => {
            const fixtureIds = await seedFilterGames(db);

            const filtered = await getFilteredGames(db, {
                categoryIds: [fixtureIds.strategyCategoryId],
                publisherId: 99999,
            });

            expect(filtered).toEqual([]);
        });
    });
});
