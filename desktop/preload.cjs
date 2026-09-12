const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mtgDesktop',{
  loadLibrary:()=>ipcRenderer.invoke('library:load'),
  saveLibrary:json=>ipcRenderer.invoke('library:save',json)
});
