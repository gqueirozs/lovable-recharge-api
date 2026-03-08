# Mock Reseller API

API simples em **Node.js + Express** para simular uma integração de criação de pedidos.

## Subir localmente

```bash
npm install
npm start
```

## Deploy no Railway

Basta subir este projeto no Railway. Ele usa:

- `npm start`
- `PORT` automática do Railway

## Variáveis opcionais

```env
API_TOKEN=400e4beb57710e650c6e3ade1e9ef706
DEFAULT_BALANCE=100
RATE_LIMIT_MAX=30
RESELLER_NAME=Minha Loja
```

## Endpoint principal

```bash
GET /functions/v1/reseller-api?seller=TOKEN&pacote=500&client=João%20Silva&convite=CODIGO_CONVITE
```

### Exemplo

```bash
curl "http://localhost:3000/functions/v1/reseller-api?seller=400e4beb57710e650c6e3ade1e9ef706&pacote=500&client=Jo%C3%A3o%20Silva&convite=CODIGO_CONVITE"
```

## Fluxos simulados

- **200**: sucesso
- **401**: token inválido
- **400**: saldo insuficiente
- **429**: rate limit excedido

## Endpoints auxiliares

### Ver saldo atual

```bash
GET /admin/balance
```

### Resetar saldo

```bash
GET /admin/reset-balance?value=100
```

Use por exemplo `value=20` para forçar o erro de saldo insuficiente.
