import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import JobDetail from "@/pages/JobDetail";
import Report from "@/pages/Report";
import Templates from "@/pages/Templates";
import Settings from "@/pages/Settings";
import AuditLog from "@/pages/AuditLog";
import Compare from "@/pages/Compare";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/jobs/:id" element={<Layout><JobDetail /></Layout>} />
        <Route path="/jobs/:id/compare" element={<Layout><Compare /></Layout>} />
        <Route path="/jobs/:id/candidates/:candidateId/report" element={<Layout><Report /></Layout>} />
        <Route path="/templates" element={<Layout><Templates /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
        <Route path="/audit" element={<Layout><AuditLog /></Layout>} />
      </Routes>
    </Router>
  );
}
