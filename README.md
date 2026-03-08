# Mock Railway Light API

API Node.js sem dependências externas, ideal para subir rápido no Railway.

## Rodar localmente

```bash
npm start
```

## Endpoints

- `GET /`
- `GET /health`
- `GET /admin/balance`
- `GET /admin/reset-balance?value=100`
- `GET /functions/v1/reseller-api?seller=TOKEN&pacote=500&client=João%20Silva&convite=CODIGO`

## Variáveis opcionais

- `API_TOKEN`
- `DEFAULT_BALANCE`
- `RATE_LIMIT_MAX`
- `RESELLER_NAME`
- `PORT`
