import { Route, Routes } from "react-router-dom";
import GrainOverlay from "./components/GrainOverlay";
import ScrollToTop from "./components/ScrollToTop";
import { ThemeProvider } from "./components/ThemeProvider";
import { BuilderPage } from "./pages/BuilderPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DashboardFormPage } from "./pages/DashboardFormPage";
import { DocsPage } from "./pages/DocsPage";
import { EmbedPage } from "./pages/EmbedPage";
import { HostEmbedTestPage } from "./pages/HostEmbedTestPage";
import LandingPage from "./pages/LandingPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublicViewPage } from "./pages/PublicViewPage";

export function App() {
  return (
    <ThemeProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/dashboard/forms/:formId" element={<DashboardFormPage />} />
        <Route path="/view/:formId" element={<PublicViewPage />} />
        <Route path="/embed/:formId" element={<EmbedPage />} />
        <Route path="/host-embed-test" element={<HostEmbedTestPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <GrainOverlay />
    </ThemeProvider>
  );
}
