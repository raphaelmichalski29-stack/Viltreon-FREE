"use client";

import Link from "next/link";
import Image from "next/image";

export function EditorialLanding({ sortedCount }: { sortedCount?: number | null }) {
  return (
    <div className="antialiased min-h-screen flex flex-col relative">
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
        <div className="absolute filter blur-[40px] opacity-50 w-96 h-96 rounded-full bg-[#E5DFD3] top-[-10%] left-[-10%]"></div>
        <div className="absolute filter blur-[40px] opacity-50 w-[500px] h-[500px] rounded-full bg-[#F3EFE9] top-[40%] right-[-10%]"></div>
      </div>

      <header className="w-full max-w-7xl mx-auto px-6 py-8 flex justify-between items-center z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="flex items-center gap-2">
          <span className="font-serif font-semibold text-2xl tracking-tight italic text-[#2C2A28]">Viltreon.</span>
        </div>
        <nav className="hidden md:flex gap-8 items-center text-sm font-medium">
          <a href="#how-it-works" className="hover:underline decoration-[#D86B5A] underline-offset-4 text-[#2C2A28]">How it works</a>
          <a href="#features" className="hover:underline decoration-[#D86B5A] underline-offset-4 text-[#2C2A28]">Features</a>
          <Link href="/pricing" className="hover:underline decoration-[#D86B5A] underline-offset-4 text-[#2C2A28]">Pricing</Link>
        </nav>
        <div className="flex gap-4">
          <Link href="/auth/signin" className="bg-transparent text-[#2C2A28] px-5 py-2 rounded-[30px_8px_25px_12px] font-medium border border-[#2C2A28] hover:bg-[#E5DFD3] transition-all hidden md:inline-block">Sign In</Link>
          <Link href="/auth/signin" className="bg-[#D86B5A] text-white px-5 py-2 rounded-[8px_30px_12px_25px] font-medium hover:-translate-y-0.5 hover:rotate-[-1deg] hover:shadow-[4px_8px_15px_rgba(216,107,90,0.2)] hover:rounded-[25px_12px_30px_8px] transition-all border border-transparent">Get Organized</Link>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center pt-20 pb-32 px-6 relative z-10">
        <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7 flex flex-col items-start animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-100 fill-mode-both">
            <div className="inline-block px-4 py-1 rounded-full bg-[#E5DFD3] text-sm font-medium mb-8 text-[#5A5753]">
              The anti-clutter inbox assistant
            </div>
            <h1 className="font-serif text-5xl md:text-7xl leading-[1.1] text-[#2C2A28] mb-6">
              Stop sorting email.<br/>
              <span className="italic text-[#8A9A86]">Let it sort itself.</span>
            </h1>
            <p className="text-lg md:text-xl text-[#5A5753] max-w-xl mb-10 leading-relaxed">
              Set your rules once in plain English. Every new email is automatically filed into the right folder the moment it arrives.{" "}
              <span className="relative inline-block text-[#2C2A28] font-medium z-10">
                Zero time wasted.
                <svg className="absolute bottom-[-8px] left-0 w-full h-[12px] z-[-1]" viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M0,10 Q25,20 50,10 T100,10" fill="none" stroke="#D86B5A" strokeWidth="3" strokeLinecap="round"/></svg>
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto">
              <Link href="/auth/signin" className="bg-[#D86B5A] text-white text-center text-lg shadow-sm px-8 py-3 rounded-[8px_30px_12px_25px] font-medium hover:-translate-y-0.5 hover:rotate-[-1deg] hover:shadow-[4px_8px_15px_rgba(216,107,90,0.2)] hover:rounded-[25px_12px_30px_8px] transition-all">
                Connect your Gmail
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 relative mt-12 lg:mt-0 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 fill-mode-both">
            <div className="absolute w-[120px] h-[120px] rounded-full border-2 border-dashed border-[#8A9A86] flex items-center justify-center -rotate-12 text-[#8A9A86] font-serif italic text-lg opacity-70 text-center p-2 top-[-30px] right-[-20px] hidden md:flex">
              100%<br/>Automated
            </div>
            <div className="relative w-full aspect-square">
              <div className="absolute top-12 right-0 w-4/5 h-4/5 bg-[#F3EFE9] border-2 border-[#2C2A28] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] transform rotate-3"></div>
              <div className="absolute top-0 left-0 w-[85%] h-[85%] bg-white border-2 border-[#2C2A28] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] shadow-lg p-6 flex flex-col gap-4 transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="flex justify-between items-center border-b border-[#E5DFD3] pb-4">
                  <h3 className="font-serif italic text-xl text-[#2C2A28]">Inbox Rules</h3>
                  <span className="text-xs bg-[#D86B5A] text-white px-2 py-1 rounded-md">Active</span>
                </div>
                <div className="space-y-4 mt-2">
                  <div className="flex items-start gap-3 p-3 bg-[#F9F8F6] rounded-xl border border-[#E5DFD3]">
                    <div className="mt-1 w-2 h-2 rounded-full bg-[#8A9A86] shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-[#2C2A28]">&quot;If it&apos;s a receipt or invoice...&quot;</p>
                      <p className="text-xs text-[#5A5753] mt-1">Move to <strong>Finance/Receipts</strong></p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-[#F9F8F6] rounded-xl border border-[#E5DFD3]">
                    <div className="mt-1 w-2 h-2 rounded-full bg-[#D86B5A] shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-[#2C2A28]">&quot;If it&apos;s an automated newsletter...&quot;</p>
                      <p className="text-xs text-[#5A5753] mt-1">Move to <strong>Read Later</strong></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {sortedCount ? (
          <div className="w-full max-w-5xl mx-auto mt-28 text-center animate-in fade-in duration-1000 fill-mode-both">
            <p className="font-serif text-5xl md:text-6xl text-[#2C2A28]">
              <span className="italic text-[#8A9A86]">{sortedCount.toLocaleString()}</span> emails sorted
            </p>
            <p className="text-[#5A5753] mt-3 text-lg">and counting — each one filed the moment it arrived, never stored.</p>
          </div>
        ) : null}

        <div className="w-full max-w-5xl mx-auto mt-40 mb-20 px-6">
          <h2 className="font-serif text-4xl md:text-5xl text-center mb-16 text-[#2C2A28]">The old way is broken.</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white p-10 border-2 border-[#2C2A28] rounded-[15px_225px_15px_255px/255px_15px_225px_15px] shadow-sm">
              <h3 className="font-serif italic text-2xl mb-4 text-[#D86B5A]">Manual Filtering</h3>
              <ul className="space-y-4 text-[#5A5753]">
                <li className="flex gap-3"><span className="text-[#D86B5A]">×</span> Spend 45 minutes a day dragging emails into folders.</li>
                <li className="flex gap-3"><span className="text-[#D86B5A]">×</span> Create complex Gmail filters that break when senders change.</li>
                <li className="flex gap-3"><span className="text-[#D86B5A]">×</span> Important messages get buried under promotional clutter.</li>
              </ul>
            </div>
            <div className="bg-[#2C2A28] text-[#F9F8F6] p-10 border-2 border-[#2C2A28] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] shadow-xl">
              <h3 className="font-serif italic text-2xl mb-4 text-[#8A9A86]">The Viltreon Way</h3>
              <ul className="space-y-4">
                <li className="flex gap-3"><span className="text-[#8A9A86]">✓</span> Type a single sentence describing what you want.</li>
                <li className="flex gap-3"><span className="text-[#8A9A86]">✓</span> Our AI understands the context of the email immediately.</li>
                <li className="flex gap-3"><span className="text-[#8A9A86]">✓</span> Your inbox is perfectly categorized before you even open the app.</li>
              </ul>
            </div>
          </div>
        </div>

        <div id="features" className="w-full max-w-6xl mx-auto mt-32 pt-20 border-t border-[#E5DFD3]">
          <h2 className="font-serif text-4xl text-center mb-20 text-[#2C2A28]">Thoughtfully designed.</h2>
          <div className="grid md:grid-cols-3 gap-16">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 w-32 h-32 bg-[#F3EFE9] rounded-full flex items-center justify-center p-4">
                <img src="/icon_communication_1780453505692.png" alt="Natural Language" className="w-20 h-20 object-contain mix-blend-multiply" />
              </div>
              <h4 className="font-serif text-2xl mb-4 text-[#2C2A28]">Natural Language</h4>
              <p className="text-[#5A5753] leading-relaxed">No complex filters or boolean logic. Just tell Viltreon how you like your emails organized, like you would explain it to a human assistant.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 w-32 h-32 bg-[#F3EFE9] rounded-full flex items-center justify-center p-4">
                <img src="/icon_privacy_1780453476138.png" alt="Privacy First" className="w-20 h-20 object-contain mix-blend-multiply" />
              </div>
              <h4 className="font-serif text-2xl mb-4 text-[#2C2A28]">Radically Private</h4>
              <p className="text-[#5A5753] leading-relaxed">Viltreon reads a message once, files it, and forgets it. Your email is never stored on our servers, and Viltreon can never send, delete, or compose anything &mdash; only re-label.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 w-32 h-32 bg-[#F3EFE9] rounded-full flex items-center justify-center p-4">
                <img src="/icon_speed_1780453486510.png" alt="Instant Action" className="w-20 h-20 object-contain mix-blend-multiply" />
              </div>
              <h4 className="font-serif text-2xl mb-4 text-[#2C2A28]">Instant Action</h4>
              <p className="text-[#5A5753] leading-relaxed">Every email is sorted the instant it arrives, with zero clicking or filing on your part. Live sorting runs around the clock, so you wake up to a perfectly organized digital life every single morning.</p>
            </div>
          </div>
        </div>

        <div id="how-it-works" className="w-full max-w-4xl mx-auto mt-40">
          <h2 className="font-serif text-4xl md:text-5xl text-center mb-20 text-[#2C2A28]">How it flows.</h2>
          <div className="flex flex-col gap-16 relative">
            <div className="hidden md:block absolute left-12 top-0 bottom-0 w-[1px] bg-[#E5DFD3] z-0"></div>
            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
              <div className="w-24 h-24 shrink-0 bg-white border-2 border-[#D86B5A] rounded-full flex items-center justify-center font-serif text-4xl italic leading-none text-[#D86B5A]"><span className="inline-block -translate-x-[1px] -translate-y-[3px]">1</span></div>
              <div className="pt-4">
                <h3 className="font-serif text-2xl mb-3 text-[#2C2A28]">Connect your account</h3>
                <p className="text-[#5A5753] text-lg">Sign in securely with Google OAuth. We request only the permissions needed to organize your existing labels and apply new ones.</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
              <div className="w-24 h-24 shrink-0 bg-white border-2 border-[#8A9A86] rounded-full flex items-center justify-center font-serif text-4xl italic leading-none text-[#8A9A86]"><span className="inline-block -translate-x-[1px] -translate-y-[3px]">2</span></div>
              <div className="pt-4">
                <h3 className="font-serif text-2xl mb-3 text-[#2C2A28]">Write your rules</h3>
                <p className="text-[#5A5753] text-lg">Use plain English. Say things like <em>&quot;If it looks like a cold sales outreach, put it in the Pitch folder&quot;</em> or <em>&quot;Any receipt goes to Finance.&quot;</em></p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
              <div className="w-24 h-24 shrink-0 bg-[#2C2A28] border-2 border-[#2C2A28] rounded-full flex items-center justify-center font-serif text-4xl italic leading-none text-[#F9F8F6]"><span className="inline-block -translate-x-[1px] -translate-y-[4px]">3</span></div>
              <div className="pt-4">
                <h3 className="font-serif text-2xl mb-3 text-[#2C2A28]">Enjoy the silence</h3>
                <p className="text-[#5A5753] text-lg">Close the dashboard. You never need to open Viltreon again. Your Gmail inbox will magically stay perfectly categorized from now on.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-4xl mx-auto mt-32 bg-[#E5DFD3] p-16 border-2 border-[#2C2A28] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] text-center">
          <h2 className="font-serif text-4xl md:text-5xl mb-6 text-[#2C2A28]">Ready to clear your mind?</h2>
          <p className="text-[#5A5753] text-xl mb-10 max-w-2xl mx-auto">Write your rules once, and never drag an email into a folder again.</p>
          <Link href="/auth/signin" className="bg-[#D86B5A] text-white text-lg px-8 py-4 rounded-[8px_30px_12px_25px] shadow-md hover:-translate-y-0.5 transition-transform inline-block">Start Sorting for Free</Link>
        </div>
      </main>

      <footer className="w-full border-t border-[#E5DFD3] pt-12 pb-8 px-6 mt-20 relative z-10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-2">
            <span className="font-serif font-semibold text-2xl tracking-tight italic text-[#2C2A28]">Viltreon.</span>
            <p className="text-[#5A5753] mt-4 max-w-sm">The calm, anti-clutter inbox assistant for busy professionals.</p>
          </div>
          <div>
            <h5 className="font-medium text-[#2C2A28] mb-4">Product</h5>
            <ul className="space-y-3 text-[#5A5753] text-sm">
              <li><Link href="/pricing" className="hover:text-[#D86B5A]">Pricing</Link></li>
              <li><Link href="/guide" className="hover:text-[#D86B5A]">Sorting Guide</Link></li>
              <li><Link href="/security" className="hover:text-[#D86B5A]">Security</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-[#2C2A28] mb-4">Company</h5>
            <ul className="space-y-3 text-[#5A5753] text-sm">
              <li><Link href="/about" className="hover:text-[#D86B5A]">About</Link></li>
              <li><Link href="/privacy" className="hover:text-[#D86B5A]">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-[#D86B5A]">Terms of Service</Link></li>
              <li><Link href="/cookies" className="hover:text-[#D86B5A]">Cookie Notice</Link></li>
            </ul>
          </div>
        </div>
        <div className="text-center text-sm text-[#5A5753] pt-8 border-t border-[#E5DFD3]">
          <p>&copy; 2026 Viltreon. Designed with intention.</p>
        </div>
      </footer>
    </div>
  );
}
