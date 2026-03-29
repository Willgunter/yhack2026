const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    fetchData: (endpoint, options) => ipcRenderer.invoke('fetch-data', endpoint, options),
    
    // Native Dashboard Methods
    getDashboardMetrics: () => ipcRenderer.invoke('get-dashboard-metrics'),
    getGovernanceStatus: () => ipcRenderer.invoke('get-governance-status'),
    getRiskAnalysis: () => ipcRenderer.invoke('get-risk-analysis'),
    getAuditLogs: () => ipcRenderer.invoke('get-audit-logs'),
    
    // Native Vault Methods
    listPolicies: () => ipcRenderer.invoke('get-policies-list'),
    selectAndUploadPolicy: () => ipcRenderer.invoke('select-and-ingest-policy'),
    ingestPolicyUrl: (url) => ipcRenderer.invoke('ingest-policy-url', url),
    login: (username, password) => ipcRenderer.invoke('auth-login', { username, password }),

    // Slack Monitor
    slackConnect: () => ipcRenderer.invoke('slack-connect'),
    slackStatus: () => ipcRenderer.invoke('slack-status'),
    slackStartMonitor: () => ipcRenderer.invoke('slack-start-monitor'),
    slackStopMonitor: () => ipcRenderer.invoke('slack-stop-monitor'),
    slackDisconnect: () => ipcRenderer.invoke('slack-disconnect'),
    onSlackMessage: (callback) => ipcRenderer.on('slack-message-analyzed', (event, data) => callback(data))
});
