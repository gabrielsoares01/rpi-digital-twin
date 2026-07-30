#!/bin/bash

echo "🚀 Criando a rede Wi-Fi..."
sudo nmcli device wifi hotspot ssid Robo-Network password robopassword ifname wlan0

echo "----------------------------------------"
echo "✅ Rede 'Robo-Network' criada com sucesso!"
echo "📌 O IP da Raspberry Pi é:"
echo "📌 IP do Robô:" $(hostname -I | awk '{print $1}')
echo "----------------------------------------"
echo "⚡ Iniciando a telemetria do robô..."

python3 main.py