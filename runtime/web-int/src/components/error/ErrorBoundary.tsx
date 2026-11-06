'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Keeps a render crash from becoming a blank page. Nothing is published from this view. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="shell">
        <section className="card">
          <div className="eyebrow">Something went wrong</div>
          <h1>This view could not be shown.</h1>
          <p>Nothing was published. Go back to the workspace and try the action again. If it keeps failing, reload the page.</p>
          <button className="button" type="button" onClick={() => this.setState({ error: null })}>Try again</button>
        </section>
      </main>
    );
  }
}
