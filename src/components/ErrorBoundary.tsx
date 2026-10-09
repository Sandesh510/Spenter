import { Component, type ErrorInfo, type ReactNode } from 'react';
import { cache } from '../lib/cache';
import { Button } from './ui/Button';

interface State {
  failed: boolean;
}

/**
 * Catches an error while a screen is drawing, so the user sees a way out instead of a blank page.
 * Reload clears the saved copy of the data first: the usual cause is old cached data that the new
 * version of the app cannot draw. The sign-in stays, so nobody is logged out by this.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  private reload = () => {
    cache.clear();
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="phone error-screen" role="alert">
        <h1 className="heading fs-24 m-0">Something went wrong</h1>
        <p className="fs-14 c-sec m-0">The screen could not be shown. Your entries are safe. Reload to try again.</p>
        <Button size="lg" onClick={this.reload}>Reload</Button>
      </div>
    );
  }
}
