import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t py-12" style={{ background: "#1a1714", borderColor: "hsl(24, 14%, 14%)" }}>
    <div className="max-w-6xl mx-auto px-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-8">
        <div>
          <Link to="/" className="flex items-center">
            <span className="text-xl font-extrabold text-white tracking-tight">ZOE</span>
          </Link>
          <p className="mt-3 text-xs text-white/25 max-w-xs">
            Built by writers, for students who can't afford one.
          </p>
        </div>
        <div className="flex gap-12">
          <div>
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Product</p>
            <ul className="space-y-2">
              <li><a href="#features" className="text-sm text-white/25 hover:text-white/50 transition-colors">Features</a></li>
              <li><a href="#pricing" className="text-sm text-white/25 hover:text-white/50 transition-colors">Pricing</a></li>
              <li><a href="#how-it-works" className="text-sm text-white/25 hover:text-white/50 transition-colors">How It Works</a></li>
              <li><a href="#frameworks" className="text-sm text-white/25 hover:text-white/50 transition-colors">Frameworks</a></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Legal</p>
            <ul className="space-y-2">
              <li><Link to="/terms" className="text-sm text-white/25 hover:text-white/50 transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-sm text-white/25 hover:text-white/50 transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-10 pt-6 border-t text-xs text-white/15 text-center" style={{ borderColor: "hsl(24, 14%, 14%)" }}>
        © {new Date().getFullYear()} ZOE. All rights reserved.
        <span className="block mt-1 text-white/8 text-[10px]">v2026.03.22</span>
      </div>
    </div>
  </footer>
);

export default Footer;
