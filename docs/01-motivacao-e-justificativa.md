# 1. Motivação e Justificativa

Os acidentes de trânsito envolvendo motociclistas representam uma das principais
causas de trauma grave no transporte urbano. Devido à ausência de uma estrutura
de proteção ao redor do condutor, a rapidez no socorro médico após uma colisão ou
queda é o fator determinante para a sobrevivência e redução de sequelas. No
entanto, em rodovias ou locais isolados, o tempo de resposta pode ser severamente
prejudicado pela incapacidade da vítima de solicitar ajuda.

Projetos e sistemas consolidados na indústria automotiva — como o **eCall**
(sistema europeu de chamada de emergência obrigatório em veículos) e as
funcionalidades de **Detecção de Acidentes (Crash Detection)** presentes em
*smartwatches* e smartphones topo de linha — demonstram a eficiência do uso de
unidades de medição inercial (IMUs) para a identificação automática de impactos e
capotamentos.

## O Protótipo

Este projeto propõe o desenvolvimento de um protótipo IoT compacto de telemetria
inercial e **Gêmeo Digital (Digital Twin)** em tempo real. O dispositivo é fixado ao
veículo/condutor para capturar dados cinemáticos continuamente. A lógica de
detecção baseia-se no padrão cinemático característico de acidentes de
motocicleta:

1. **Pico de aceleração ou desaceleração abrupta** (impacto frontal/lateral ou
   frenagem de emergência);
2. **Queda imediata da velocidade linear** (parada repentina do veículo);
3. **Movimentos angulares caóticos ou inclinação excessiva persistente
   (Roll/Pitch)** que indicam tombo ou rotação anômala do condutor fora da
   posição vertical normal.

Com o processamento desses dados na borda (*edge computing*) via Raspberry Pi e
a transmissão instantânea via WebSocket para um Dashboard com modelo 3D em
tempo real, o sistema demonstra a viabilidade de monitoramento cinemático
contínuo para suporte à decisão e alertas de emergência.
