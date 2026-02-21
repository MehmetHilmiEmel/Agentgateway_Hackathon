// src/keycloak.js
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
    url: 'http://localhost:8080',
    realm: 'mcp_demo',
    clientId: 'mcp_client'
});

export default keycloak;