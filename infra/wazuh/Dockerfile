FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Instala dependencias mínimas + wget
RUN apt-get update && apt-get install -y wget curl lsb-release && rm -rf /var/lib/apt/lists/*

# Descarga e instala el agente Wazuh 4.14.5
RUN wget -q https://packages.wazuh.com/4.x/apt/pool/main/w/wazuh-agent/wazuh-agent_4.14.5-1_amd64.deb \
    && dpkg -i wazuh-agent_4.14.5-1_amd64.deb \
    && rm wazuh-agent_4.14.5-1_amd64.deb

# Copia la configuración personalizada con monitoreo de logs Docker
COPY ossec.conf /var/ossec/etc/ossec.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
