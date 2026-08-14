# 7. Testes Automatizados e Integração Contínua (CI)

Resolve a Issue [#16](https://github.com/gabrielsoares01/rpi-digital-twin/issues/16)
e cobre parcialmente a Issue [#12](https://github.com/gabrielsoares01/rpi-digital-twin/issues/12).

## 7.1 Motivação

O repositório não possuía testes automatizados nem checagem no GitHub antes
do merge, o que permitia que código com erro de sintaxe, quebra de build ou
fora do padrão do grupo chegasse às branches principais sem validação.

## 7.2 Testes de Backend (`backend/tests/`)

Testes com `pytest` (+ `pytest-asyncio`) cobrindo a lógica determinística e
os pontos de integração com hardware/rede simulados:

- **`test_orientation_filter.py`** — `ComplementaryFilter`: estado inicial,
  comportamento estacionário, integração pura do giroscópio, fórmula exata
  do filtro complementar e convergência para o ângulo do acelerômetro.
- **`test_velocity_estimator.py`** — `VelocityEstimator`: integração
  leaky-integrator, zeragem por ZUPT após `zupt_min_samples` amostras em
  repouso, reset do contador ao retomar movimento, e remoção de gravidade
  (`_remove_gravity`).
- **`test_sensor_reader.py`** — `SensorReader` com o barramento I2C
  (`smbus2.SMBus`) mockado: calibração de offsets, conversão para unidades
  SI e tratamento de erros ao fechar o barramento.
- **`test_websocket_server.py`** — `WebSocketServer` disparando os eventos
  do Socket.IO diretamente (`_trigger_event`), sem abrir socket real, para
  validar conexão/desconexão e *broadcast* de telemetria.

`sensor_reader.py` e `websocket_server.py` foram testados via mocks porque
dependem de hardware (I2C) e rede; `orientation_filter.py` e
`velocity_estimator.py` são lógica pura e foram testados diretamente, sem
mocks, recebendo `dt` explícito para não depender de `time.time()`.

## 7.3 Testes de Frontend (`front/tests/`)

Testes com `Vitest` + `@testing-library/react` em ambiente `jsdom`:

- **`hooks/usePositionTracker.test.ts`** — integração de posição a partir da
  velocidade linear recebida.
- **`services/websocket.test.ts`** — camada de conexão Socket.IO, com o
  cliente `socket.io-client` mockado (`vi.mock`), cobrindo conexão,
  reconexão e recebimento de eventos.

## 7.4 Workflow de CI (`.github/workflows/ci.yml`)

Dois jobs independentes, disparados em `push` e `pull_request` para as
branches `main` e `develop`:

| Job | Passos |
|-----|--------|
| `backend` | `pip install -r requirements-dev.txt` → `pytest -v` |
| `frontend` | `npm ci` → `npm test` → `npm run build` |

A separação entre `requirements.txt` (produção, instalado na Raspberry Pi)
e `requirements-dev.txt` (adiciona `pytest`/`pytest-asyncio`) evita que o
ambiente embarcado precise instalar dependências de teste — detalhado no
[`README.md`](../README.md#como-rodar-os-testes).

## 7.5 O que fica fora do escopo desta etapa

Da Issue [#12](https://github.com/gabrielsoares01/rpi-digital-twin/issues/12),
permanecem como trabalho futuro:

- Testes de integração frontend-backend com fluxo contínuo real.
- Testes de carga (picos de mensagens, reconexão, perda intermitente).
- Testes de regressão de performance/travamento da UI.

A checagem de lint/formatação (`npm run check`, Biome) também não foi
incluída no workflow: o repositório já possuía débito técnico pré-existente
de formatação fora do escopo desta mudança. A ativação de uma regra de
branch protection em `develop` exigindo os checks `Backend tests` e
`Frontend tests` para permitir merge fica a critério da equipe.
