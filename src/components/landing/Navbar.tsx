import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Frameworks", href: "/#frameworks" },
  { label: "Pricing", href: "/#pricing" },
];

const Navbar = () => {
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-charcoal-900/95 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <span className="text-xl font-extrabold tracking-tight text-white">ZOE</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-white/50 hover:text-white transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
          <div className="flex items-center gap-3">
            {session ? (
              <Link to="/dashboard">
                <Button size="sm" className="bg-terracotta hover:bg-terracotta-600 text-white font-semibold active:scale-[0.97] transition-transform">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10">
                    Log in
                  </Button>
                </Link>
                <Link to="/auth?tab=signup">
                  <Button size="sm" className="bg-terracotta hover:bg-terracotta-600 text-white font-semibold active:scale-[0.97] transition-transform">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-white/70 hover:text-white"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-charcoal-900/98 backdrop-blur-md border-t border-white/5 px-6 pb-6 pt-2 overflow-hidden"
          >
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-sm text-white/50 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-4">
              {session ? (
                <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full bg-terracotta hover:bg-terracotta-600 text-white font-semibold">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full text-white/60 hover:text-white hover:bg-white/10">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/auth?tab=signup" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full bg-terracotta hover:bg-terracotta-600 text-white font-semibold">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
