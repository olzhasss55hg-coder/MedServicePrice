'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[280px] w-full flex flex-col items-center justify-center p-8 bg-slate-900/50 rounded-2xl border border-slate-800 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            {this.props.fallbackTitle || 'Компонентті жүктеу кезінде қате орын алды / Ошибка загрузки блока'}
          </h3>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            {this.state.error?.message || 'Жүйеде уақытша ақаулық орын алды. Бетті қайта жаңартып көріңіз.'}
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium text-sm transition-colors shadow-lg shadow-teal-500/20"
          >
            <RefreshCw className="w-4 h-4" />
            Бетті жаңарту / Обновить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
