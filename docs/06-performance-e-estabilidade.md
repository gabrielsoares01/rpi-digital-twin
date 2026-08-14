# 6. Performance e Estabilidade do Frontend

Resolve a Issue [#11](https://github.com/gabrielsoares01/rpi-digital-twin/issues/11).

## 6.1 Motivação

O dashboard e a cena 3D apresentavam travamentos progressivos e engasgos
síncronos ao receber o fluxo contínuo de telemetria a 50 Hz, podendo levar
até à perda de contexto da GPU (`WebGLRenderer: Context Lost`) em sessões
longas de monitoramento.

## 6.2 Agrupamento de Telemetria no Backend (`main.py`)

Em vez de transmitir 50 pacotes por segundo via Socket.IO, o backend agrupa
as leituras da IMU e envia **1 lote com 5 leituras a cada 100 ms (10 Hz)**,
reduzindo em 5x o overhead de rede e da thread de transmissão.

## 6.3 Integração Física sem Perda de Frames (`usePositionTracker.ts`)

O hook de física passou a iterar sequencialmente por todas as leituras de
cada lote recebido (mantendo a resolução de 50 Hz na integração), em vez de
processar apenas a última leitura do lote. Isso elimina "saltos" na
trajetória 3D em caso de atraso de tela e mantém curvas de movimento
suaves.

## 6.4 Gráficos em Canvas em vez de SVG (`dashboard.tsx`)

O Recharts (baseado em SVG) gerava milhares de elementos DOM a cada
atualização, sobrecarregando o Garbage Collector. Foi implementado o
componente `<CanvasLineChart>`, que desenha eixos e linhas diretamente em
HTML5 Canvas 2D (com suporte a alta densidade DPI/Retina), reduzindo o
tempo de processamento dos gráficos para <0,05 ms por frame, sem alocações
de DOM.

## 6.5 Ciclo de Vida do Socket por Rota

A conexão WebSocket passou a ser gerenciada estritamente no nível da rota
(`useEffect` da página), em vez de em cada hook individual. Isso evita
desconexões/reconexões em massa ao navegar entre páginas e garante que, ao
desmontar a rota, a conexão seja encerrada e o histórico local limpo
(isolamento total entre sessões de página).

## 6.6 Renderização de Rastro sem Alocação (`TrailPath.tsx`)

A geração dinâmica de arrays (`.map()` a 10 Hz) para a linha de rastro no
Three.js/Drei foi substituída por buffers tipados estáticos
(`Float32Array`), atualizados via `needsUpdate = true`, eliminando o
overhead de Garbage Collector nesse componente.

## 6.7 Relação com a Arquitetura

Essas mudanças ajustam a frequência de *broadcast* descrita em
[`04-arquitetura.md`](04-arquitetura.md#44-comunicação) de 50 Hz para 10 Hz
no transporte de rede, mantendo a integração física a 50 Hz no cliente — o
RNF01 (amostragem a 50 Hz no backend) continua válido; o que muda é a
granularidade de entrega ao frontend.
