import { useState, useEffect } from 'react';
import { Circle, Wifi, WifiOff } from 'lucide-react';
import { auditService } from '@/services/auditService';

export function ServerStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [statusText, setStatusText] = useState('Checking server...');

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkServerStatus = async () => {
    try {
      const health = await auditService.checkHealth();
      setStatus('online');
      setStatusText(`Server online (${health.mode} mode)`);
    } catch (error) {
      setStatus('offline');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      setStatusText(isLocal ? 'Server offline - Start backend' : 'Server temporarily unavailable');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'text-emerald-400';
      case 'offline': return 'text-red-400';
      case 'checking': return 'text-amber-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'online': return <Wifi className="w-4 h-4" />;
      case 'offline': return <WifiOff className="w-4 h-4" />;
      case 'checking': return <Circle className="w-4 h-4 animate-pulse" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border/50">
      <div className={getStatusColor()}>
        {getStatusIcon()}
      </div>
      <span className="text-sm text-muted-foreground">{statusText}</span>
    </div>
  );
}