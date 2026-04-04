import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/db';

/**
 * Скрипт применения SQL миграций.
 * Читает файлы из папки migrations/ по порядку,
 * пропускает уже применённые (записаны в таблице _migrations).
 *
 * Запуск: npm run migrate
 */
async function migrate() {
  const client = await pool.connect();

  try {
    // Убедимся что таблица миграций существует
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Получаем список уже применённых миграций
    const applied = await client.query<{ filename: string }>('SELECT filename FROM _migrations');
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    // Читаем все .sql файлы из папки migrations/
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // сортировка по имени (001_, 002_, ...)

    let appliedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`⏭️  Пропуск: ${file} (уже применена)`);
        continue;
      }

      console.log(`▶️  Применяю: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query(sql);

      // Записываем факт применения
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`✅ Применена: ${file}`);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log('\n📋 Все миграции уже применены, нечего делать.');
    } else {
      console.log(`\n🎉 Применено миграций: ${appliedCount}`);
    }
  } catch (err) {
    console.error('❌ Ошибка миграции:', (err as Error).message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
