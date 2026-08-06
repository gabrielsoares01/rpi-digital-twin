# Peer Review — Issues

Resumo das issues abertas para a atividade de peer review: duas issues criadas em repositórios de colegas, e o panorama das issues abertas em nosso próprio repositório (`rpi-digital-twin`).

## 1. Issue criada — WesleyPoli/LabProc-ProjetoFinal #2

**Título:** Alerta sonoro ao detectar obstáculo próximo
**Link:** https://github.com/WesleyPoli/LabProc-ProjetoFinal/issues/2
**Estado:** Aberta

Propõe integrar um buzzer ao carrinho: quando o sensor ultrassônico (HC-SR04) detectar um obstáculo dentro da distância crítica de segurança, o buzzer emite alerta sonoro intermitente (similar a sensor de estacionamento veicular), desligando automaticamente quando o obstáculo se afasta. Reaproveita a leitura de distância já planejada no projeto, sem exigir sensores novos — só um pino GPIO livre e um componente barato.

**Critérios de aceite:** buzzer aciona dentro da distância crítica; desliga ao afastar o obstáculo; não atrasa a parada automática dos motores; não compromete a latência de controle remoto.

## 2. Issue criada — LABPROC2026GA/P2-GA-WorkTrack #2

**Título:** Falta de opção de remoção de usuário
**Link:** https://github.com/LABPROC2026GA/P2-GA-WorkTrack/issues/2
**Estado:** Aberta

Aponta que o sistema não possui funcionalidade para deletar usuários pela aplicação — a única forma hoje é apagando diretamente no banco de dados, o que compromete a manutenção. Propõe um endpoint de exclusão por ID único, com validação de permissões e tratamento de erros (usuário inexistente, tentativa não autorizada), além de registro de auditoria opcional.

**Critérios de aceite:** exclusão por ID; remoção não afeta outros usuários; erros tratados adequadamente; testes cobrindo sucesso, usuário inexistente e acesso não autorizado.

## 3. Feedback recebido de outro grupo — gabrielsoares01/rpi-digital-twin #16

**Título:** Falta de automação no GitHub (CI): risco de subir código com bug ou desconfigurado
**Link:** https://github.com/gabrielsoares01/rpi-digital-twin/issues/16
**Estado:** Aberta

Issue aberta por membros de outro grupo como feedback de peer review, apontando a ausência de um pipeline de CI/CD no repositório. Pede automação para validar formatação, build e testes antes de aprovar merges, reduzindo o risco de subir código com bug ou desconfigurado.

## 4. Issue proposta — gabrielsoares01/rpi-digital-twin #17

**Título:** Exportar histórico de telemetria em CSV
**Link:** https://github.com/gabrielsoares01/rpi-digital-twin/issues/17
**Estado:** Aberta

O dashboard já mantém em memória um histórico recente das leituras de telemetria, usado só para plotar os gráficos em tempo real. Esse dado nunca sai da tela, o que dificulta analisar uma sessão de teste depois. Um botão de exportação resolve isso sem tocar no backend nem adicionar dependências novas.

**Critérios de aceite:** botão exporta o buffer atual de `history` como `.csv`; arquivo inclui cabeçalho com nomes dos campos; botão fica desabilitado/oculto quando não há leituras (`history` vazio); não interfere no fluxo de recebimento de telemetria (WebSocket) nem na renderização do gráfico.

## 5. Issues abertas no nosso repositório — gabrielsoares01/rpi-digital-twin

**Link:** https://github.com/gabrielsoares01/rpi-digital-twin/issues

| # | Título | Labels | Resumo |
|---|--------|--------|--------|
| 17 | Exportar histórico de telemetria em CSV | enhancement | Botão no dashboard para baixar o buffer de leituras (gyro, aceleração, velocidade, orientação, timestamp) já mantido em memória, como arquivo .csv |
| 15 | Adicionar observabilidade (logs/métricas) e recuperação de falhas | enhancement | Propõe logging estruturado, exposição de métricas, políticas de retry/backoff e um dashboard de saúde do sistema |
| 14 | Validar consistência entre requisitos e diagramas de arquitetura | documentation | Pede uma matriz de rastreabilidade ligando requisitos aos componentes de arquitetura e aos testes |
| 13 | Requisitos estão incompletos/ambíguos: detalhar critérios de aceite e NFRs | documentation | Pede critérios de aceite explícitos, requisitos não funcionais mensuráveis e documentação de restrições de hardware |
| 12 | Criação de Testes e Testes Automatizados | enhancement | Pede testes unitários, de integração, de carga e de regressão, automatizados via GitHub Actions |
| 11 | Frontend trava ao receber stream de dados | bug, enhancement | UI trava durante recebimento contínuo de telemetria; sugere debouncing, buffering e profiling para otimização |
| 10 | Feedback 1 | — | Checklist de revisão confirmando conclusão de README, release, motivação, especificações e diagramas de arquitetura |

**Resumo:** 6 issues abertas: a nova #17 propõe exportação de telemetria (CSV), fácil e de curto prazo — reaproveita o buffer de histórico já mantido em `useSensorSocket`/`websocket.ts`, sem exigir mudança no backend. As demais seguem focadas em maturidade de engenharia (observabilidade, testes automatizados) e qualidade de documentação (rastreabilidade requisitos↔arquitetura, critérios de aceite), mais 1 bug de performance no frontend (stream de telemetria travando a UI). A #16 (CI/CD) está listada separadamente na seção 3 por ser feedback de outro grupo, não uma proposta própria. As demais entradas do histórico (#1–#9) são pull requests já mescladas (dashboard mockado, backend de sensores, digital twin 3D, sidebar, hotspot Wi-Fi, correções de stutter/buffer, release da semana 1) e não representam propostas em aberto.
