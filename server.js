const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const VALID_TOKEN = process.env.API_TOKEN || '400e4beb57710e650c6e3ade1e9ef706';
const DEFAULT_BALANCE = Number(process.env.DEFAULT_BALANCE || 100);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RESELLER_NAME = process.env.RESELLER_NAME || 'Minha Loja';

const packages = {
  100: { credits: 100, package_name: '100 Créditos', price: 9.95 },
  200: { credits: 200, package_name: '200 Créditos', price: 17.95 },
  300: { credits: 300, package_name: '300 Créditos', price: 24.95 },
  500: { credits: 500, package_name: '500 Créditos', price: 39.95 },
  1000: { credits: 1000, package_name: '1000 Créditos', price: 74.95 }
};

let currentBalance = DEFAULT_BALANCE;
const requestsByToken = new Map();

function nowIso() {
  return new Date().toISOString();
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(payload, null, 2));
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function rateLimitCheck(token, ip) {
  const key = token || ip || 'anonymous';
  const now = Date.now();
  const recent = (requestsByToken.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    requestsByToken.set(key, recent);
    return false;
  }

  recent.push(now);
  requestsByToken.set(key, recent);
  return true;
}

function notFound(res) {
  return json(res, 404, {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Rota não encontrada.'
    },
    timestamp: nowIso()
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    return json(res, 200, {
      success: true,
      message: 'Mock reseller API online',
      endpoints: [
        '/functions/v1/reseller-api?seller=TOKEN&pacote=500&client=João%20Silva&convite=CODIGO',
        '/admin/balance',
        '/admin/reset-balance?value=100',
        '/health'
      ],
      timestamp: nowIso()
    });
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, timestamp: nowIso() });
  }

  if (req.method === 'GET' && url.pathname === '/admin/balance') {
    return json(res, 200, {
      success: true,
      balance: {
        current: round(currentBalance),
        currency: 'BRL'
      },
      timestamp: nowIso()
    });
  }

  if (req.method === 'GET' && url.pathname === '/admin/reset-balance') {
    const value = Number(url.searchParams.get('value') || DEFAULT_BALANCE);
    currentBalance = Number.isFinite(value) ? round(value) : DEFAULT_BALANCE;

    return json(res, 200, {
      success: true,
      message: 'Saldo resetado com sucesso.',
      balance: {
        current: round(currentBalance),
        currency: 'BRL'
      },
      timestamp: nowIso()
    });
  }

  if (req.method === 'GET' && url.pathname === '/functions/v1/reseller-api') {
    const seller = url.searchParams.get('seller');
    const pacote = Number(url.searchParams.get('pacote'));
    const client = url.searchParams.get('client') || 'Cliente Teste';
    const convite = url.searchParams.get('convite') || null;

    if (!rateLimitCheck(seller, req.socket.remoteAddress)) {
      return json(res, 429, {
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: 'Limite de 30 requisições por minuto excedido.',
          retry_after_seconds: 60
        },
        timestamp: nowIso()
      });
    }

    if (seller !== VALID_TOKEN) {
      return json(res, 401, {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token de API inválido ou inexistente.'
        },
        timestamp: nowIso()
      });
    }

    const selectedPackage = packages[pacote];

    if (!selectedPackage) {
      return json(res, 400, {
        success: false,
        error: {
          code: 'INVALID_PACKAGE',
          message: 'Pacote inválido. Use um dos pacotes disponíveis: 100, 200, 300, 500, 1000.'
        },
        timestamp: nowIso()
      });
    }

    if (currentBalance < selectedPackage.price) {
      return json(res, 400, {
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Saldo insuficiente para esta operação.',
          balance: {
            current: round(currentBalance),
            required: round(selectedPackage.price),
            deficit: round(selectedPackage.price - currentBalance),
            currency: 'BRL'
          }
        },
        timestamp: nowIso()
      });
    }

    const balanceBefore = round(currentBalance);
    currentBalance = round(currentBalance - selectedPackage.price);
    const generatedProtocol = protocol();

    return json(res, 200, {
      success: true,
      data: {
        order: {
          id: orderId(),
          protocol: generatedProtocol,
          credits: selectedPackage.credits,
          package_name: selectedPackage.package_name,
          price: round(selectedPackage.price),
          currency: 'BRL',
          support_url: `https://chatlee.online/cliente/chat?protocol=${generatedProtocol}`
        },
        customer: { name: client },
        balance: {
          before: balanceBefore,
          after: round(currentBalance),
          currency: 'BRL'
        },
        reseller: {
          name: RESELLER_NAME,
          invite_code: convite
        }
      },
      timestamp: nowIso()
    });
  }

  return notFound(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock reseller API running on port ${PORT}`);
});
