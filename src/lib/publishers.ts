// Data-access helpers for reading publisher records from the SQLite database via Drizzle ORM.

import { asc } from 'drizzle-orm';
import type { Database } from './db';
import { publishers } from '../../db/schema';
import type { Publisher } from '../types/game';

/**
 * Retrieves all publishers ordered by name for deterministic static builds.
 *
 * @param db - Injectable Drizzle database instance.
 * @returns All publishers, ordered ascending by name.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
    return rows;
}
