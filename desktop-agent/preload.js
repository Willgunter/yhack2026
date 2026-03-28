const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    fetchData: (endpoint, options) => ipcRenderer.invoke('fetch-data', endpoint, options)
});
