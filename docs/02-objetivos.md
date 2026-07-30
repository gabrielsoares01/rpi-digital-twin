# 2. Objetivos

## 2.1 Objetivo Geral

Desenvolver um sistema embarcado de telemetria inercial e visualização em tempo
real (Gêmeo Digital) capaz de capturar, filtrar e transmitir a cinemática de um
protótipo móvel via Wi-Fi/WebSocket, permitindo o monitoramento de orientação e a
identificação visual de padrões cinemáticos associados a impactos e quedas.

## 2.2 Objetivos Específicos

- **Integração de Hardware:** Conectar e calibrar a unidade de medição inercial
  (IMU MPU6050) ao barramento I2C da Raspberry Pi.
- **Filtragem Cinemática:** Implementar algoritmo de Filtro Complementar para
  estimativa estável de atitude (Roll, Pitch e Yaw) e algoritmo de estimativa de
  velocidade com ZUPT (*Zero Velocity Update*) para atenuação de *drift*.
- **Comunicação sem Fio Autônoma:** Configurar a Raspberry Pi como um Ponto de
  Acesso Wi-Fi (Hotspot) autônomo e disponibilizar um servidor Socket.IO para
  *broadcast* contínuo de dados na porta 8765.
- **Gêmeo Digital e Dashboard:** Desenvolver uma aplicação Web (React + Three.js)
  que consuma a telemetria a 50 Hz e renderize a orientação e movimento do
  protótipo em 3D de forma fluida.
