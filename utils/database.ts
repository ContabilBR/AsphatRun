import * as SQLite from 'expo-sqlite';

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface Run {
  id: number;
  date: string; // ISO 8601
  duration_seconds: number;
  distance_meters: number;
  avg_pace_seconds_per_km: number;
  route_points: RoutePoint[];
}

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('asphalt_run.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        distance_meters REAL NOT NULL,
        avg_pace_seconds_per_km REAL NOT NULL,
        route_points TEXT NOT NULL
      );
    `);
  }
  return db;
}

export async function saveRun(run: Omit<Run, 'id'>): Promise<number> {
  console.log('[DB] saveRun called', {
    date: run.date,
    duration_seconds: run.duration_seconds,
    distance_meters: run.distance_meters,
    avg_pace_seconds_per_km: run.avg_pace_seconds_per_km,
    route_points_count: run.route_points.length,
  });
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO runs (date, duration_seconds, distance_meters, avg_pace_seconds_per_km, route_points)
     VALUES (?, ?, ?, ?, ?)`,
    [run.date, run.duration_seconds, run.distance_meters, run.avg_pace_seconds_per_km, JSON.stringify(run.route_points)]
  );
  console.log('[DB] saveRun success, id:', result.lastInsertRowId);
  return result.lastInsertRowId;
}

export async function getAllRuns(): Promise<Run[]> {
  console.log('[DB] getAllRuns called');
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>('SELECT * FROM runs ORDER BY date DESC');
  console.log('[DB] getAllRuns returned', rows.length, 'runs');
  return rows.map(row => ({
    ...row,
    route_points: JSON.parse(row.route_points),
  }));
}

export async function getRunById(id: number): Promise<Run | null> {
  console.log('[DB] getRunById called, id:', id);
  const database = await getDatabase();
  const row = await database.getFirstAsync<any>('SELECT * FROM runs WHERE id = ?', [id]);
  if (!row) {
    console.log('[DB] getRunById: no run found for id', id);
    return null;
  }
  console.log('[DB] getRunById success, date:', row.date);
  return { ...row, route_points: JSON.parse(row.route_points) };
}

export async function deleteRun(id: number): Promise<void> {
  console.log('[DB] deleteRun called, id:', id);
  const database = await getDatabase();
  await database.runAsync('DELETE FROM runs WHERE id = ?', [id]);
  console.log('[DB] deleteRun success, id:', id);
}
