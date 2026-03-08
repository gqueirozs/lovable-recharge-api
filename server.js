const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const VALID_TOKEN = process.env.API_TOKEN || '400e4beb57710e650c6e3ade1e9ef706';
const DEFAULT_BALANCE = Number(process.env.DEFAULT_BALANCE || 100);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const reseller = {
  name: process.env.RESELLER_NAME || 'Minha Loja',
};

const packages = {
  100: { credits: 100, package_name: '100 Créditos', price: 9.95 },
  200: { credits: 200, package_name: '200 Créditos', price: 17.95 },
  300: { credits: 300, package_name: '300 Créditos', price: 24.95 },
  500: { credits: 500, package_name: '500 Créditos', price: 39.95 },
  1000: { credits: 1000, package_name: '1000 Créditos', price: 74.95 },
};

let currentBalance = DEFAULT_BALANCE;
const requestsByToken = new Map();

function nowIso() {
  return new Date().toISOString();
}

function protocol() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CLI-${dd}${mm}-${suffix}`;
}

function orderId() {
  return crypto.randomUUID();
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function rateLimitMiddleware(req, res, next) {
  const seller = req.query.seller || req.ip;
  const now = Date.now();
  const timestamps = requestsByToken.get(seller) || [];
  const validTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: `Limite de ${RATE_LIMIT_MAX} requisições por minuto excedido.`,
        retry_after_seconds: 60,
      },
      timestamp: nowIso(),
    });
  }

  validTimestamps.push(now);
  requestsByToken.set(seller, validTimestamps);
  next();
}

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Mock Reseller API online.',
    endpoints: {
      create_order: '/functions/v1/reseller-api?seller=TOKEN&pacote=500&client=João%20Silva&convite=CODIGO_CONVITE',
      reset_balance: '/admin/reset-balance?value=100',
      get_balance: '/admin/balance',
    },
    timestamp: nowIso(),
  });
});

app.get('/functions/v1/reseller-api', rateLimitMiddleware, (req, res) => {
  const { seller, pacote, client } = req.query;

  if (!seller || seller !== VALID_TOKEN) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token de API inválido ou inexistente.',
      },
      timestamp: nowIso(),
    });
  }

  if (!pacote || !packages[pacote]) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PACKAGE',
        message: 'Pacote inválido ou não suportado.',
      },
      timestamp: nowIso(),
    });
  }

  if (!client) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CLIENT',
        message: 'O parâmetro client é obrigatório.',
      },
      timestamp: nowIso(),
    });
  }

  const selectedPackage = packages[pacote];

  if (currentBalance < selectedPackage.price) {
    const deficit = round(selectedPackage.price - currentBalance);
    return res.status(400).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_BALANCE',
        message: 'Saldo insuficiente para esta operação.',
        balance: {
          current: round(currentBalance),
          required: selectedPackage.price,
          deficit,
          currency: 'BRL',
        },
      },
      timestamp: nowIso(),
    });
  }

  const before = round(currentBalance);
  currentBalance = round(currentBalance - selectedPackage.price);
  const after = round(currentBalance);
  const generatedProtocol = protocol();

  return res.json({
    success: true,
    data: {
      order: {
        id: orderId(),
        protocol: generatedProtocol,
        credits: selectedPackage.credits,
        package_name: selectedPackage.package_name,
        price: selectedPackage.price,
        currency: 'BRL',
        support_url: `https://chatlee.online/cliente/chat?protocol=${generatedProtocol}`,
      },
      customer: { name: String(client) },
      balance: { before, after, currency: 'BRL' },
      reseller,
    },
    timestamp: nowIso(),
  });
});

app.get('/admin/balance', (_req, res) => {
  res.json({
    success: true,
    balance: {
      current: round(currentBalance),
      currency: 'BRL',
    },
    timestamp: nowIso(),
  });
});

app.get('/admin/reset-balance', (req, res) => {
  const value = Number(req.query.value);
  currentBalance = Number.isFinite(value) ? round(value) : DEFAULT_BALANCE;

  res.json({
    success: true,
    message: 'Saldo resetado com sucesso.',
    balance: {
      current: round(currentBalance),
      currency: 'BRL',
    },
    timestamp: nowIso(),
  });
});

app.listen(PORT, () => {
  console.log(`Mock Reseller API rodando na porta ${PORT}`);
});
