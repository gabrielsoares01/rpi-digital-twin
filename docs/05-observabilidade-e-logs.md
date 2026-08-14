# 5. Observabilidade, Logs Estruturados e Painel de Saúde

Resolve a Issue [#15](https://github.com/gabrielsoares01/rpi-digital-twin/issues/15).

## 5.1 Motivação

Até então o sistema não expunha indicadores claros de saúde: eventuais
gargalos de processamento, degradação de rede ou falhas físicas na Raspberry
Pi só eram percebidos indiretamente (ex.: stuttering no dashboard), sem
nenhum log estruturado ou métrica para diagnóstico.

## 5.2 Logs Estruturados no Backend (`backend/logger.py`)

- Substitui as chamadas de `print` por logs estruturados com timestamp,
  nível (`INFO`, `WARNING`, `ERROR`), arquivo e linha de origem.
- `WebSocketLogHandler` transmite os logs gerados no backend em tempo real
  para os clientes Web conectados, sob o evento `"log"`.
- Logs de conexão e de telemetria são associados ao ID de correlação (`sid`
  do Socket.IO) do cliente correspondente, permitindo rastrear o
  comportamento por sessão.

## 5.3 Métricas de Performance e Saúde do Hardware

| Métrica | Origem | Frequência |
|---------|--------|------------|
| CPU / RAM do processo | `/proc/self/status` e `os.times()` (sem dependências extras) | 1 Hz |
| Latência do loop de controle | Tempo de processamento da física da IMU + remoção de gravidade a cada ciclo de 50 Hz (média e pico) | 1 Hz |
| RTT de rede | Ping do frontend a cada 2 s, respondido pelo backend | ~0,5 Hz |

As métricas compiladas são enviadas sob o evento `"system_metrics"`.

## 5.4 Política de Reconexão e Retry no Frontend

Reconexão automática do Socket.IO configurada com backoff exponencial e
jitter: até 20 tentativas, delay entre 1 s e 10 s e fator de randomização de
0,5. Isso cobre quedas de sinal Wi-Fi ou reinicializações do robô sem exigir
recarregar a página.

## 5.5 Painel Visual de Saúde (`/health`)

Nova rota com:

- **Cards de recursos**: indicadores animados de CPU, RAM, latência de
  processamento físico e latência RTT de rede.
- **Console de logs ao vivo**: exibição em tempo real dos logs do backend,
  com filtro por nível (`ALL`/`INFO`/`WARNING`/`ERROR`), busca por texto,
  limpeza de console e auto-scroll.
- **Modo mockado**: painel funcional com dados simulados quando
  `VITE_WS_MOCK=true`, para desenvolvimento sem hardware conectado.

Acesso via o novo item "Saúde" na `Sidebar.tsx`.

## 5.6 Limitações e Próximos Passos

- As métricas não são persistidas: refletem apenas o estado em tempo real,
  sem histórico para análise pós-sessão (ver também
  [issue #18](https://github.com/gabrielsoares01/rpi-digital-twin/issues/18),
  sobre exportação de telemetria).
- Não há alertas automáticos (ex.: threshold de latência) — apenas exibição
  visual dos valores atuais.
