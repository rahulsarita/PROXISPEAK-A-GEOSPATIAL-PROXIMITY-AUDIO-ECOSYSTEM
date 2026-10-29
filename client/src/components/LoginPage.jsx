import React, { useState } from "react";
import { ArrowRight, AudioLines, Eye, EyeOff, Headphones, LockKeyhole, Mail, MapPin, Radio, Sparkles, Users } from "lucide-react";
import "./LoginPage.css";

export default function LoginPage({ onContinue }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const handleSubmit = (event) => {
    event.preventDefault();
    // Preview only. Credentials are never authenticated, saved, or sent.
    onContinue?.(email);
  };

  return (
    <main className="px-login">
      <section className="px-login__story">
        <a className="px-login__brand" href="/" aria-label="ProxiSpeak home">
          <span className="px-login__mark"><AudioLines size={21} /></span>
          <span>proxi<span>speak</span></span><small>BETA</small>
        </a>
        <div className="px-login__intro">
          <div className="px-login__eyebrow"><i /> SPATIAL WORKSPACE</div>
          <h1>Your team,<br />in the same <span>space.</span></h1>
          <p>Move closer to a teammate and the conversation follows. A more natural way to work together, wherever you are.</p>
        </div>
        <div className="px-login__map" aria-hidden="true">
          <div className="px-login__grid" />
          <div className="px-login__map-title"><MapPin size={13} /> CREATIVE FLOOR <span>LIVE PREVIEW</span></div>
          <svg viewBox="0 0 560 220" preserveAspectRatio="none"><path d="M64 135C130 135 130 82 205 82s76 70 137 70 65-69 137-69" /><path d="M205 82c0 58 54 91 114 91s88-49 160-49" /></svg>
          <i className="px-login__ring" /><i className="px-login__ring px-login__ring--inner" />
          <b className="px-login__avatar px-login__avatar--a">A</b><b className="px-login__avatar px-login__avatar--b">J</b><b className="px-login__avatar px-login__avatar--c">M</b>
          <b className="px-login__avatar px-login__avatar--you"><Headphones size={17} /></b>
          <div className="px-login__voice"><AudioLines size={14} /> Nearby voice <strong>ON</strong></div>
          <div className="px-login__coords">40.7128 N - 74.0060 W</div>
        </div>
        <div className="px-login__features">
          <div><span><Users size={15} /></span><p><b>Feel the presence</b><small>See who's around you</small></p></div>
          <div><span><Radio size={15} /></span><p><b>Talk naturally</b><small>Audio responds to distance</small></p></div>
          <div className="px-login__tagline"><Sparkles size={14} /> Built for better teamwork</div>
        </div>
      </section>

      <section className="px-login__panel" aria-label="Login preview">
        <div className="px-login__card">
          <div className="px-login__mobile-brand"><span className="px-login__mark"><AudioLines size={20} /></span>proxi<span>speak</span></div>
          <div className="px-login__kicker"><span className="px-login__welcome-copy"><AudioLines size={15} /> WELCOME TO YOUR WORKSPACE</span><span className="px-login__demo-pill"><i /> DEMO PREVIEW</span></div>
          <h2>Good to have you<br />back<span>.</span></h2>
          <p className="px-login__hint">Enter your details to step into your space.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="px-email">Email address</label>
            <div className="px-login__field"><Mail size={17} /><input id="px-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
            <div className="px-login__password-label"><label htmlFor="px-password">Password</label><small><LockKeyhole size={12} /> PRIVATE</small></div>
            <div className="px-login__field">
              <LockKeyhole size={17} />
              <input id="px-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter any demo password" autoComplete="current-password" required />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            <div className="px-login__no-account"><i /> No account needed for this preview</div>
            <button className="px-login__submit" type="submit">Continue to workspace <ArrowRight size={17} /></button>
          </form>
          <div className="px-login__notice"><Sparkles size={15} /><p><b>Frontend preview</b><br />No login request is made. Email prefix becomes your local display name; password is not sent.</p></div>
          <footer><span><i /> YOUR SPACE IS READY</span><span>PROXISPEAK / 2026</span></footer>
        </div>
      </section>
    </main>
  );
}
