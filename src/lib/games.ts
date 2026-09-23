// Data-access helpers for reading and filtering game records from SQLite via Drizzle ORM.

import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

/**
 * Filters that can be applied when retrieving games.
 */
export interface GameFilters {
    categoryIds?: readonly number[];
    publisherId?: number;
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Retrieves all games ordered by title.
 *
 * @param db - Injectable Drizzle database instance.
 * @returns All games ordered ascending by title.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getFilteredGames(db);
}

/**
 * Retrieves games matching optional category and publisher filters.
 *
 * Multiple category IDs are combined with OR semantics, while the publisher
 * filter is combined with the category selection using AND semantics.
 *
 * @param db - Injectable Drizzle database instance.
 * @param filters - Optional category IDs and publisher ID to match.
 * @returns Matching games ordered ascending by title.
 */
export async function getFilteredGames(
    db: Database,
    filters: GameFilters = {},
): Promise<Game[]> {
    const categoryCondition = filters.categoryIds?.length
        ? inArray(games.categoryId, [...filters.categoryIds])
        : undefined;
    const publisherCondition = filters.publisherId !== undefined
        ? eq(games.publisherId, filters.publisherId)
        : undefined;

    const rows = await baseGamesQuery(db)
        .where(and(categoryCondition, publisherCondition))
        .orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Retrieves all game IDs ordered by game title.
 *
 * @param db - Injectable Drizzle database instance.
 * @returns Game IDs ordered by their associated title.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Retrieves one game by ID.
 *
 * @param db - Injectable Drizzle database instance.
 * @param id - Game ID to retrieve.
 * @returns The matching game, or null when it does not exist.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
