#!/bin/bash

echo "🚀 Criando a rede Wi-Fi..."
sudo nmcli device wifi hotspot ssid Robo-Network password robopassword ifname wlan0

echo "----------------------------------------"
echo "✅ Rede 'Robo-Network' criada com sucesso!"
echo "📌 O IP da Raspberry Pi é: $(hostname -I | awk '{print $1}')"
echo "----------------------------------------"
