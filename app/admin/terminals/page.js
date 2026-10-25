"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TerminalsPage() {
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nowTime, setNowTime] = useState(() => Date.now());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  useEffect(() => {
    let isMounted = true;

    async function fetchTerminals() {
      const { data, error } = await supabase
        .from("active_classes")
        .select("*")
        .order("device_id");

      if (isMounted) {
        if (!error && data) setTerminals(data);
        setLoading(false);
      }
    }

    fetchTerminals();
    const dataInterval = setInterval(fetchTerminals, 3000);
    const timeInterval = setInterval(() => setNowTime(Date.now()), 1000);

    return () => {
      isMounted = false;
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const processedTerminals = useMemo(() => {
    return terminals.map((t) => {
      let isOnline = false;
      if (t.last_seen) {
        let lastSeenTime = new Date(t.last_seen).getTime();
        if (lastSeenTime > nowTime + 3600000)
          lastSeenTime -= 8 * 60 * 60 * 1000;
        const diffSeconds = (nowTime - lastSeenTime) / 1000;
        isOnline = diffSeconds >= -2 && diffSeconds < 18;
      }
      return { ...t, isOnline };
    });
  }, [terminals, nowTime]);

  const filteredTerminals = useMemo(() => {
    return processedTerminals.filter((t) => {
      const deviceName = (t.device_id || "").toLowerCase().replace(/_/g, " ");
      const subject = (t.subject || "").toLowerCase();
      const teacher = (t.teacher_email || "").toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        deviceName.includes(search) ||
        subject.includes(search) ||
        teacher.includes(search);
      const matchesStatus =
        filterStatus === "All" ||
        (filterStatus === "Online" && t.isOnline) ||
        (filterStatus === "Offline" && !t.isOnline) ||
        (filterStatus === "Active" && t.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [processedTerminals, searchTerm, filterStatus]);

  const onlineCount = processedTerminals.filter((t) => t.isOnline).length;
  const offlineCount = processedTerminals.length - onlineCount;
  const activeClassesCount = processedTerminals.filter(
    (t) => t.is_active,
  ).length;

  return (
    <div className="relative overflow-y-auto h-full p-6 sm:p-10 pb-20 font-sans">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-slate-200/40 to-transparent pointer-events-none z-0"></div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider mb-3 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-slate-700"></span>
              Hardware Telemetry Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Hardware Terminals
            </h1>
            <p className="text-slate-500 text-base mt-2 font-medium">
              Real-time monitoring and connection status for all physical ESP32
              RFID room scanners.
            </p>
          </div>
        </div>

        {/* Telemetry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Terminals
              </p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-1.5">
                {processedTerminals.length}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Registered units
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-600 group-hover:scale-105 transition-transform text-xl shadow-2xs">
              📡
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Online Units
              </p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-1.5">
                {onlineCount}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Responding to ping
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-emerald-700 group-hover:scale-105 transition-transform text-xl shadow-2xs">
              🟢
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Offline Units
              </p>
              <h2 className="text-3xl font-extrabold text-rose-800 mt-1.5">
                {offlineCount}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                No recent heartbeat
              </p>
            </div>
            <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 text-rose-700 group-hover:scale-105 transition-transform text-xl shadow-2xs">
              🔴
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Sessions
              </p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-1.5">
                {activeClassesCount}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Classes running now
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-600 group-hover:scale-105 transition-transform text-xl shadow-2xs">
              ⏳
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <input
            type="text"
            placeholder="Search terminal room, subject, or instructor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 outline-none focus:border-slate-400 shadow-inner w-full sm:max-w-md transition-all"
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-400 shadow-sm cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Online">Online Only</option>
            <option value="Offline">Offline Only</option>
            <option value="Active">Active Class Only</option>
          </select>
        </div>

        {/* Terminals Grid */}
        <div>
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400 font-medium shadow-sm">
              Syncing hardware telemetry...
            </div>
          ) : filteredTerminals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400 font-medium shadow-sm">
              No hardware terminals match your filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTerminals.map((t) => (
                <div
                  key={t.device_id}
                  className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between group hover:border-slate-300 transition-all"
                >
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900 truncate max-w-[220px]">
                        {t.device_id.replace(/_/g, " ")}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${t.isOnline ? "bg-emerald-600 animate-pulse" : "bg-rose-700"}`}
                        ></span>
                        <span
                          className={`text-xs font-bold uppercase tracking-widest ${t.isOnline ? "text-emerald-700" : "text-rose-800"}`}
                        >
                          {t.isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-slate-500 group-hover:bg-slate-100 transition-all shadow-2xs">
                      📡
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-5 border-t border-slate-100 text-sm">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Active Session
                      </p>
                      <p
                        className={`font-extrabold truncate ${t.is_active ? "text-slate-900" : "text-slate-400"}`}
                      >
                        {t.is_active ? t.subject : "Standby"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Instructor
                      </p>
                      <p className="font-extrabold text-slate-700 truncate">
                        {t.is_active && t.teacher_email
                          ? t.teacher_email.split("@")[0]
                          : "None"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
