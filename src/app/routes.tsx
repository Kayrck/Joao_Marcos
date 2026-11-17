import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Home } from "./pages/Home";
import { Privacy } from "./pages/Privacy";

// O painel é carregado sob demanda: visitantes do site não baixam nada dele.
const AdminApp = lazy(() => import("./admin/AdminApp"));

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center text-muted-foreground" role="status">
    Carregando…
  </div>
);

export const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/privacidade", Component: Privacy },
  // rota antiga de login → nova rota do painel
  { path: "/login", element: <Navigate to="/admin/login" replace /> },
  {
    path: "/admin/*",
    element: (
      <Suspense fallback={<Loading />}>
        <AdminApp />
      </Suspense>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
