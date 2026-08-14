# rpi-digital-twin

Sistema Embarcado de Telemetria Inercial e Gêmeo Digital para Detecção
Cinemática de Acidentes.

Repositório para o projeto da disciplina PCS3732 - Laboratório de Processadores.

## Sobre o projeto

Protótipo IoT de telemetria inercial (IMU MPU6050 + Raspberry Pi) com Gêmeo
Digital (Digital Twin) em tempo real, inspirado em sistemas como eCall e Crash
Detection, para identificar padrões cinemáticos característicos de acidentes de
motocicleta (impacto, queda de velocidade e inclinação anômala).

## Documentação

A documentação do projeto está organizada em Markdown na pasta [`docs/`](docs):

1. [Motivação e Justificativa](docs/01-motivacao-e-justificativa.md)
2. [Objetivos](docs/02-objetivos.md)
3. [Requisitos do Sistema](docs/03-requisitos.md)
4. [Arquitetura Proposta](docs/04-arquitetura.md)

## Estrutura do repositório

```
backend/   # Raspberry Pi: leitura do MPU6050, filtro complementar,
           # estimativa de velocidade (ZUPT) e servidor Socket.IO
front/     # Dashboard e Gêmeo Digital 3D (React + Three.js + TanStack Start)
docs/      # Documentação do projeto (motivação, objetivos, requisitos, arquitetura)
```

## Como executar

### Backend (Raspberry Pi)

```bash
cd backend
pip install -r requirements.txt
./iniciar_wifi.sh      # sobe o Hotspot Wi-Fi "Robo-Network"
python3 main.py         # inicia o loop de telemetria (WebSocket na porta 8765)
```

### Frontend

```bash
cd front
npm install
npm run dev
```

## Como rodar os testes

### Backend

`requirements-dev.txt` inclui `requirements.txt` (via `-r requirements.txt`) e
acrescenta `pytest`/`pytest-asyncio`. Essa separação existe para que o
ambiente de produção na Raspberry Pi (`requirements.txt`) não precise instalar
dependências de teste.

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

### Frontend

```bash
cd front
npm install
npm test
```

## Licença

Este projeto está licenciado sob os termos do arquivo [LICENSE](LICENSE).
