import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
    url: '/auth',
    realm: 'mcp_demo',
    clientId: 'mcp_client'
});

export default keycloak;
