import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Dashboard } from "./pages/Dashboard";
import { EarnCredits } from "./pages/EarnCredits";
import { SubmitPost } from "./pages/SubmitPost";
import { Campaigns } from "./pages/Campaigns";
import { Analytics } from "./pages/Analytics";
import { Wallet } from "./pages/Wallet";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/NotFound";
import { Login } from "./pages/Login";

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/",
    Component: ProtectedRoute,
    children: [
      {
        Component: Layout,
        children: [
          { index: true, Component: Dashboard },
          { path: "earn", Component: EarnCredits },
          { path: "submit", Component: SubmitPost },
          { path: "campaigns", Component: Campaigns },
          { path: "analytics", Component: Analytics },
          { path: "wallet", Component: Wallet },
          { path: "settings", Component: Settings },
          { path: "*", Component: NotFound },
        ],
      },
    ],
  },
]);