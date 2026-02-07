const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database table if it doesn't exist
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        servico TEXT NOT NULL,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully: table "leads" is ready.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};
initDb();

// API Endpoint for Leads
app.post('/api/leads', async (req, res) => {
  const { nome, whatsapp, servico } = req.body;

  if (!nome || !whatsapp || !servico) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO leads (nome, whatsapp, servico) VALUES ($1, $2, $3) RETURNING *',
      [nome, whatsapp, servico]
    );
    res.status(201).json({ message: 'Lead capturado com sucesso!', lead: result.rows[0] });
  } catch (err) {
    console.error('Error saving lead:', err);
    res.status(500).json({ error: 'Erro interno ao salvar o lead' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
