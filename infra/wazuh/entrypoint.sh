#!/bin/bash
set -e

# Sustituye el placeholder con la dirección real del manager
sed "s/WAZUH_MANAGER_PLACEHOLDER/${WAZUH_MANAGER}/" \
    /var/ossec/etc/ossec.conf.template \
    > /var/ossec/etc/ossec.conf

# Solo registra si todavía no tiene key (evita "Duplicate agent name" en reinicios)
if [ ! -s /var/ossec/etc/client.keys ]; then
    echo "Registrando agente con el manager..."
    /var/ossec/bin/agent-auth \
        -m "${WAZUH_MANAGER}" \
        -P "${WAZUH_REGISTRATION_PASSWORD}" \
        -A "${WAZUH_AGENT_NAME:-alcaldia-digital}" || true
else
    echo "Agente ya registrado, omitiendo registro."
fi

# Arranca todos los daemons de Wazuh
/var/ossec/bin/wazuh-control start

# Mantiene el contenedor vivo mostrando los logs en stdout
tail -f /var/ossec/logs/ossec.log
