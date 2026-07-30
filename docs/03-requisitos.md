# 3. Requisitos do Sistema

## 3.1 Requisitos Funcionais (RF)

| ID | Descrição |
|----|-----------|
| RF01 | O sistema deve ler continuamente os dados brutos de aceleração (3 eixos) e velocidade angular (3 eixos) do MPU6050. |
| RF02 | O sistema embarcado deve calibrar automaticamente os *offsets* (*biases*) dos sensores na inicialização em repouso. |
| RF03 | O sistema deve calcular a orientação espacial (Roll, Pitch e Yaw) em graus utilizando Filtro Complementar. |
| RF04 | O sistema deve estimar a velocidade linear aproximada do protótipo removendo o vetor de gravidade e aplicando ZUPT em momentos de repouso. |
| RF05 | A Raspberry Pi deve atuar como servidor WebSocket/Socket.IO transmitindo o pacote JSON de telemetria na porta 8765 no evento `telemetry`. |
| RF06 | A aplicação Web (Dashboard) deve se conectar à rede Wi-Fi gerada pelo robô/protótipo (Robo-Network) e consumir o evento de telemetria em tempo real. |
| RF07 | A interface Web deve exibir um modelo 3D (Gêmeo Digital) cuja rotação espacial acompanhe os ângulos recebidos sem travar a interface. |
| RF08 | A interface Web deve permitir alternar entre o modo de simulação (Mock) e conexão real com o dispositivo físico. |

## 3.2 Requisitos Não Funcionais (RNF)

| ID | Categoria | Descrição |
|----|-----------|-----------|
| RNF01 | Frequência de Amostragem | O loop principal de amostragem e filtragem na Raspberry Pi deve rodar a uma frequência estável de 50 Hz (período de 20 ms). |
| RNF02 | Latência | A latência média de transmissão via WebSocket no Hotspot local deve ser inferior a 100 ms para garantir fidelidade ao movimento real. |
| RNF03 | Portabilidade / Mobilidade | O módulo embarcado (Raspberry Pi + MPU6050) deve operar alimentado por bateria (Power Bank ou regulador Buck 5V/3A) sem cabos de rede ou força. |
| RNF04 | Confiabilidade I2C | O código Python de leitura deve tratar erros do barramento I2C, descartando quadros ruidosos sem interromper o loop. |
| RNF05 | Suavidade Visual (UI) | A renderização do modelo 3D no Three.js deve utilizar interpolação linear (*lerp*) no loop de animação, evitando re-renders custosos do React a cada pacote do Socket. |
| RNF06 | Autonomia de Rede | O robô/protótipo deve criar sua própria rede Wi-Fi (Hotspot) com IP fixo de gateway (10.42.0.1), dispensando roteadores externos. |
