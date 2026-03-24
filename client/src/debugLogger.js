// Debug logger that can't be cleared easily
const DebugLogger = {
  log: function(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry, data);
    
    // Also store in sessionStorage
    const logs = JSON.parse(sessionStorage.getItem('debugLogs') || '[]');
    logs.push({
      timestamp,
      message,
      data: data ? JSON.stringify(data) : null
    });
    
    // Keep only last 50 entries
    if (logs.length > 50) {
      logs.shift();
    }
    
    sessionStorage.setItem('debugLogs', JSON.stringify(logs));
  },
  
  getLogs: function() {
    return JSON.parse(sessionStorage.getItem('debugLogs') || '[]');
  },
  
  clearLogs: function() {
    sessionStorage.removeItem('debugLogs');
  },
  
  showLogs: function() {
    const logs = this.getLogs();
    console.log('=== DEBUG LOGS ===');
    logs.forEach(log => {
      console.log(`[${log.timestamp}] ${log.message}`, log.data ? JSON.parse(log.data) : '');
    });
    console.log('=== END LOGS ===');
    return logs;
  }
};

// Add to window for easy access
if (typeof window !== 'undefined') {
  window.DebugLogger = DebugLogger;
}

export default DebugLogger;
