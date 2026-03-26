import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="min-h-screen pt-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <section className="editorial-card overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 sm:p-12">
              <p className="text-xs uppercase tracking-[0.22em] text-[#0F766E] font-semibold">Social Without Noise</p>
              <h1 className="mt-4 text-4xl sm:text-5xl leading-tight font-black text-[#1D232E]">
                Conversations that feel human again.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-[#5B6472] max-w-xl">
                Gossip helps you share, discuss, and discover communities with a cleaner, calmer interface.
                Create posts, join groups, and message people who matter.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="px-6 py-3 rounded-md bg-[#E4572E] text-white font-semibold hover:brightness-95 transition"
                >
                  Create Account
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3 rounded-md border border-[#d8d2c6] bg-[#fffdf8] text-[#1D232E] font-semibold hover:bg-[#f7f2e9] transition"
                >
                  Sign In
                </Link>
              </div>
            </div>
            <div className="relative min-h-[280px] lg:min-h-full">
              <img
                src="https://images.unsplash.com/photo-1517457210348-703079e57d4b?auto=format&fit=crop&w=1400&q=80"
                alt="People talking"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1d232e9c] via-transparent to-transparent" />
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <article className="editorial-card p-5">
            <h2 className="font-bold text-[#1D232E]">Curated Feed</h2>
            <p className="mt-2 text-sm text-[#5B6472]">Pulse, Tribes, and Discover modes keep your timeline useful and fresh.</p>
          </article>
          <article className="editorial-card p-5">
            <h2 className="font-bold text-[#1D232E]">Community-first</h2>
            <p className="mt-2 text-sm text-[#5B6472]">Every group gets identity, cover visuals, and focused discussion spaces.</p>
          </article>
          <article className="editorial-card p-5">
            <h2 className="font-bold text-[#1D232E]">Message Control</h2>
            <p className="mt-2 text-sm text-[#5B6472]">Request-based inbox keeps conversations relevant and protected.</p>
          </article>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;
