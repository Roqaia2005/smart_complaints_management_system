'use strict';

/**
 * Adds the embedding column used by the semantic classifier.
 * Rename this file with today's timestamp prefix (Sequelize CLI convention),
 * e.g. 20260702120000-add-embedding-to-categories.js
 *
 * Pick ONE of the two `up`/`down` implementations below depending on
 * whether pgvector is available on your Postgres instance (Supabase
 * usually has it enabled by default -- check with:
 *   SELECT * FROM pg_extension WHERE extname = 'vector';
 * ). The pgvector version is commented in; swap to the JSON fallback if
 * the extension isn't available.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // --- Option A: pgvector (preferred) ---
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
    await queryInterface.sequelize.query(
      'ALTER TABLE categories ADD COLUMN IF NOT EXISTS embedding vector(384);'
    );
    // Optional but recommended once you have real data volume:
    // await queryInterface.sequelize.query(
    //   'CREATE INDEX IF NOT EXISTS categories_embedding_idx ' +
    //   'ON categories USING ivfflat (embedding vector_cosine_ops);'
    // );

    // --- Option B: plain JSON column (use instead if pgvector isn't available) ---
    // await queryInterface.addColumn('categories', 'embedding', {
    //   type: Sequelize.JSONB,
    //   allowNull: true,
    // });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('categories', 'embedding');
  },
};