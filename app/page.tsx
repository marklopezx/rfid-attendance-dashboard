"use client";

import Link from "next/link";

export default function IoTSystemsHub() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-blue-200 bg-[url('/campus-bg.jpg')] bg-cover bg-center bg-fixed">
      {/* Warm Frosted Overlay */}
      <div className="absolute inset-0 bg-stone-950/45 backdrop-blur-[4px] z-0"></div>

      <div className="text-center relative z-10 mb-16">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-stone-900/30 backdrop-blur-md border border-amber-100/20 shadow-sm text-amber-50 text-xs font-bold uppercase tracking-widest mb-6">
          Campus IoT Network
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight mb-5 text-white drop-shadow-2xl">
          Integrated Systems Portal
        </h1>
        <p className="text-stone-200 text-base sm:text-lg font-medium max-w-2xl mx-auto leading-relaxed drop-shadow-md font-sans">
          Select a centralized management dashboard to monitor hardware
          telemetry, student attendance, and campus infrastructure in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl w-full relative z-10 font-sans">
        {/* 1. Smart Attendance - Deep Navy/Indigo Theme (Matches Login Page) */}
        <Link
          href="/login"
          className="group bg-[#faf9f6]/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 shadow-2xl hover:shadow-[0_20px_40px_-15px_rgba(30,58,138,0.4)] hover:border-blue-900/50 transition-all duration-300 hover:-translate-y-2 cursor-pointer flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-50 text-blue-900 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner border border-blue-200/50 relative z-10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-9 h-9"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-800 mb-3 relative z-10 group-hover:text-blue-900 transition-colors">
            Smart Attendance
          </h2>
          <p className="text-stone-600 text-sm font-medium leading-relaxed relative z-10">
            RFID-based student registry, live classroom rosters, and automated
            logging.
          </p>
        </Link>

        {/* 2. Equipment Monitoring - Bright Blue Theme (Matches Uploaded Dashboard Button) */}
        <a
          href="https://equipment-tracking.netlify.app"
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-[#faf9f6]/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 shadow-2xl hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.4)] hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-2 cursor-pointer flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-inner border border-blue-200/50 relative z-10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-9 h-9"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-800 mb-3 relative z-10 group-hover:text-blue-600 transition-colors">
            Equipment Tracker
          </h2>
          <p className="text-stone-600 text-sm font-medium leading-relaxed relative z-10">
            RFID inventory logging, asset checkout monitoring, and security
            alerts.
          </p>
        </a>

        {/* 3. Smart Room Occupancy - Teal Theme */}
        <a
          href="https://your-occupancy-url.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-[#faf9f6]/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 shadow-2xl hover:shadow-[0_20px_40px_-15px_rgba(13,148,136,0.3)] hover:border-teal-400 transition-all duration-300 hover:-translate-y-2 cursor-pointer flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-teal-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-50 text-teal-700 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner border border-teal-200/50 relative z-10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-9 h-9"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-800 mb-3 relative z-10 group-hover:text-teal-700 transition-colors">
            Room Occupancy
          </h2>
          <p className="text-stone-600 text-sm font-medium leading-relaxed relative z-10">
            IR beam telemetry for real-time room capacity, flow mapping, and
            lighting.
          </p>
        </a>
      </div>

      <div className="absolute bottom-8 text-center w-full z-10 pointer-events-none">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-300 drop-shadow-md">
          Secured Network Cluster
        </p>
      </div>
    </div>
  );
}
