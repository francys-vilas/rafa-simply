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

// Visitor Tracking Middleware
app.use(async (req, res, next) => {
  // Ignorar requisições de arquivos estáticos (exceto index.html) e de API
  if (req.path !== '/' && !req.path.endsWith('.html')) {
    return next();
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const referer = req.headers['referer'] || req.headers['referrer'];
  const idioma = req.headers['accept-language'];

  if (process.env.OFFLINE_MODE !== 'true') {
    try {
      const client = await pool.connect();
      try {
        const resVisit = await client.query('SELECT id, visitas_count FROM visitantes WHERE ip_address = $1', [ip]);
        let currentVisits = 1;
        let lastVisit = new Date();
        
        if (resVisit.rows.length > 0) {
          const updateRes = await client.query(
            'UPDATE visitantes SET visitas_count = visitas_count + 1, data_visita = CURRENT_TIMESTAMP, user_agent = $2, referer = $3, idioma = $4 WHERE ip_address = $1 RETURNING visitas_count, data_visita',
            [ip, userAgent, referer, idioma]
          );
          currentVisits = updateRes.rows[0].visitas_count;
          lastVisit = updateRes.rows[0].data_visita;
        } else {
          const insertRes = await client.query(
            'INSERT INTO visitantes (ip_address, user_agent, referer, idioma) VALUES ($1, $2, $3, $4) RETURNING visitas_count, data_visita',
            [ip, userAgent, referer, idioma]
          );
          currentVisits = insertRes.rows[0].visitas_count;
          lastVisit = insertRes.rows[0].data_visita;
          console.log(`🆕 Novo visitante detectado: ${ip}`);
        }

        // --- NOTIFICAÇÃO WHATSAPP PARA VISITANTE ---
        try {
          const ownerPhone = process.env.OWNER_PHONE; 
          const apiUrl = process.env.EVOLUTION_API_URL;
          const apiKey = process.env.EVOLUTION_API_KEY;
          const instance = process.env.EVOLUTION_INSTANCE || 'main';

          if (ownerPhone && apiUrl && apiKey) {
              const formattedDate = new Date(lastVisit).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
              
              // Simplificação do aparelho (Celular ou Desktop)
              const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
              const aparelho = isMobile ? '📱 Celular' : '💻 Desktop';

              const text = `👀 *Nova Visita Simplygesso!*\n\n🌐 *IP:* ${ip}\n🔢 *Total de Visitas:* ${currentVisits}\n📅 *Data/Hora:* ${formattedDate}\n🖥️ *Aparelho:* ${aparelho}\n🔗 *Origem:* ${referer || 'Direto'}`;
              
              fetch(`${apiUrl}/message/sendText/${instance}`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'apikey': apiKey
                  },
                  body: JSON.stringify({
                      number: ownerPhone,
                      text: text
                  })
              }).catch(e => console.error('Erro assíncrono WhatsApp Visitante:', e.message));
          }
        } catch (apiError) {
            console.error('Erro ao preparar zap visitante:', apiError.message);
        }
        // -------------------------------------------

      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Erro ao registrar visitante:', err.message);
    }
  } else {
    console.log(`👁️ [OFFLINE] Visita detectada: ${ip}`);
  }

  next();
});

app.use(express.static(path.join(__dirname, '/')));

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database table if it doesn't exist
const initDb = async () => {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(100) NOT NULL,
          whatsapp VARCHAR(20) NOT NULL,
          servico VARCHAR(50),
          data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS visitantes (
          id SERIAL PRIMARY KEY,
          ip_address VARCHAR(45),
          user_agent TEXT,
          referer TEXT,
          idioma VARCHAR(100),
          data_visita TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          visitas_count INTEGER DEFAULT 1
        );
      `);
      console.log('Tabelas (leads e visitantes) verificadas/criadas com sucesso');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('\n⚠️  AVISO: Não foi possível conectar ao Banco de Dados.');
    console.warn('⚠️  O servidor rodará em MODO OFFLINE (Leads serão apenas logados no console).\n');
    process.env.OFFLINE_MODE = 'true';
  }
};

initDb();

app.post('/api/leads', async (req, res) => {
  const { nome, whatsapp, servico } = req.body;

  if (!nome || !whatsapp) {
    return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios' });
  }

  // Modo Offline (Local)
  if (process.env.OFFLINE_MODE === 'true') {
    console.log('📝 [MODO OFFLINE] Novo Lead Recebido:');
    console.log(`   Nome: ${nome}`);
    console.log(`   Serviço: ${servico}`);

    // --- INTEGRAÇÃO EVOLUTION API (WHATSAPP) ---
    try {
        const text = `🚀 *Novo Lead Simplygesso!*\n\n👤 *Nome:* ${nome}\n📱 *WhatsApp:* ${whatsapp}\n🛠️ *Serviço:* ${servico}`;
        
        const ownerPhone = process.env.OWNER_PHONE; 
        const apiUrl = process.env.EVOLUTION_API_URL;
        const apiKey = process.env.EVOLUTION_API_KEY;
        const instance = process.env.EVOLUTION_INSTANCE || 'main';

        if (ownerPhone && apiUrl && apiKey) {
            console.log(`📤 [OFFLINE] Enviando WhatsApp para ${ownerPhone}...`);
            const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey
                },
                body: JSON.stringify({
                    number: ownerPhone,
                    text: text
                })
            });

            if (response.ok) {
                console.log('✅ Notificação WhatsApp enviada com sucesso!');
            } else {
                const errText = await response.text();
                // Tenta fazer parse do erro para não logar JSON stringificado feio, se der
                console.error('❌ Erro ao enviar WhatsApp (API):', errText);
            }
        } else {
            console.warn('⚠️ Configuração do WhatsApp incompleta no .env. Notificação não enviada.');
        }
    } catch (apiError) {
        console.error('❌ Erro na requisição da API (Fetch):', apiError);
    }
    // -------------------------------------------

    return res.status(201).json({ message: 'Lead recebido (Simulação Offline) + WhatsApp enviado' });
  }

  // Modo Online (Produção)
  try {
    const client = await pool.connect();
    try {
      await client.query(
        'INSERT INTO leads (nome, whatsapp, servico) VALUES ($1, $2, $3)',
        [nome, whatsapp, servico]
      );
      
      // --- INTEGRAÇÃO EVOLUTION API (WHATSAPP) ---
      try {
        const text = `🚀 *Novo Lead Simplygesso!*\n\n👤 *Nome:* ${nome}\n📱 *WhatsApp:* ${whatsapp}\n🛠️ *Serviço:* ${servico}`;
        
        // Pega do arquivo .env
        const ownerPhone = process.env.OWNER_PHONE; 
        const apiUrl = process.env.EVOLUTION_API_URL;
        const apiKey = process.env.EVOLUTION_API_KEY;
        const instance = process.env.EVOLUTION_INSTANCE || 'main';

        if (ownerPhone && apiUrl && apiKey) {
            console.log(`📤 Enviando WhatsApp para ${ownerPhone}...`);
            const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey
                },
                body: JSON.stringify({
                    number: ownerPhone,
                    text: text
                })
            });

            if (response.ok) {
                console.log('✅ Notificação WhatsApp enviada com sucesso!');
            } else {
                const errText = await response.text();
                console.error('❌ Erro ao enviar WhatsApp:', errText);
            }
        } else {
            console.warn('⚠️ Configuração do WhatsApp incompleta no .env');
        }
      } catch (apiError) {
          console.error('❌ Erro na requisição da API:', apiError);
      }
      // -------------------------------------------

      res.status(201).json({ message: 'Lead salvo com sucesso' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Erro ao salvar lead:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
