import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../lib/api";


interface LandingPageProps {
  onLoginSuccess?: (token: string, user: { id: string; name: string; email: string }) => void;
}

export function LandingPage({ onLoginSuccess }: LandingPageProps = {}) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth state
  const [step, setStep] = useState<"email" | "signup-details" | "otp">("email");
  const [authType, setAuthType] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email) {
      setAuthError("Please enter your email.");
      return;
    }
    setAuthLoading(true);
    try {
      // Try requesting a login OTP
      await api.post("/auth/request-otp", { email });
      setAuthType("login");
      setStep("otp");
    } catch (err: any) {
      if (err.response?.status === 404) {
        // User not found, proceed to signup
        setAuthType("signup");
        setStep("signup-details");
      } else {
        setAuthError(err.response?.data?.error || "An error occurred.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!name) {
      setAuthError("Please enter your name.");
      return;
    }
    setAuthLoading(true);
    try {
      await api.post("/auth/signup-request", { name, email, phone });
      setStep("otp");
    } catch (err: any) {
      setAuthError(err.response?.data?.error || "An error occurred.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!otp) {
      setAuthError("Please enter the OTP.");
      return;
    }
    setAuthLoading(true);
    try {
      const response = await api.post("/auth/verify-otp", { email, otp, type: authType });
      const { token, user } = response.data;
      if (onLoginSuccess) {
        onLoginSuccess(token, user);
      }
      navigate("/dashboard");
    } catch (err: any) {
      setAuthError(err.response?.data?.error || "Incorrect OTP.");
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {    const handleScroll = () => {
      setScrolled(window.scrollY > 16);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-cream text-nearblack font-sans selection:bg-navy/15 selection:text-navy">
      
      {/* Navigation Header */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "bg-cream/95 backdrop-blur-md border-b border-sand-border py-4" 
          : "bg-cream py-6 border-b border-sand-border/60"
      }`}>
        <div className="max-w-6xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          <Link 
            to="/" 
            onClick={scrollToTop}
            className="flex items-center gap-3 hover:opacity-85 transition-opacity focus:outline-none"
            id="landing-logo-link"
          >
            <div className="h-8 w-8 rounded-lg bg-navy text-white flex items-center justify-center font-display font-semibold text-base">
              S
            </div>
            <span className="font-display font-medium tracking-tight text-nearblack text-xl">SpendSmart</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-normal text-nearblack/80">
            <a href="#problem" className="hover:text-navy transition-colors">The Problem</a>
            <a href="#capabilities" className="hover:text-navy transition-colors">Capabilities</a>
            <a href="#ledger" className="hover:text-navy transition-colors">Architecture</a>
          </nav>

          <div className="hidden md:flex items-center gap-5">
            <a
              href="#login"
              onClick={(e) => {
                e.preventDefault();
                setAuthType("login");
                setStep("email");
                document.getElementById("login")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-sm font-medium text-nearblack/80 hover:text-navy transition-colors"
            >
              Log In
            </a>
            <a
              href="#login"
              onClick={(e) => {
                e.preventDefault();
                setAuthType("signup");
                setStep("signup-details");
                document.getElementById("login")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy-hover rounded-md transition-all shadow-xs"
              id="landing-login-btn"
            >
              Create Account
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-nearblack hover:text-navy focus:outline-none p-1.5"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-cream border-b border-sand-border px-6 pt-3 pb-5 flex flex-col gap-3">
            <a href="#problem" onClick={() => setMobileMenuOpen(false)} className="text-sm text-nearblack/80 py-2 border-b border-sand-border/50">The Problem</a>
            <a href="#capabilities" onClick={() => setMobileMenuOpen(false)} className="text-sm text-nearblack/80 py-2 border-b border-sand-border/50">Capabilities</a>
            <a href="#ledger" onClick={() => setMobileMenuOpen(false)} className="text-sm text-nearblack/80 py-2 border-b border-sand-border/50">Architecture</a>
            <div className="flex flex-col gap-3 pt-2">
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault();
                  setAuthType("login");
                  setStep("email");
                  setMobileMenuOpen(false);
                  document.getElementById("login")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full py-2 text-center text-sm font-medium text-nearblack bg-cream border border-sand-border rounded-md"
              >
                Log In
              </a>
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault();
                  setAuthType("signup");
                  setStep("signup-details");
                  setMobileMenuOpen(false);
                  document.getElementById("login")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full py-2 text-center text-sm font-medium text-white bg-navy rounded-md"
              >
                Create Account
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Editorial Hero Section (Asymmetric layout + Abstract Structural Visual) */}
      <section className="bg-cream pt-16 pb-24 md:pt-24 md:pb-32 border-b border-sand-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Typographic Editorial Hero */}
            <div className="lg:col-span-7 flex flex-col items-start text-left">
              <span className="text-xs font-mono tracking-widest uppercase text-graytext mb-5">
                LEDGER ARCHITECTURE FOR STUDENTS
              </span>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-normal text-nearblack tracking-tight leading-[1.08] mb-6">
                Clear financial records for variable allowances.
              </h1>

              <p className="text-base sm:text-lg text-graytext leading-relaxed font-normal max-w-xl mb-10">
                Most student income arrives irregularly—term transfers, family allowances, or bursary disbursements. SpendSmart maintains an explicit balance ledger without requiring monthly spreadsheet maintenance.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setAuthType("signup");
                    setStep("signup-details");
                    document.getElementById("login")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-medium text-white bg-navy hover:bg-navy-hover rounded-md transition-colors shadow-xs"
                >
                  Create an Account
                  <ArrowRight className="ml-2.5 h-3.5 w-3.5 text-white/70" />
                </button>
                <a
                  href="#capabilities"
                  className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-medium text-nearblack bg-white border border-sand-border hover:border-nearblack/30 rounded-md transition-colors shadow-xs"
                >
                  Review Specifications
                </a>
              </div>

              {/* Minimal metadata strip */}
              <div className="grid grid-cols-3 gap-8 pt-10 mt-10 border-t border-sand-border w-full max-w-md font-mono text-xs">
                <div>
                  <span className="block text-graytext text-[11px]">DATA STORAGE</span>
                  <span className="text-nearblack font-medium">Local &amp; Private</span>
                </div>
                <div>
                  <span className="block text-graytext text-[11px]">INDEX SEARCH</span>
                  <span className="text-nearblack font-medium">Prefix Trie</span>
                </div>
                <div>
                  <span className="block text-graytext text-[11px]">COST</span>
                  <span className="text-nearblack font-medium">$0.00 / Student</span>
                </div>
              </div>
            </div>

            {/* Right Column: Login Form */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end" id="login">
              <div className="w-full max-w-sm bg-white border border-sand-border p-8 rounded-xl shadow-xs">
                <h2 className="text-xl font-display font-medium text-nearblack mb-2">
                  {authType === "signup" ? "Create Account" : "Sign In"}
                </h2>
                <p className="text-xs text-graytext mb-6">
                  {authType === "signup" ? "Set up your personal ledger." : "Access your personal ledger."}
                </p>
                
                {authError && (
                  <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs p-3 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {step === "email" && (
                  <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-nearblack">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2.5 bg-cream/50 border border-sand-border focus:border-navy text-sm rounded-lg outline-none transition-colors"
                        placeholder="student@example.com"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full mt-2 py-3 bg-navy hover:bg-navy-hover text-white text-sm font-medium rounded-lg transition-colors flex justify-center items-center gap-2"
                    >
                      {authLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>
                      ) : (
                        "Continue with Email"
                      )}
                    </button>
                    <div className="mt-4 pt-4 border-t border-sand-border flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthType("signup");
                          setStep("signup-details");
                        }}
                        className="text-xs text-nearblack hover:text-navy hover:underline font-medium text-center"
                      >
                        Don't have an account? Create one
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEmail("student@example.com"); handleEmailSubmit({ preventDefault: () => {} } as any); }}
                        className="text-xs text-navy hover:underline font-medium text-center"
                      >
                        Try Demo Account
                      </button>
                    </div>
                  </form>
                )}

                {step === "signup-details" && (
                  <form onSubmit={handleSignupSubmit} className="flex flex-col gap-4">
                    <div className="text-sm font-medium text-navy bg-cream/50 p-3 rounded-lg border border-sand-border mb-2">
                      Let's set up your account.
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-nearblack">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2.5 bg-cream/50 border border-sand-border focus:border-navy text-sm rounded-lg outline-none transition-colors"
                        placeholder="student@example.com"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-nearblack">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-cream/50 border border-sand-border focus:border-navy text-sm rounded-lg outline-none transition-colors"
                        placeholder="Rahul Sharma"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-nearblack">Phone Number (Optional)</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2.5 bg-cream/50 border border-sand-border focus:border-navy text-sm rounded-lg outline-none transition-colors"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full mt-2 py-3 bg-navy hover:bg-navy-hover text-white text-sm font-medium rounded-lg transition-colors flex justify-center items-center gap-2"
                    >
                      {authLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Sending OTP...</>
                      ) : (
                        "Send OTP"
                      )}
                    </button>
                    <div className="mt-4 pt-4 border-t border-sand-border text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthType("login");
                          setStep("email");
                        }}
                        className="text-xs text-graytext hover:text-navy hover:underline"
                      >
                        Already have an account? Log In
                      </button>
                    </div>
                  </form>
                )}

                {step === "otp" && (
                  <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
                    <div className="text-sm text-graytext mb-2">
                      We've sent a 6-digit verification code to <strong className="text-nearblack">{email}</strong>.
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-nearblack">Verification Code (OTP)</label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full px-3 py-2.5 text-center tracking-widest font-mono font-medium text-lg bg-cream/50 border border-sand-border focus:border-navy rounded-lg outline-none transition-colors"
                        placeholder="000000"
                        maxLength={6}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full mt-2 py-3 bg-navy hover:bg-navy-hover text-white text-sm font-medium rounded-lg transition-colors flex justify-center items-center gap-2"
                    >
                      {authLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                      ) : (
                        "Verify & Sign In"
                      )}
                    </button>
                    <div className="mt-2 text-center">
                      <button
                        type="button"
                        onClick={() => { setStep("email"); setOtp(""); }}
                        className="text-xs text-graytext hover:text-navy underline"
                      >
                        Use a different email
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Why This Exists: The Student Cash Flow Problem (Asymmetric Editorial Section on White) */}
      <section id="problem" className="py-24 bg-white border-b border-sand-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            <div className="lg:col-span-5">
              <span className="text-xs font-mono uppercase tracking-widest text-graytext block mb-3">
                THE PROBLEM
              </span>
              <h2 className="text-3xl sm:text-4xl font-display font-normal text-nearblack tracking-tight leading-[1.15]">
                Why standard spreadsheet models fail student schedules.
              </h2>
            </div>

            <div className="lg:col-span-7 space-y-8 text-sm sm:text-base text-graytext leading-relaxed">
              <p>
                Commercial personal finance tools are built around predictable monthly income. They assume a fixed salary lands on the first of each month and reset envelopes automatically on a rigid 30-day calendar cycle.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="p-5 border border-sand-border rounded-lg bg-cream/30">
                  <h3 className="font-display font-medium text-base text-nearblack mb-2">Irregular Funding Cycles</h3>
                  <p className="text-xs text-graytext leading-relaxed">
                    Student allowances arrive at irregular intervals. When income lands in term lump sums, conventional monthly templates miscalculate daily safe-to-spend limits.
                  </p>
                </div>
                <div className="p-5 border border-sand-border rounded-lg bg-cream/30">
                  <h3 className="font-display font-medium text-base text-nearblack mb-2">Formula Maintenance</h3>
                  <p className="text-xs text-graytext leading-relaxed">
                    Manual spreadsheet registers break over time. Inserting rows, sorting categories, or carrying unspent balances across terms requires constant formula inspection.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Capabilities Section: Understated Factual Specifications */}
      <section id="capabilities" className="py-24 bg-cream border-b border-sand-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          
          <div className="mb-16 max-w-2xl">
            <span className="text-xs font-mono uppercase tracking-widest text-graytext block mb-3">
              SYSTEM CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-display font-normal text-nearblack tracking-tight leading-[1.15]">
              Built for plain record-keeping.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-sand-border border border-sand-border rounded-xl overflow-hidden">
            
            <div className="bg-white p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-navy block mb-4">01 // LEDGER</span>
                <h3 className="font-display font-medium text-xl text-nearblack mb-3">
                  Allowance Carry-Over
                </h3>
                <p className="text-sm text-graytext leading-relaxed">
                  Unspent funds remain in your balance reserves automatically. You do not need to reconcile monthly rollover cells or adjust carry-forward formulas manually.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-sand-border font-mono text-[11px] text-graytext">
                Continuous balance state
              </div>
            </div>

            <div className="bg-white p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-navy block mb-4">02 // SEARCH</span>
                <h3 className="font-display font-medium text-xl text-nearblack mb-3">
                  Prefix Trie Retrieval
                </h3>
                <p className="text-sm text-graytext leading-relaxed">
                  Transactions are indexed by description and category string prefixes. Typing filters entries immediately without linear scanning delays.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-sand-border font-mono text-[11px] text-graytext">
                O(L) character lookup
              </div>
            </div>

            <div className="bg-white p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-navy block mb-4">03 // BUDGETS</span>
                <h3 className="font-display font-medium text-xl text-nearblack mb-3">
                  Category Envelopes
                </h3>
                <p className="text-sm text-graytext leading-relaxed">
                  Configure independent spending limits across up to eight categories. Warnings flag clearly when expenditure crosses eighty percent of an assigned limit.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-sand-border font-mono text-[11px] text-graytext">
                Explicit allocation thresholds
              </div>
            </div>

            <div className="bg-white p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-navy block mb-4">04 // REPORTING</span>
                <h3 className="font-display font-medium text-xl text-nearblack mb-3">
                  Term Expenditure Reports
                </h3>
                <p className="text-sm text-graytext leading-relaxed">
                  Monthly distribution summaries compile categorical spending and aggregate totals over any selected time window without third-party analytics trackers.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-sand-border font-mono text-[11px] text-graytext">
                Local computation
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Full-Bleed Deep Navy Closing CTA Section */}
      <section id="ledger" className="py-24 sm:py-32 bg-navy text-cream relative">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-xs font-mono tracking-widest uppercase text-cream/60 block mb-4">
              PERSONAL LEDGER
            </span>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-normal text-white tracking-tight leading-[1.08] mb-6">
              Start your ledger today.
            </h2>

            <p className="text-base sm:text-lg text-cream/80 leading-relaxed max-w-xl mb-10">
              Free record-keeping designed for students. Local data persistence. No bank account linking required.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <a
                href="#login"
                className="inline-flex items-center justify-center px-8 py-4 text-sm font-medium text-navy bg-white hover:bg-cream rounded-md transition-colors shadow-xs"
              >
                Sign In To Ledger
                <ArrowRight className="ml-2.5 h-4 w-4" />
              </a>
            </div>

            <div className="mt-14 pt-10 border-t border-white/15 flex flex-wrap items-center gap-8 font-mono text-xs text-cream/60">
              <div>ENCRYPTION // STANDARD</div>
              <div>CONNECTIVITY // LOCAL DB</div>
              <div>TERMS // OPEN USE</div>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Minimal Footer */}
      <footer className="bg-white py-10 border-t border-sand-border font-mono text-xs text-graytext">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-medium text-nearblack text-sm">SpendSmart</span>
            <span>•</span>
            <span>Student Ledger v1.2</span>
          </div>
          <div>
            <span>© 2026 SpendSmart</span>
          </div>
        </div>
      </footer>

    </div>
  );
}


