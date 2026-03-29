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
    
    // RBAC & Remediation
    onGovernanceBreach: (cb) => ipcRenderer.on('governance-breach', (_, alert) => cb(alert)),
    simulateBreach: (user) => ipcRenderer.invoke('simulate-breach', user),
    searchAuditLogs: (query) => ipcRenderer.invoke('search-audit-logs', query),
    triggerRemediation: () => ipcRenderer.send('trigger-remediation'),

    // Slack
    slackConnect: () => ipcRenderer.invoke('slack-connect'),
    slackGetChannels: () => ipcRenderer.invoke('slack-get-channels'),
    slackStatus: () => ipcRenderer.invoke('slack-status'),
    slackStartMonitor: (channelIds) => ipcRenderer.invoke('slack-start-monitor', channelIds),
    slackStopMonitor: () => ipcRenderer.invoke('slack-stop-monitor'),
    slackDisconnect: () => ipcRenderer.invoke('slack-disconnect'),
    onSlackMessage: (cb) => ipcRenderer.on('slack-message-analyzed', (_, data) => cb(data))
});
