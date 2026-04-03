import { Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Catalog from "./pages/Catalog";
import AdminGate from "./pages/AdminGate";
import ArticlePage from "./pages/ArticlePage";
import ProductPage from "./pages/ProductPage";
import Cart from "./pages/Cart";
import ResetPasswordPage from "./pages/ResetPassword";
import Account from "./pages/Account";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-card border border-border rounded-2xl p-6">
            <div className="font-display text-xl font-bold mb-3">Ошибка приложения</div>
            <div className="text-sm text-muted-foreground mb-4">
              {this.state.error.message}
            </div>
            <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 rounded-xl p-3 overflow-auto max-h-[45vh]">
              {this.state.error.stack}
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium"
                onClick={() => window.location.reload()}
              >
                Перезагрузить
              </button>
              <button
                className="px-4 py-2 rounded-xl border border-border bg-card font-medium"
                onClick={() => this.setState({ error: null })}
              >
                Скрыть
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/admin" element={<AdminGate />} />
            <Route path="/articles/:slug" element={<ArticlePage />} />
            <Route path="/about" element={<About />} />
            <Route path="/reset" element={<ResetPasswordPage />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
