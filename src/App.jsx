import { useState, useEffect, useRef, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from "recharts";

// ─── STYLING CONSTANTS ────────────────────────────────────────────────────────
const C = {
  bg:      "#080a06",
  surface: "#0c100a",
  card:    "#12160e",
  border:  "rgba(200,255,0,0.08)",
  lime:    "#c8ff00",
  cyan:    "#00e5ff",
  red:     "#ff3366",
  amber:   "#ffb020",
  purple:  "#a855f7",
  text:    "#e8f0d8",
  muted:   "#6a7a5a",
  mono:    "'JetBrains Mono', monospace",
  display: "'Bebas Neue', sans-serif",
  body:    "'DM Sans', sans-serif",
};

// ─── DATA GENERATORS ─────────────────────────────────────────────────────────
const rnd  = (a, b) => Math.random() * (b - a) + a;
const rndI = (a, b) => Math.floor(rnd(a, b));

const genSales = () =>
  Array.from({ length: 24 }, (_, i) => ({
    h: `${i}:00`,
    rev:    rndI(8000, 44000),
    orders: rndI(18, 170),
    conv:   parseFloat(rnd(1.8, 9.2).toFixed(1)),
  }));

const genInventory = () => [
  { cat: "Electronics",  stock: rndI(90,  400), thr: 150, turn: parseFloat(rnd(1.2, 4.8).toFixed(1)) },
  { cat: "Apparel",      stock: rndI(60,  600), thr: 100, turn: parseFloat(rnd(0.8, 3.2).toFixed(1)) },
  { cat: "Home & Garden",stock: rndI(180, 800), thr: 200, turn: parseFloat(rnd(0.5, 2.1).toFixed(1)) },
  { cat: "Sports",       stock: rndI(40,  300), thr: 80,  turn: parseFloat(rnd(1.5, 5.0).toFixed(1)) },
  { cat: "Food & Bev",   stock: rndI(260,1200), thr: 400, turn: parseFloat(rnd(4.0,12.0).toFixed(1)) },
];

const genSupport = () => {
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  return days.map(d => ({
    day: d,
    open:      rndI(5,  60),
    resolved:  rndI(10, 80),
    escalated: rndI(0,  15),
    csat:      parseFloat(rnd(3.1, 4.9).toFixed(1)),
  }));
};

const genCash = () => {
  let bal = rndI(80000, 160000);
  return Array.from({ length: 30 }, (_, i) => {
    const inflow  = rndI(5000, 26000);
    const outflow = rndI(4000, 23000);
    bal = Math.max(0, bal + inflow - outflow);
    return { d: `D${i + 1}`, inflow, outflow, bal };
  });
};

const COMPLAINT_TEMPLATES = [
  { category: "Shipping", subject: "Order arrived 2 weeks late", msg: "My order #84221 was supposed to arrive on the 3rd but it's still not here. Very disappointed.", sentiment: "angry" },
  { category: "Product Quality", subject: "Item broken on arrival", msg: "Received a cracked screen protector. This is unacceptable for the price I paid.", sentiment: "angry" },
  { category: "Billing", subject: "Charged twice for same order", msg: "I see two identical charges of $89.99 on my card for order #77412. Please refund one.", sentiment: "frustrated" },
  { category: "Customer Service", subject: "Support agent was rude", msg: "The rep I spoke with yesterday was dismissive and unhelpful. I've been a customer for 3 years.", sentiment: "frustrated" },
  { category: "Returns", subject: "Return portal not working", msg: "Trying to return item from order #91003 but the portal keeps throwing errors. Need a manual RMA.", sentiment: "neutral" },
  { category: "Product Quality", subject: "Missing parts in package", msg: "My electronics kit was missing the power adapter. Order #55682.", sentiment: "frustrated" },
  { category: "Shipping", subject: "Delivered to wrong address", msg: "My neighbor got my package again. This is the second time this has happened.", sentiment: "angry" },
  { category: "Billing", subject: "Promo code not applied", msg: "Used SAVE20 at checkout but the discount wasn't applied. Order #62918.", sentiment: "neutral" },
  { category: "Product Quality", subject: "Item doesn't match description", msg: "Color shown online is completely different from what arrived. Very misleading listing.", sentiment: "frustrated" },
  { category: "Returns", subject: "Refund not received after 14 days", msg: "Sent item back on the 1st, tracking shows delivered, still no refund. Order #34451.", sentiment: "angry" },
];

const NAMES = ["James R.", "Priya M.", "Carlos T.", "Aiko S.", "Linda W.", "Omar F.", "Sophie B.", "David K.", "Nina P.", "Rafael G."];

const genComplaints = () =>
  Array.from({ length: 14 }, (_, i) => {
    const tpl = COMPLAINT_TEMPLATES[i % COMPLAINT_TEMPLATES.length];
    const statuses = ["open", "in_progress", "resolved", "escalated"];
    const priorities = ["low", "medium", "high", "critical"];
    const hoursAgo = rndI(1, 72);
    return {
      id: `CMP-${1000 + i}`,
      name: NAMES[i % NAMES.length],
      email: `customer${i + 1}@email.com`,
      category: tpl.category,
      subject: tpl.subject,
      msg: tpl.msg,
      sentiment: tpl.sentiment,
      status: statuses[rndI(0, statuses.length)],
      priority: priorities[rndI(0, priorities.length)],
      time: hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`,
      rating: rndI(1, 6),
      response: "",
      hoursAgo,
    };
  }).sort((a, b) => a.hoursAgo - b.hoursAgo);

const calcBusinessHealth = (sales, inv, sup, cash, complaints) => {
  const avgRev = sales.slice(-6).reduce((s, d) => s + d.rev, 0) / 6;
  const revScore = Math.min(100, (avgRev / 44000) * 100);
  const lowStock = inv.filter(i => i.stock < i.thr).length;
  const invScore = 100 - (lowStock / inv.length) * 100;
  const lastSup = sup[sup.length - 1] || {};
  const supScore = Math.max(0, 100 - ((lastSup.escalated || 0) / Math.max(1, lastSup.open) * 100) * 3);
  const lastCash = cash[cash.length - 1] || {};
  const cashScore = Math.min(100, (lastCash.bal / 200000) * 100);
  const openComplaints = complaints.filter(c => c.status === "open" || c.status === "escalated").length;
  const complaintScore = Math.max(0, 100 - (openComplaints / complaints.length) * 150);

  const overall = Math.round(
    revScore * 0.28 + cashScore * 0.25 + invScore * 0.18 +
    supScore * 0.14 + complaintScore * 0.15
  );

  return {
    overall,
    breakdown: { revenue: Math.round(revScore), cashflow: Math.round(cashScore), inventory: Math.round(invScore), support: Math.round(supScore), complaints: Math.round(complaintScore) },
    label: overall > 75 ? "THRIVING" : overall > 55 ? "STABLE" : overall > 35 ? "AT RISK" : "CRITICAL",
    color: overall > 75 ? C.lime : overall > 55 ? C.cyan : overall > 35 ? C.amber : C.red,
  };
};

const genAlerts = (sales, inv, sup, cash, complaints) => {
  const out = [];
  const lowStock = inv.filter(i => i.stock < i.thr);
  if (lowStock.length)
    out.push({ type:"crisis", icon:"⚠", title:"Critical Stock Alert", msg:`${lowStock.map(i => i.cat).join(", ")} below reorder threshold`, t:"just now" });
  const lc = cash[cash.length - 1] || {};
  if (lc.bal < 55000)
    out.push({ type:"crisis", icon:"🔴", title:"Cash Flow Crisis", msg:`Balance at $${lc.bal.toLocaleString()} — runway under 30 days`, t:"2m ago" });
  const ls = sup[sup.length - 1] || {};
  if (ls.escalated > 8)
    out.push({ type:"crisis", icon:"🚨", title:"Support Overload", msg:`${ls.escalated} escalated tickets need immediate action`, t:"4m ago" });
  const spike = sales.find(s => s.conv > 7.5);
  if (spike)
    out.push({ type:"opportunity", icon:"🚀", title:"Conversion Spike", msg:`${spike.h} — ${spike.conv}% conversion. Push ad spend now.`, t:"9m ago" });
  const hot = inv.find(i => i.turn > 4);
  if (hot)
    out.push({ type:"opportunity", icon:"💰", title:"Hot Category", msg:`${hot.cat} turnover ${hot.turn}x — run upsell campaign`, t:"14m ago" });
  const critComplaints = complaints.filter(c => c.priority === "critical" && c.status !== "resolved").length;
  if (critComplaints > 0)
    out.push({ type:"crisis", icon:"😡", title:"Critical Complaints", msg:`${critComplaints} unresolved critical customer complaints`, t:"1m ago" });
  const angryUnresolved = complaints.filter(c => c.sentiment === "angry" && c.status === "open").length;
  if (angryUnresolved > 2)
    out.push({ type:"crisis", icon:"🔥", title:"Angry Customers Waiting", msg:`${angryUnresolved} angry customers with no response — act now`, t:"3m ago" });
  return out;
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const mouse = useRef({ x: 0, y: 0 });
  const lag = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = e => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", onMove);
    let id;
    const loop = () => {
      lag.current.x += (mouse.current.x - lag.current.x) * 0.1;
      lag.current.y += (mouse.current.y - lag.current.y) * 0.1;
      if (dot.current) dot.current.style.transform = `translate(${mouse.current.x - 4}px,${mouse.current.y - 4}px)`;
      if (ring.current) ring.current.style.transform = `translate(${lag.current.x - 18}px,${lag.current.y - 18}px)`;
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(id); };
  }, []);
  return <>
    <div ref={dot} style={{ position:"fixed",top:0,left:0,width:8,height:8,background:C.lime,borderRadius:"50%",pointerEvents:"none",zIndex:9999 }} />
    <div ref={ring} style={{ position:"fixed",top:0,left:0,width:36,height:36,border:`1px solid ${C.lime}80`,borderRadius:"50%",pointerEvents:"none",zIndex:9998 }} />
  </>;
}

function LivePreview() {
  const [score, setScore] = useState(74);
  const [rev, setRev] = useState(84320);
  const [tickets, setTickets] = useState(23);
  const [cash, setCash] = useState(124000);
  useEffect(() => {
    const iv = setInterval(() => {
      setScore(s => Math.max(42, Math.min(98, s + rndI(-3, 4))));
      setRev(r => r + rndI(-200, 600));
      setTickets(t => Math.max(8, Math.min(45, t + rndI(-1, 2))));
      setCash(c => c + rndI(-500, 1200));
    }, 2200);
    return () => clearInterval(iv);
  }, []);
  const sc = score > 70 ? C.lime : score > 50 ? C.amber : C.red;
  const sl = score > 70 ? "HEALTHY" : score > 50 ? "MODERATE" : "CRITICAL";
  return (
    <div style={{ width:320,background:"#0b0f08",border:`1px solid ${C.lime}30`,borderRadius:10,overflow:"hidden",boxShadow:"0 40px 100px rgba(0,0,0,0.7)",animation:"float 6s ease-in-out infinite",fontFamily:C.mono }}>
      <div style={{ background:"#060808",padding:"10px 14px",display:"flex",alignItems:"center",gap:6,borderBottom:`1px solid ${C.border}` }}>
        {[C.red,C.amber,C.lime].map(c=><div key={c} style={{ width:8,height:8,borderRadius:"50%",background:c }} />)}
        <span style={{ marginLeft:8,fontSize:10,color:C.muted,letterSpacing:1.5 }}>OPSPULSE · LIVE</span>
        <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:5,fontSize:9,color:C.lime }}>
          <span style={{ width:5,height:5,borderRadius:"50%",background:C.lime,display:"inline-block",animation:"blink 1.5s infinite" }} />STREAMING
        </div>
      </div>
      <div style={{ padding:18 }}>
        <div style={{ textAlign:"center",padding:"18px 0 16px",borderBottom:`1px solid ${C.border}`,marginBottom:16 }}>
          <div style={{ fontSize:9,color:C.muted,letterSpacing:2.5,marginBottom:6 }}>HEALTH SCORE</div>
          <div style={{ fontSize:64,fontWeight:700,color:sc,lineHeight:1,transition:"color 0.6s" }}>{score}</div>
          <div style={{ fontSize:9,color:sc,marginTop:8,letterSpacing:2 }}>● {sl}</div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14 }}>
          {[{l:"REVENUE",v:`$${rev.toLocaleString()}`,c:C.lime},{l:"TICKETS",v:tickets,c:tickets>30?C.red:C.cyan},{l:"CASH",v:`$${Math.round(cash/1000)}k`,c:C.purple},{l:"CSAT",v:"4.2 / 5",c:C.amber}].map(({l,v,c})=>(
            <div key={l} style={{ background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`,borderRadius:5,padding:"10px 10px" }}>
              <div style={{ fontSize:8,color:C.muted,letterSpacing:2,marginBottom:5 }}>{l}</div>
              <div style={{ fontSize:17,fontWeight:700,color:c }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background:`${C.red}18`,border:`1px solid ${C.red}40`,borderRadius:5,padding:"9px 12px",fontSize:10,color:"#ff7090",lineHeight:1.5 }}>
          <span style={{ fontWeight:700,color:C.red }}>⚠ ALERT — </span>Electronics stock below reorder level
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, color, size = 140, label }) {
  const c = color || (score > 70 ? C.lime : score > 45 ? C.amber : C.red);
  const ringLabel = label || (score > 75 ? "THRIVING" : score > 55 ? "STABLE" : score > 35 ? "AT RISK" : "CRITICAL");
  const r = size * 0.37, stroke = size * 0.057, circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",width:size,height:size }}>
      <svg width={size} height={size} style={{ position:"absolute",top:0,left:0,transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition:"all 0.8s" }} />
      </svg>
      <div style={{ textAlign:"center",zIndex:1 }}>
        <div style={{ fontSize:size*0.22,fontWeight:900,color:c,fontFamily:C.mono,lineHeight:1 }}>{score}</div>
        <div style={{ fontSize:size*0.07,color:C.muted,fontFamily:C.mono,marginTop:4,letterSpacing:1 }}>{ringLabel}</div>
      </div>
    </div>
  );
}

function HealthBar({ label, score, color }) {
  const c = color || (score > 70 ? C.lime : score > 45 ? C.amber : C.red);
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
        <span style={{ fontSize:11,color:C.muted,fontFamily:C.mono,letterSpacing:1 }}>{label}</span>
        <span style={{ fontSize:11,fontWeight:700,color:c,fontFamily:C.mono }}>{score}</span>
      </div>
      <div style={{ height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${score}%`,background:c,borderRadius:2,transition:"width 1s ease",boxShadow:`0 0 8px ${c}60` }} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, color, sub }) {
  const pos = String(delta).startsWith("+") || String(delta).includes("↑") || String(delta).toLowerCase().includes("healthy");
  return (
    <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"20px 22px" }}>
      <div style={{ fontSize:10,color:C.muted,marginBottom:8,letterSpacing:1.5,textTransform:"uppercase",fontFamily:C.mono }}>{label}</div>
      <div style={{ fontSize:26,fontWeight:800,color:color||C.text,fontFamily:C.mono }}>{value}</div>
      {delta && <div style={{ fontSize:11,color:pos?C.lime:C.red,marginTop:6,fontFamily:C.mono }}>{delta}</div>}
      {sub && <div style={{ fontSize:11,color:C.muted,marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function AlertItem({ a }) {
  const c = a.type==="crisis"?C.red:a.type==="opportunity"?C.lime:C.amber;
  return (
    <div style={{ background:`${c}08`,border:`1px solid ${c}30`,borderRadius:8,padding:"12px 14px",display:"flex",gap:10 }}>
      <span style={{ fontSize:18 }}>{a.icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
          <span style={{ fontSize:12,fontWeight:700,color:c }}>{a.title}</span>
          <span style={{ fontSize:10,color:C.muted,fontFamily:C.mono }}>{a.t}</span>
        </div>
        <p style={{ fontSize:12,color:C.muted,lineHeight:1.5 }}>{a.msg}</p>
      </div>
    </div>
  );
}

const sentimentConfig = {
  angry:      { color: C.red,   icon: "😡", label: "ANGRY" },
  frustrated: { color: C.amber, icon: "😤", label: "FRUSTRATED" },
  neutral:    { color: C.muted, icon: "😐", label: "NEUTRAL" },
  happy:      { color: C.lime,  icon: "😊", label: "HAPPY" },
};
const priorityConfig = {
  critical: { color: C.red,    label: "CRITICAL" },
  high:     { color: C.amber,  label: "HIGH" },
  medium:   { color: C.cyan,   label: "MEDIUM" },
  low:      { color: C.muted,  label: "LOW" },
};
const statusConfig = {
  open:        { color: C.red,    label: "OPEN" },
  in_progress: { color: C.amber,  label: "IN PROGRESS" },
  resolved:    { color: C.lime,   label: "RESOLVED" },
  escalated:   { color: C.purple, label: "ESCALATED" },
};

function ComplaintsTab({ complaints, setComplaints }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [response, setResponse] = useState("");
  const [search, setSearch] = useState("");

  const filtered = complaints.filter(c => {
    const matchFilter = filter === "all" || c.status === filter || c.priority === filter || c.sentiment === filter;
    const matchSearch = !search || c.subject.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const stats = {
    open: complaints.filter(c=>c.status==="open").length,
    escalated: complaints.filter(c=>c.status==="escalated").length,
    resolved: complaints.filter(c=>c.status==="resolved").length,
    angry: complaints.filter(c=>c.sentiment==="angry").length,
    avgRating: (complaints.reduce((s,c)=>s+c.rating,0)/complaints.length).toFixed(1),
  };

  const catBreakdown = Object.entries(
    complaints.reduce((acc, c) => { acc[c.category] = (acc[c.category]||0)+1; return acc; }, {})
  ).sort((a,b)=>b[1]-a[1]);

  const handleUpdateStatus = (id, newStatus) => {
    setComplaints(prev => prev.map(c => c.id === id ? {...c, status: newStatus} : c));
    if (selected?.id === id) setSelected(prev => ({...prev, status: newStatus}));
  };

  const handleSendResponse = () => {
    if (!response.trim() || !selected) return;
    setComplaints(prev => prev.map(c => c.id === selected.id ? {...c, response, status: c.status === "open" ? "in_progress" : c.status} : c));
    setSelected(prev => ({...prev, response, status: prev.status === "open" ? "in_progress" : prev.status}));
    setResponse("");
  };

  const AIResponses = {
    angry: "Dear Customer, I sincerely apologize for the frustration this has caused. I'm personally escalating your case to our senior support team and will ensure this is resolved within 24 hours. As a gesture of goodwill, I'd like to offer you a 20% discount on your next order.",
    frustrated: "Hi there, I completely understand your frustration and I'm sorry for the inconvenience. I've reviewed your case and I'm taking immediate action to resolve this. You'll receive an update within 4 business hours.",
    neutral: "Hello, thank you for reaching out to us. I've reviewed your case and I'm happy to assist. I'll have this resolved for you shortly. Please don't hesitate to reach out if you need anything further.",
  };

  const filterOptions = ["all","open","in_progress","resolved","escalated","angry","frustrated","critical","high"];

  return (
    <div style={{ display:"grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap:24 }}>
      <div>
        {/* Stats row */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20 }}>
          {[
            {l:"OPEN",v:stats.open,c:C.red},
            {l:"ESCALATED",v:stats.escalated,c:C.purple},
            {l:"RESOLVED",v:stats.resolved,c:C.lime},
            {l:"ANGRY",v:stats.angry,c:C.red},
            {l:"AVG RATING",v:`${stats.avgRating}★`,c:C.amber},
          ].map(({l,v,c})=>(
            <div key={l} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",textAlign:"center" }}>
              <div style={{ fontSize:9,color:C.muted,letterSpacing:2,fontFamily:C.mono,marginBottom:6 }}>{l}</div>
              <div style={{ fontSize:22,fontWeight:800,color:c,fontFamily:C.mono }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16 }}>
          {catBreakdown.map(([cat,count])=>(
            <div key={cat} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ fontSize:12,color:C.text }}>{cat}</span>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ width:60,height:3,background:"rgba(255,255,255,0.06)",borderRadius:2 }}>
                  <div style={{ height:"100%",width:`${(count/complaints.length)*100}%`,background:C.lime,borderRadius:2 }} />
                </div>
                <span style={{ fontSize:11,color:C.lime,fontFamily:C.mono,fontWeight:700 }}>{count}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
        <div style={{ display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center" }}>
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search complaints..."
            style={{ flex:1,minWidth:160,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:4,padding:"8px 12px",color:C.text,fontSize:12,fontFamily:C.body,outline:"none" }}
          />
          {filterOptions.map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              style={{ padding:"6px 12px",borderRadius:4,border:`1px solid ${filter===f?C.lime:C.border}`,background:filter===f?`${C.lime}18`:"transparent",color:filter===f?C.lime:C.muted,fontSize:10,fontFamily:C.mono,letterSpacing:1,cursor:"none",transition:"all 0.2s" }}>
              {f.toUpperCase().replace("_"," ")}
            </button>
          ))}
        </div>

        {/* Complaint list */}
        <div style={{ display:"flex",flexDirection:"column",gap:8,maxHeight:480,overflowY:"auto" }}>
          {filtered.map(c=>(
            <div key={c.id} onClick={()=>{setSelected(c);setResponse(c.response||"");}}
              style={{ background:selected?.id===c.id?`${C.lime}08`:C.surface,border:`1px solid ${selected?.id===c.id?C.lime+"40":C.border}`,borderRadius:8,padding:"14px 16px",cursor:"none",transition:"all 0.2s" }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6,gap:8,flexWrap:"wrap" }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:16 }}>{sentimentConfig[c.sentiment]?.icon||"😐"}</span>
                  <div>
                    <div style={{ fontSize:12,fontWeight:700,color:C.text }}>{c.name}</div>
                    <div style={{ fontSize:10,color:C.muted }}>{c.email}</div>
                  </div>
                </div>
                <div style={{ display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" }}>
                  <span style={{ padding:"2px 7px",borderRadius:3,background:`${priorityConfig[c.priority]?.color}18`,border:`1px solid ${priorityConfig[c.priority]?.color}40`,color:priorityConfig[c.priority]?.color,fontSize:9,fontFamily:C.mono }}>{priorityConfig[c.priority]?.label}</span>
                  <span style={{ padding:"2px 7px",borderRadius:3,background:`${statusConfig[c.status]?.color}18`,border:`1px solid ${statusConfig[c.status]?.color}40`,color:statusConfig[c.status]?.color,fontSize:9,fontFamily:C.mono }}>{statusConfig[c.status]?.label}</span>
                  <span style={{ fontSize:10,color:C.muted,fontFamily:C.mono }}>{c.time}</span>
                </div>
              </div>
              <div style={{ fontSize:12,fontWeight:600,color:C.lime,marginBottom:4 }}>{c.subject}</div>
              <div style={{ fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{c.msg}</div>
              <div style={{ display:"flex",gap:8,marginTop:8,alignItems:"center" }}>
                <span style={{ fontSize:10,color:C.cyan,background:`${C.cyan}15`,border:`1px solid ${C.cyan}30`,padding:"2px 8px",borderRadius:3,fontFamily:C.mono }}>{c.category}</span>
                <span style={{ fontSize:10,color:C.amber }}>{"★".repeat(c.rating)}{"☆".repeat(5-c.rating)}</span>
                {c.response && <span style={{ fontSize:10,color:C.lime }}>✓ Responded</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign:"center",padding:"60px 0",color:C.muted,fontFamily:C.mono,fontSize:12 }}>
              NO COMPLAINTS MATCH YOUR FILTER
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:24,position:"sticky",top:20,height:"fit-content",maxHeight:"85vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
            <span style={{ fontFamily:C.mono,fontSize:12,color:C.lime }}>{selected.id}</span>
            <button onClick={()=>setSelected(null)} style={{ background:"none",border:"none",color:C.muted,fontSize:18,cursor:"none" }}>×</button>
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
            <div style={{ width:44,height:44,background:`${C.lime}18`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>
              {sentimentConfig[selected.sentiment]?.icon}
            </div>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:C.text }}>{selected.name}</div>
              <div style={{ fontSize:11,color:C.muted }}>{selected.email}</div>
              <div style={{ fontSize:10,color:sentimentConfig[selected.sentiment]?.color,fontFamily:C.mono,marginTop:2 }}>
                {sentimentConfig[selected.sentiment]?.label}
              </div>
            </div>
          </div>

          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:16 }}>
            <div style={{ fontSize:13,fontWeight:700,color:C.lime,marginBottom:8 }}>{selected.subject}</div>
            <p style={{ fontSize:12,color:C.text,lineHeight:1.7 }}>{selected.msg}</p>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16 }}>
            {[
              {l:"Category",v:selected.category},
              {l:"Priority",v:priorityConfig[selected.priority]?.label,c:priorityConfig[selected.priority]?.color},
              {l:"Status",v:statusConfig[selected.status]?.label,c:statusConfig[selected.status]?.color},
              {l:"Received",v:selected.time},
            ].map(({l,v,c})=>(
              <div key={l} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px" }}>
                <div style={{ fontSize:9,color:C.muted,letterSpacing:1.5,fontFamily:C.mono,marginBottom:4 }}>{l.toUpperCase()}</div>
                <div style={{ fontSize:12,fontWeight:700,color:c||C.text }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Rating */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10,color:C.muted,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>CUSTOMER RATING</div>
            <div style={{ fontSize:20,color:C.amber }}>{"★".repeat(selected.rating)}{"☆".repeat(5-selected.rating)}</div>
          </div>

          {/* Status actions */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10,color:C.muted,fontFamily:C.mono,letterSpacing:1.5,marginBottom:8 }}>UPDATE STATUS</div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {Object.entries(statusConfig).map(([k,{color,label}])=>(
                <button key={k} onClick={()=>handleUpdateStatus(selected.id, k)}
                  style={{ padding:"6px 12px",borderRadius:4,border:`1px solid ${selected.status===k?color:C.border}`,background:selected.status===k?`${color}25`:"transparent",color:selected.status===k?color:C.muted,fontSize:10,fontFamily:C.mono,cursor:"none",transition:"all 0.2s" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Suggested response */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10,color:C.muted,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>AI SUGGESTED RESPONSE</div>
            <button onClick={()=>setResponse(AIResponses[selected.sentiment]||AIResponses.neutral)}
              style={{ width:"100%",padding:"10px 14px",background:`${C.cyan}12`,border:`1px solid ${C.cyan}35`,borderRadius:6,color:C.cyan,fontSize:11,fontFamily:C.mono,cursor:"none",textAlign:"left" }}>
              ✦ USE AI TEMPLATE FOR {(sentimentConfig[selected.sentiment]?.label||"NEUTRAL").toUpperCase()} CUSTOMER
            </button>
          </div>

          {/* Response textarea */}
          <div>
            <div style={{ fontSize:10,color:C.muted,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>YOUR RESPONSE</div>
            <textarea
              value={response} onChange={e=>setResponse(e.target.value)}
              placeholder="Type your response..."
              style={{ width:"100%",height:110,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:6,padding:12,color:C.text,fontSize:12,fontFamily:C.body,outline:"none",resize:"none",boxSizing:"border-box" }}
            />
            <button onClick={handleSendResponse}
              style={{ width:"100%",marginTop:8,padding:"12px",background:response.trim()?C.lime:"rgba(200,255,0,0.1)",border:"none",borderRadius:6,color:response.trim()?C.bg:C.muted,fontSize:12,fontWeight:800,fontFamily:C.mono,cursor:"none",transition:"all 0.3s" }}>
              {selected.response ? "UPDATE RESPONSE ↑" : "SEND RESPONSE →"}
            </button>
          </div>

          {selected.response && (
            <div style={{ marginTop:16,background:`${C.lime}08`,border:`1px solid ${C.lime}30`,borderRadius:8,padding:14 }}>
              <div style={{ fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>✓ SENT RESPONSE</div>
              <p style={{ fontSize:12,color:C.text,lineHeight:1.6 }}>{selected.response}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BusinessHealthTab({ health, sales, inv, sup, cash, complaints }) {
  const radarData = [
    { subject:"Revenue",    A: health.breakdown.revenue },
    { subject:"Cash Flow",  A: health.breakdown.cashflow },
    { subject:"Inventory",  A: health.breakdown.inventory },
    { subject:"Support",    A: health.breakdown.support },
    { subject:"Complaints", A: health.breakdown.complaints },
  ];

  const catComplaintData = Object.entries(
    complaints.reduce((acc,c)=>{ acc[c.category]=(acc[c.category]||0)+1; return acc; },{})
  ).map(([name,value])=>({name,value}));

  const complaintTrend = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>({
    d, open:rndI(3,15), resolved:rndI(5,18)
  }));

  const getHealthAdvice = () => {
    const advice = [];
    if (health.breakdown.revenue < 50) advice.push({ icon:"📉", color:C.red, text:"Revenue is underperforming. Consider launching a flash sale or activating abandoned-cart campaigns." });
    if (health.breakdown.cashflow < 50) advice.push({ icon:"🏦", color:C.red, text:"Cash flow is dangerously low. Review outgoing expenses and delay non-critical purchases." });
    if (health.breakdown.inventory < 60) advice.push({ icon:"📦", color:C.amber, text:"Multiple SKUs below reorder threshold. Place emergency POs to avoid stockouts." });
    if (health.breakdown.support < 65) advice.push({ icon:"🎧", color:C.amber, text:"Support load is elevated. Consider enabling chatbot auto-responses for Tier-1 queries." });
    if (health.breakdown.complaints < 60) advice.push({ icon:"😡", color:C.red, text:"High volume of unresolved complaints. Prioritize angry customers first to prevent churn." });
    if (advice.length === 0) advice.push({ icon:"✅", color:C.lime, text:"Business is operating in healthy parameters across all dimensions. Maintain current trajectory." });
    return advice;
  };

  return (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24 }}>
      <div>
        <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:20,letterSpacing:0.5 }}>HEALTH DIMENSION RADAR</h3>
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20,marginBottom:20 }}>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="subject" tick={{fill:C.muted,fontSize:11,fontFamily:C.mono}} />
              <Radar name="Health" dataKey="A" stroke={health.color} fill={health.color} fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:14,letterSpacing:0.5 }}>DIMENSION SCORES</h3>
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20 }}>
          {Object.entries(health.breakdown).map(([k,v])=>(
            <HealthBar key={k} label={k.toUpperCase().replace("_"," ")} score={v} />
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:20,letterSpacing:0.5 }}>OVERALL BUSINESS STATUS</h3>
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:24,marginBottom:20,textAlign:"center" }}>
          <div style={{ display:"flex",justifyContent:"center",marginBottom:16 }}>
            <ScoreRing score={health.overall} color={health.color} size={160} />
          </div>
          <div style={{ fontFamily:C.display,fontSize:28,color:health.color,letterSpacing:2 }}>{health.label}</div>
          <div style={{ fontSize:12,color:C.muted,fontFamily:C.mono,marginTop:6 }}>COMPOSITE HEALTH INDEX</div>
        </div>

        <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:14,letterSpacing:0.5 }}>COMPLAINT CATEGORIES</h3>
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20,marginBottom:20 }}>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={catComplaintData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9,fontFamily:C.mono}} width={90} />
              <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontFamily:C.mono,fontSize:11}} />
              <Bar dataKey="value" fill={C.red} radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:14,letterSpacing:0.5 }}>ACTION ADVISORIES</h3>
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {getHealthAdvice().map((a,i)=>(
            <div key={i} style={{ background:`${a.color}08`,border:`1px solid ${a.color}30`,borderRadius:8,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start" }}>
              <span style={{ fontSize:18,flexShrink:0 }}>{a.icon}</span>
              <p style={{ fontSize:12,color:C.text,lineHeight:1.6,margin:0 }}>{a.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RevenueTab({ sales }) {
  const weeklyData = Array.from({length:7},(_,i)=>({
    day:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i],
    rev:rndI(40000,180000), orders:rndI(80,400), conv:parseFloat(rnd(2.1,8.4).toFixed(1))
  }));
  return (
    <div>
      <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:20 }}>24H REVENUE STREAM</h3>
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20,marginBottom:24 }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={sales}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.lime} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={C.lime} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="h" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
            <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontFamily:C.mono,fontSize:11}} />
            <Area type="monotone" dataKey="rev" stroke={C.lime} fillOpacity={1} fill="url(#gRev)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24 }}>
        <div>
          <h3 style={{ fontFamily:C.display,fontSize:20,marginBottom:14 }}>ORDERS PER HOUR</h3>
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20 }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sales}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="h" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:8}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
                <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontFamily:C.mono,fontSize:11}} />
                <Bar dataKey="orders" fill={C.cyan} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h3 style={{ fontFamily:C.display,fontSize:20,marginBottom:14 }}>CONVERSION RATE %</h3>
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20 }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={sales}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="h" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:8}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
                <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontFamily:C.mono,fontSize:11}} />
                <Line type="monotone" dataKey="conv" stroke={C.purple} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function CashFlowTab({ cash }) {
  return (
    <div>
      <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:20 }}>30-DAY CASH POSITION</h3>
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20,marginBottom:24 }}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={cash}>
            <defs>
              <linearGradient id="gBal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.purple} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
            <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontFamily:C.mono,fontSize:11}} />
            <Area type="monotone" dataKey="bal" stroke={C.purple} fillOpacity={1} fill="url(#gBal)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20 }}>
        <h3 style={{ fontFamily:C.display,fontSize:20,marginBottom:14 }}>INFLOW vs OUTFLOW</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={cash.slice(-14)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
            <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontFamily:C.mono,fontSize:11}} />
            <Bar dataKey="inflow" fill={C.lime} radius={[3,3,0,0]} />
            <Bar dataKey="outflow" fill={C.red} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function InventoryTab({ inv }) {
  return (
    <div>
      <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:20 }}>INVENTORY OVERVIEW</h3>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14,marginBottom:24 }}>
        {inv.map(item=>{
          const pct = Math.min(100,(item.stock/Math.max(item.thr*2,item.stock))*100);
          const c = item.stock < item.thr ? C.red : item.stock < item.thr * 1.5 ? C.amber : C.lime;
          return (
            <div key={item.cat} style={{ background:C.surface,border:`1px solid ${item.stock<item.thr?C.red+"40":C.border}`,borderRadius:10,padding:16 }}>
              <div style={{ fontSize:11,fontWeight:700,color:C.text,marginBottom:10 }}>{item.cat}</div>
              <div style={{ height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,marginBottom:8,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${pct}%`,background:c,borderRadius:3,transition:"width 1s" }} />
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ fontSize:11,color:C.muted,fontFamily:C.mono }}>Stock</span>
                <span style={{ fontSize:13,fontWeight:700,color:c,fontFamily:C.mono }}>{item.stock}</span>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ fontSize:11,color:C.muted,fontFamily:C.mono }}>Threshold</span>
                <span style={{ fontSize:11,color:C.muted,fontFamily:C.mono }}>{item.thr}</span>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between" }}>
                <span style={{ fontSize:11,color:C.muted,fontFamily:C.mono }}>Turnover</span>
                <span style={{ fontSize:11,color:C.cyan,fontFamily:C.mono }}>{item.turn}x</span>
              </div>
              {item.stock < item.thr && (
                <div style={{ marginTop:10,background:`${C.red}18`,border:`1px solid ${C.red}40`,borderRadius:4,padding:"5px 8px",fontSize:9,color:C.red,fontFamily:C.mono,textAlign:"center" }}>⚠ BELOW THRESHOLD</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20 }}>
        <h3 style={{ fontFamily:C.display,fontSize:20,marginBottom:14 }}>STOCK LEVELS COMPARISON</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={inv}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="cat" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
            <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontFamily:C.mono,fontSize:11}} />
            <Bar dataKey="stock" name="Stock" fill={C.lime} radius={[3,3,0,0]} />
            <Bar dataKey="thr" name="Threshold" fill={C.red} radius={[3,3,0,0]} fillOpacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SupportTab({ sup }) {
  return (
    <div>
      <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:20 }}>WEEKLY SUPPORT METRICS</h3>
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20,marginBottom:24 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sup}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:11}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
            <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontFamily:C.mono,fontSize:11}} />
            <Bar dataKey="open" name="Open" fill={C.amber} radius={[3,3,0,0]} />
            <Bar dataKey="resolved" name="Resolved" fill={C.lime} radius={[3,3,0,0]} />
            <Bar dataKey="escalated" name="Escalated" fill={C.red} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10 }}>
        {sup.map(d=>(
          <div key={d.day} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 10px",textAlign:"center" }}>
            <div style={{ fontSize:10,color:C.muted,fontFamily:C.mono,marginBottom:10 }}>{d.day}</div>
            <div style={{ fontSize:18,fontWeight:700,color:C.lime,fontFamily:C.mono }}>{d.resolved}</div>
            <div style={{ fontSize:9,color:C.muted,fontFamily:C.mono }}>RESOLVED</div>
            <div style={{ fontSize:13,fontWeight:700,color:C.amber,fontFamily:C.mono,marginTop:8 }}>{d.open}</div>
            <div style={{ fontSize:9,color:C.muted,fontFamily:C.mono }}>OPEN</div>
            {d.escalated>0 && <>
              <div style={{ fontSize:13,fontWeight:700,color:C.red,fontFamily:C.mono,marginTop:8 }}>{d.escalated}</div>
              <div style={{ fontSize:9,color:C.red,fontFamily:C.mono }}>ESC</div>
            </>}
            <div style={{ marginTop:10,fontSize:11,color:C.cyan }}>{d.csat}★</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NEW: OPERATIONS MANAGER SPECIFIC OVERVIEW ──────────────────────────────────

function OpsOverview({ alerts, inv, complaints, onTriggerWarRoom }) {
  // Filter alerts: show only Crisis and Anomaly (Opportunities are for Owners/Growth)
  const opsAlerts = alerts.filter(a => a.type === "crisis" || a.type === "anomaly");
  
  // Tactical Data (Simulated for real-time feel)
  const backlog = useMemo(() => rndI(140, 320), []);
  const velocity = useMemo(() => rndI(90, 155), []);
  const rma = useMemo(() => rndI(15, 55), []);
  const frt = `${rndI(1, 3)}m ${rndI(10, 59)}s`;
  const unassigned = complaints.filter(c => c.status === "open").length;
  const stagnantCount = inv.filter(i => i.turn < 1.4).length;
  const apiPing = useMemo(() => rndI(80, 450), []);
  
  const apiStatus = [
    { name: "Shopify API", status: "green", detail: "99.9% Uptime" },
    { name: "Stripe Gateway", status: "green", detail: "0.04% Error Rate" },
    { name: "ShipStation", status: apiPing > 350 ? "yellow" : "green", detail: `${apiPing}ms Latency` },
    { name: "Zendesk", status: "green", detail: "Active" }
  ];

  return (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:24 }}>
      {/* COLUMN 1: STRESS & CRITICAL FEED */}
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20, textAlign:"center" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ fontFamily:C.display, fontSize:18, color:C.text, margin:0 }}>FULFILLMENT STRESS</h3>
            <span style={{ fontSize:9, color:C.red, fontWeight:800, fontFamily:C.mono, border:`1px solid ${C.red}`, padding:"2px 6px", borderRadius:4 }}>ZONE 4</span>
          </div>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
            <ScoreRing score={84} color={C.amber} size={140} />
          </div>
          <button onClick={onTriggerWarRoom} style={{ width:"100%", padding:"14px", background:`${C.red}15`, border:`1px solid ${C.red}`, borderRadius:8, color:C.red, fontFamily:C.mono, fontSize:11, fontWeight:900, cursor:"none", transition:"0.3s" }}>
            ⚠ MANUAL WAR ROOM OVERRIDE
          </button>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:10 }}>
          <h3 style={{ fontFamily:C.display, fontSize:20 }}>CRISIS FEED</h3>
          <span style={{ fontSize:9, color:C.muted, fontFamily:C.mono }}>LIVE TELEMETRY</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:320, overflowY:"auto" }}>
          {opsAlerts.length > 0 ? opsAlerts.map((a, i) => <AlertItem key={i} a={a} />) : (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted, fontFamily:C.mono, fontSize:12 }}>
              ✓ ALL TACTICAL SYSTEMS NOMINAL
            </div>
          )}
          {/* Simulated anomaly flag since it's in the requirement */}
          <div style={{ background:`${C.amber}08`, border:`1px dashed ${C.amber}40`, borderRadius:8, padding:"12px 14px", display:"flex", gap:10 }}>
            <span style={{ fontSize:18 }}>⚙</span>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.amber }}>Anomaly: Checkout Latency</span>
                <span style={{ fontSize:10, color:C.muted, fontFamily:C.mono }}>4m ago</span>
              </div>
              <p style={{ fontSize:11, color:C.muted }}>Elevated database locks detected in US-EAST-1 cluster.</p>
            </div>
          </div>
        </div>
      </div>

      {/* COLUMN 2: THE PHYSICAL PIPELINE */}
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <h3 style={{ fontFamily:C.display, fontSize:20 }}>PHYSICAL PIPELINE</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
            <div style={{ fontSize:9, color:C.muted, fontFamily:C.mono, marginBottom:6 }}>ORDER BACKLOG</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.amber }}>{backlog}</div>
            <div style={{ fontSize:9, color:C.muted, marginTop:4 }}>Unfulfilled units</div>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
            <div style={{ fontSize:9, color:C.muted, fontFamily:C.mono, marginBottom:6 }}>THROUGHPUT (HR)</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.lime }}>{velocity} <span style={{fontSize:10, color:C.muted, fontWeight:400}}>pkgs</span></div>
            <div style={{ fontSize:9, color:C.lime, marginTop:4 }}>↑ 12% vs goal</div>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
            <div style={{ fontSize:9, color:C.muted, fontFamily:C.mono, marginBottom:6 }}>RMA / RETURNS</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.cyan }}>{rma}</div>
            <div style={{ fontSize:9, color:C.muted, marginTop:4 }}>In queue</div>
          </div>
          <div style={{ background:C.card, border:`2px dashed ${stagnantCount>0?C.red+"50":C.border}`, borderRadius:8, padding:14 }}>
            <div style={{ fontSize:9, color:C.muted, fontFamily:C.mono, marginBottom:6 }}>STAGNANT SKUs</div>
            <div style={{ fontSize:22, fontWeight:700, color:stagnantCount>0?C.red : C.lime }}>{stagnantCount}</div>
            <div style={{ fontSize:9, color:C.muted, marginTop:4 }}>Slow moving items</div>
          </div>
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
          <div style={{ fontSize:10, color:C.muted, fontFamily:C.mono, marginBottom:14 }}>DYNAMIC DEPLETION RUNWAY</div>
          {inv.slice(0, 3).map((item, i) => (
            <div key={i} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:11, color:C.text }}>{item.cat}</span>
                <span style={{ fontSize:11, fontFamily:C.mono, color:item.stock < item.thr ? C.red : C.lime }}>
                  {item.stock < item.thr ? `⚠ ${rndI(2, 8)}h to stockout` : `✓ ${rndI(4, 9)}d runway`}
                </span>
              </div>
              <div style={{ height:4, background:"#000", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100, (item.stock/item.thr)*50)}%`, background:item.stock < item.thr ? C.red : C.lime, transition:"1s" }} />
              </div>
            </div>
          ))}
        </div>

        <h3 style={{ fontFamily:C.display, fontSize:20, marginTop:8 }}>FRONTLINE HEALTH</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
            <div style={{ fontSize:9, color:C.muted, fontFamily:C.mono, marginBottom:6 }}>WAIT TIME (FRT)</div>
            <div style={{ fontSize:20, fontWeight:700, color:C.lime }}>{frt}</div>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
            <div style={{ fontSize:9, color:C.muted, fontFamily:C.mono, marginBottom:6 }}>UNASSIGNED</div>
            <div style={{ fontSize:20, fontWeight:700, color:unassigned > 5 ? C.red : C.lime }}>{unassigned} <span style={{fontSize:9, color:C.muted}}>tickets</span></div>
          </div>
        </div>
        
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
          <div style={{ fontSize:10, color:C.muted, fontFamily:C.mono, marginBottom:10 }}>WISMO KEYWORD TRACKER</div>
          <div style={{ height:40, display:"flex", alignItems:"flex-end", gap:2, marginBottom:8 }}>
            {[12,18,15,11,10,14,22,45,68,82,75,90].map((h, i) => (
              <div key={i} style={{ flex:1, height:`${h}%`, background:i > 6 ? C.red : C.lime, borderRadius:"1px 1px 0 0" }} />
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:C.red, animation:"blink 1s infinite" }} />
            <span style={{ fontSize:10, color:C.text, fontFamily:C.mono }}>SPIKE DETECTED — "Where is my order" +420%</span>
          </div>
        </div>
      </div>

      {/* COLUMN 3: DIGITAL PLUMBING */}
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <h3 style={{ fontFamily:C.display, fontSize:20 }}>DIGITAL PLUMBING</h3>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
          <div style={{ fontSize:10, color:C.muted, fontFamily:C.mono, marginBottom:15 }}>API UPTIME & INTEGRATIONS</div>
          {apiStatus.map((api, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ width:10, height:10, borderRadius:"50%", background:api.status === "green" ? C.lime : api.status === "yellow" ? C.amber : C.red, boxShadow:`0 0 10px ${api.status === "green" ? C.lime : api.status === "yellow" ? C.amber : C.red}60` }} />
                <span style={{ fontSize:12, color:C.text, fontWeight:500 }}>{api.name}</span>
              </div>
              <span style={{ fontSize:10, fontFamily:C.mono, color:C.muted }}>{api.detail}</span>
            </div>
          ))}
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
          <div style={{ fontSize:10, color:C.muted, fontFamily:C.mono, marginBottom:14 }}>ERROR TELEMETRY</div>
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:6 }}>
              <span style={{ color:C.text }}>Webhook Success</span>
              <span style={{ color:C.lime, fontFamily:C.mono }}>99.98%</span>
            </div>
            <div style={{ height:3, background:"rgba(255,255,255,0.05)", borderRadius:1 }}>
              <div style={{ height:"100%", width:"99.98%", background:C.lime }} />
            </div>
          </div>
          <div style={{ marginBottom:4 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:6 }}>
              <span style={{ color:C.text }}>Payment Gateway Err</span>
              <span style={{ color:C.cyan, fontFamily:C.mono }}>0.04%</span>
            </div>
            <div style={{ height:3, background:"rgba(255,255,255,0.05)", borderRadius:1 }}>
              <div style={{ height:"100%", width:"4%", background:C.cyan }} />
            </div>
          </div>
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:18 }}>
          <div style={{ fontSize:10, color:C.muted, fontFamily:C.mono, marginBottom:12 }}>LIVE SENTIMENT (LAST 50 TICKETS)</div>
          <div style={{ display:"flex", gap:3, height:24, borderRadius:4, overflow:"hidden", marginBottom:10 }}>
            <div style={{ flex:65, background:C.lime }} title="Positive: 65%" />
            <div style={{ flex:20, background:C.muted }} title="Neutral: 20%" />
            <div style={{ flex:15, background:C.red }} title="Negative: 15%" />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, fontFamily:C.mono }}>
            <span style={{ color:C.lime }}>POS 65%</span>
            <span style={{ color:C.muted }}>NEU 20%</span>
            <span style={{ color:C.red }}>NEG 15%</span>
          </div>
        </div>

        <div style={{ background:`${C.cyan}08`, border:`1px dashed ${C.cyan}40`, borderRadius:8, padding:14, textAlign:"center" }}>
          <div style={{ fontSize:10, color:C.cyan, fontFamily:C.mono, marginBottom:6 }}>ANOMALY DETECTION</div>
          <span style={{ fontSize:11, color:C.muted }}>Pattern scanning active in checkout flows...</span>
          <div style={{ display:"flex", justifyContent:"center", gap:4, marginTop:8 }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ width:10, height:2, background:C.cyan, opacity:0.2+ (i*0.15) }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────

function Onboarding({ onComplete }) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("retail");
  return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:10 }}>
      <div style={{ position:"fixed",inset:0,background:`${C.bg}E0`,backdropFilter:"blur(20px)" }} />
      <div style={{ position:"relative",width:440,background:C.card,border:`1px solid ${C.lime}30`,borderRadius:12,padding:48,boxShadow:"0 20px 80px rgba(0,0,0,0.5)" }}>
        <h2 style={{ fontFamily:C.display,fontSize:32,color:C.text,marginBottom:8,letterSpacing:1 }}>HELLO, OPERATOR.</h2>
        <p style={{ fontSize:13,color:C.muted,marginBottom:32,fontFamily:C.mono }}>INITIALIZING YOUR COMMAND CONSOLE...</p>
        <div style={{ marginBottom:24 }}>
          <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:8 }}>COMPANY NAME</label>
          <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. ACME CORP"
            style={{ width:"100%",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:4,padding:"12px 16px",color:C.text,fontSize:15,fontFamily:C.body,outline:"none",boxSizing:"border-box" }} />
        </div>
        <div style={{ marginBottom:40 }}>
          <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:8 }}>INDUSTRY VERTICAL</label>
          <select value={industry} onChange={e=>setIndustry(e.target.value)}
            style={{ width:"100%",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:4,padding:"12px 16px",color:C.text,fontSize:15,fontFamily:C.body,outline:"none" }}>
            <option value="retail">E-COMMERCE / RETAIL</option>
            <option value="saas">SaaS / SOFTWARE</option>
            <option value="logistics">LOGISTICS / DELIVERY</option>
            <option value="fintech">FINTECH / PAYMENTS</option>
          </select>
        </div>
        <button onClick={()=>name&&onComplete({name,industry})}
          style={{ width:"100%",padding:"18px",background:name?C.lime:"rgba(200,255,0,0.2)",border:"none",borderRadius:6,color:name?C.bg:C.muted,fontSize:14,fontWeight:800,fontFamily:C.mono,cursor:"none",transition:"all 0.3s",letterSpacing:1 }}>
          CONFIRM & LAUNCH →
        </button>
      </div>
    </div>
  );
}

// ─── AUTHENTICATION ───────────────────────────────────────────────────────────

function Auth({ onAuthenticated, onBack }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const nxt = {};
    if (!email.trim()) nxt.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nxt.email = "Enter a valid email";
    if (!password) nxt.password = "Password is required";
    else if (password.length < 8) nxt.password = "Password must be at least 8 characters";
    if (mode === "signup") {
      if (!name.trim()) nxt.name = "Name is required";
      if (!confirm) nxt.confirm = "Please confirm password";
      else if (confirm !== password) nxt.confirm = "Passwords do not match";
    }
    setErrors(nxt);
    return Object.keys(nxt).length === 0;
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!validate()) return;
    let finalName = name;
    if (mode === "login" || !finalName.trim()) {
      const base = email.split("@")[0] || "User";
      finalName = base
        .split(/[.\-_]/)
        .filter(Boolean)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
    }
    onAuthenticated({ name: finalName, email: email.trim() });
  };

  return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,position:"relative",zIndex:10 }}>
      <div style={{ position:"fixed",inset:0,background:`${C.bg}F2`,backdropFilter:"blur(18px)" }} />
      <div style={{ position:"relative",width:460,maxWidth:"94vw",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:32,boxShadow:"0 24px 90px rgba(0,0,0,0.7)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:26,height:26,background:C.lime,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>⬡</div>
            <span style={{ fontFamily:C.display,fontSize:22,letterSpacing:2 }}>OPS<span style={{ color:C.lime }}>PULSE</span></span>
          </div>
          <button onClick={onBack} style={{ fontSize:11,color:C.muted,background:"transparent",border:"none",fontFamily:C.mono,cursor:"none" }}>
            ← Back
          </button>
        </div>
        <div style={{ display:"flex",marginBottom:18,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,padding:3 }}>
          {["login","signup"].map(m=>(
            <button
              key={m}
              onClick={()=>{setMode(m);setErrors({});}}
              style={{
                flex:1,
                padding:"10px 0",
                border:"none",
                borderRadius:6,
                background:mode===m?C.lime:"transparent",
                color:mode===m?C.bg:C.muted,
                fontSize:13,
                fontFamily:C.mono,
                fontWeight:700,
                cursor:"none"
              }}
            >
              {m==="login"?"Login":"Sign up"}
            </button>
          ))}
        </div>
        <div style={{ marginBottom:18 }}>
          <h2 style={{ fontFamily:C.display,fontSize:30,margin:0 }}>
            {mode==="login" ? "Welcome back." : "Create your console."}
          </h2>
          <p style={{ fontSize:12,color:C.muted,marginTop:8,fontFamily:C.mono }}>
            {mode==="login"
              ? "Log in to continue to your OpsPulse dashboard."
              : "Spin up your OpsPulse workspace in a few seconds."}
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          {mode==="signup" && (
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
                FULL NAME
              </label>
              <input
                value={name}
                onChange={e=>setName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                style={{
                  width:"100%",
                  background:"rgba(255,255,255,0.03)",
                  border:`1px solid ${errors.name?C.red:C.border}`,
                  borderRadius:5,
                  padding:"10px 12px",
                  color:C.text,
                  fontSize:13,
                  fontFamily:C.body,
                  outline:"none"
                }}
              />
              {errors.name && <div style={{ fontSize:11,color:C.red,marginTop:4 }}>{errors.name}</div>}
            </div>
          )}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
              WORK EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{
                width:"100%",
                background:"rgba(255,255,255,0.03)",
                border:`1px solid ${errors.email?C.red:C.border}`,
                borderRadius:5,
                padding:"10px 12px",
                color:C.text,
                fontSize:13,
                fontFamily:C.body,
                outline:"none"
              }}
            />
            {mode==="login" && email && (
              <div style={{ fontSize:11,color:C.muted,marginTop:4,fontFamily:C.mono }}>
                Signing in as{" "}
                <span style={{ color:C.cyan }}>
                  {email.split("@")[0] || "User"}
                </span>
              </div>
            )}
            {errors.email && <div style={{ fontSize:11,color:C.red,marginTop:4 }}>{errors.email}</div>}
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              style={{
                width:"100%",
                background:"rgba(255,255,255,0.03)",
                border:`1px solid ${errors.password?C.red:C.border}`,
                borderRadius:5,
                padding:"10px 12px",
                color:C.text,
                fontSize:13,
                fontFamily:C.body,
                outline:"none"
              }}
            />
            {errors.password && <div style={{ fontSize:11,color:C.red,marginTop:4 }}>{errors.password}</div>}
          </div>
          {mode==="signup" && (
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e=>setConfirm(e.target.value)}
                placeholder="Repeat password"
                style={{
                  width:"100%",
                  background:"rgba(255,255,255,0.03)",
                  border:`1px solid ${errors.confirm?C.red:C.border}`,
                  borderRadius:5,
                  padding:"10px 12px",
                  color:C.text,
                  fontSize:13,
                  fontFamily:C.body,
                  outline:"none"
                }}
              />
              {errors.confirm && <div style={{ fontSize:11,color:C.red,marginTop:4 }}>{errors.confirm}</div>}
            </div>
          )}
          <button
            type="submit"
            style={{
              width:"100%",
              padding:"14px",
              marginTop:6,
              background:C.lime,
              border:"none",
              borderRadius:6,
              color:C.bg,
              fontSize:14,
              fontWeight:800,
              fontFamily:C.mono,
              cursor:"none",
              letterSpacing:1
            }}
          >
            {mode==="login" ? "Continue →" : "Create account →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── SETUP WIZARD (3 STEPS) ───────────────────────────────────────────────────

function SetupWizard({ user, onComplete, onBack }) {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("retail");
  const [revenue, setRevenue] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [warehouses, setWarehouses] = useState("");
  const [challenge, setChallenge] = useState("");
  const [integrations, setIntegrations] = useState({
    shopify: false,
    stripe: false,
    shipstation: false,
    zendesk: false
  });
  const [role, setRole] = useState("owner");

  const toggleIntegration = key => {
    setIntegrations(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNext = () => {
    if (step === 1 && !companyName.trim()) return;
    if (step === 3) {
      onComplete({
        name: companyName.trim(),
        industry,
        revenue,
        teamSize,
        warehouses,
        challenge,
        integrations: Object.keys(integrations).filter(k => integrations[k]),
        role
      });
    } else {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      onBack();
    } else {
      setStep(s => s - 1);
    }
  };

  const stepLabel = step === 1 ? "Company basics" : step === 2 ? "Integrations" : "Your role";

  return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,position:"relative",zIndex:10 }}>
      <div style={{ position:"fixed",inset:0,background:`${C.bg}F0`,backdropFilter:"blur(18px)" }} />
      <div style={{ position:"relative",width:720,maxWidth:"96vw",background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:32,boxShadow:"0 24px 90px rgba(0,0,0,0.7)",display:"grid",gridTemplateColumns:"2fr 1.4fr",gap:28 }}>
        <div>
          <button onClick={handleBack} style={{ fontSize:11,color:C.muted,background:"transparent",border:"none",fontFamily:C.mono,marginBottom:14,cursor:"none" }}>
            ← Back
          </button>
          <h2 style={{ fontFamily:C.display,fontSize:30,marginBottom:6 }}>Setup wizard.</h2>
          <p style={{ fontSize:12,color:C.muted,marginBottom:18,fontFamily:C.mono }}>
            Step {step} of 3 · {stepLabel}
          </p>
          {step === 1 && (
            <div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
                  COMPANY NAME
                </label>
                <input
                  value={companyName}
                  onChange={e=>setCompanyName(e.target.value)}
                  placeholder="e.g. Mercury Supply Co."
                  style={{
                    width:"100%",
                    background:"rgba(255,255,255,0.03)",
                    border:`1px solid ${companyName?C.border:C.red+"60"}`,
                    borderRadius:5,
                    padding:"10px 12px",
                    color:C.text,
                    fontSize:13,
                    fontFamily:C.body,
                    outline:"none"
                  }}
                />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
                  INDUSTRY
                </label>
                <select
                  value={industry}
                  onChange={e=>setIndustry(e.target.value)}
                  style={{
                    width:"100%",
                    background:"rgba(255,255,255,0.03)",
                    border:`1px solid ${C.border}`,
                    borderRadius:5,
                    padding:"10px 12px",
                    color:C.text,
                    fontSize:13,
                    fontFamily:C.body,
                    outline:"none"
                  }}
                >
                  <option value="retail">E-commerce / Retail</option>
                  <option value="saas">SaaS / Software</option>
                  <option value="logistics">Logistics / Warehousing</option>
                  <option value="marketplace">Marketplace</option>
                </select>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16 }}>
                <div>
                  <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
                    ANNUAL REVENUE
                  </label>
                  <input
                    value={revenue}
                    onChange={e=>setRevenue(e.target.value)}
                    placeholder="$2M"
                    style={{
                      width:"100%",
                      background:"rgba(255,255,255,0.03)",
                      border:`1px solid ${C.border}`,
                      borderRadius:5,
                      padding:"10px 12px",
                      color:C.text,
                      fontSize:13,
                      fontFamily:C.body,
                      outline:"none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
                    OPS TEAM SIZE
                  </label>
                  <input
                    value={teamSize}
                    onChange={e=>setTeamSize(e.target.value)}
                    placeholder="e.g. 8"
                    style={{
                      width:"100%",
                      background:"rgba(255,255,255,0.03)",
                      border:`1px solid ${C.border}`,
                      borderRadius:5,
                      padding:"10px 12px",
                      color:C.text,
                      fontSize:13,
                      fontFamily:C.body,
                      outline:"none"
                    }}
                  />
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18 }}>
                <div>
                  <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
                    WAREHOUSES
                  </label>
                  <input
                    value={warehouses}
                    onChange={e=>setWarehouses(e.target.value)}
                    placeholder="e.g. 2 US, 1 EU"
                    style={{
                      width:"100%",
                      background:"rgba(255,255,255,0.03)",
                      border:`1px solid ${C.border}`,
                      borderRadius:5,
                      padding:"10px 12px",
                      color:C.text,
                      fontSize:13,
                      fontFamily:C.body,
                      outline:"none"
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display:"block",fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>
                  BIGGEST OPERATIONS CHALLENGE
                </label>
                <textarea
                  value={challenge}
                  onChange={e=>setChallenge(e.target.value)}
                  placeholder="e.g. Late deliveries, overselling, high support volume..."
                  style={{
                    width:"100%",
                    height:80,
                    background:"rgba(255,255,255,0.03)",
                    border:`1px solid ${C.border}`,
                    borderRadius:5,
                    padding:"10px 12px",
                    color:C.text,
                    fontSize:13,
                    fontFamily:C.body,
                    outline:"none",
                    resize:"none",
                    boxSizing:"border-box"
                  }}
                />
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <p style={{ fontSize:12,color:C.muted,marginBottom:16,fontFamily:C.mono }}>
                Optional: tell us which tools you use. OpsPulse will mirror this in the dashboard.
              </p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                {[
                  { key:"shopify", label:"Shopify" },
                  { key:"stripe", label:"Stripe" },
                  { key:"shipstation", label:"ShipStation" },
                  { key:"zendesk", label:"Zendesk" }
                ].map(opt=>(
                  <button
                    key={opt.key}
                    type="button"
                    onClick={()=>toggleIntegration(opt.key)}
                    style={{
                      padding:"12px 14px",
                      borderRadius:8,
                      border:`1px solid ${integrations[opt.key]?C.lime:C.border}`,
                      background:integrations[opt.key]?`${C.lime}18`:C.surface,
                      color:integrations[opt.key]?C.lime:C.text,
                      fontSize:13,
                      display:"flex",
                      justifyContent:"space-between",
                      alignItems:"center",
                      cursor:"none"
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize:11,fontFamily:C.mono }}>
                      {integrations[opt.key] ? "Connected" : "Optional"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <p style={{ fontSize:12,color:C.muted,marginBottom:18,fontFamily:C.mono }}>
                Choose how you’ll primarily use OpsPulse. We’ll tune the default view for you.
              </p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                <button
                  type="button"
                  onClick={()=>setRole("owner")}
                  style={{
                    padding:16,
                    borderRadius:10,
                    border:`1px solid ${role==="owner"?C.lime:C.border}`,
                    background:role==="owner"?`${C.lime}18`:C.surface,
                    color:C.text,
                    textAlign:"left",
                    cursor:"none"
                  }}
                >
                  <div style={{ fontSize:11,color:C.muted,fontFamily:C.mono,letterSpacing:1.5,marginBottom:4 }}>
                    OWNER / FOUNDER
                  </div>
                  <div style={{ fontSize:14,fontWeight:700,marginBottom:4 }}>Board-ready overview</div>
                  <div style={{ fontSize:12,color:C.muted }}>Focus on revenue, margins, and global health.</div>
                </button>
                <button
                  type="button"
                  onClick={()=>setRole("ops")}
                  style={{
                    padding:16,
                    borderRadius:10,
                    border:`1px solid ${role==="ops"?C.lime:C.border}`,
                    background:role==="ops"?`${C.lime}18`:C.surface,
                    color:C.text,
                    textAlign:"left",
                    cursor:"none"
                  }}
                >
                  <div style={{ fontSize:11,color:C.muted,fontFamily:C.mono,letterSpacing:1.5,marginBottom:4 }}>
                    OPERATIONS MANAGER
                  </div>
                  <div style={{ fontSize:14,fontWeight:700,marginBottom:4 }}>Floor-level telemetry</div>
                  <div style={{ fontSize:12,color:C.muted }}>See backlogs, SLAs, and incident feed first.</div>
                </button>
              </div>
            </div>
          )}
          <div style={{ marginTop:24,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:11,color:C.muted,fontFamily:C.mono }}>
              {step < 3 ? "You can change this later in Settings." : ""}
            </span>
            <button
              onClick={handleNext}
              style={{
                padding:"12px 22px",
                background:companyName.trim() || step>1 ? C.lime : "rgba(200,255,0,0.2)",
                border:"none",
                borderRadius:6,
                color:companyName.trim() || step>1 ? C.bg : C.muted,
                fontSize:13,
                fontWeight:800,
                fontFamily:C.mono,
                cursor:"none",
                letterSpacing:1
              }}
            >
              {step === 3 ? "Finish & open dashboard →" : "Continue →"}
            </button>
          </div>
        </div>
        <div style={{ borderLeft:`1px solid ${C.border}40`,paddingLeft:24,display:"flex",flexDirection:"column",gap:16 }}>
          <div>
            <div style={{ fontSize:11,color:C.muted,fontFamily:C.mono,letterSpacing:1.5,marginBottom:6 }}>SIGNED IN AS</div>
            <div style={{ fontSize:14,color:C.text,fontWeight:600 }}>{user?.name || "New user"}</div>
            <div style={{ fontSize:11,color:C.muted }}>{user?.email || "No email"}</div>
          </div>
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:14 }}>
            <div style={{ fontSize:11,color:C.muted,fontFamily:C.mono,letterSpacing:1.5,marginBottom:8 }}>WHAT YOU'LL SEE</div>
            <ul style={{ paddingLeft:18,margin:0,fontSize:12,color:C.muted,lineHeight:1.7 }}>
              <li>5 live KPI cards for revenue, orders, inventory, tickets, complaints</li>
              <li>Stress score ring with color-coded status</li>
              <li>Tabs for Overview, Revenue, Inventory, Support, Cash Flow, Complaints</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ company, user, initialRole = "owner", onBack, onLogout }) {
  const [hasData, setHasData] = useState(false);
  const [sales, setSales]   = useState([]);
  const [inv, setInv] = useState([]);
  const [sup, setSup]     = useState([]);
  const [cash, setCash]    = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [role, setRole] = useState(initialRole === "ops" ? "ops" : "owner");
  const [war, setWar]   = useState(false);
  const [tab, setTab]   = useState("overview");
  const [profileOpen, setProfileOpen] = useState(false);
  const [navView, setNavView] = useState(null); // "about" | "contact" | "settings" | null
  const [uploadError, setUploadError] = useState("");
  const [userFiles, setUserFiles] = useState([
    { name: "Q1_2026_Financial_Performance.csv", size: "2.4 MB", date: "2026-03-10", status: "Analyzed", type: "csv", data: { "Revenue": "$14.25M", "EBITDA": "$3.2M", "Gross Margin": "68%", "Accounts": "1,240", "Headcount": "82" } },
    { name: "Executive_Strategy_Draft.pdf", size: "1.1 MB", date: "2026-03-09", status: "Stored", type: "pdf", data: { "Summary": "Q2 Expansion plans into APAC market.", "Key Goal": "Reduce operational overhead by 12%." } }
  ]);
  const [selectedFile, setSelectedFile] = useState(null);

  const [parsedMetrics, setParsedMetrics] = useState(null);

  const loadSampleData = () => {
    setSales(genSales());
    setInv(genInventory());
    setSup(genSupport());
    setCash(genCash());
    setComplaints(genComplaints());
    setParsedMetrics(null); 
    setHasData(true);
  };

  const health  = useMemo(() => {
    if (parsedMetrics && parsedMetrics["Health Score"]) {
      const score = parseInt(parsedMetrics["Health Score"]);
      return {
        overall: isNaN(score) ? 82 : score,
        breakdown: { revenue: 85, cashflow: 80, inventory: 75, support: 90, complaints: 88 },
        label: (parsedMetrics.Status || "THRIVING").toUpperCase(),
        color: score > 80 ? C.lime : score > 60 ? C.amber : C.red,
      };
    }
    if (!hasData || !sales.length || !inv.length || !sup.length || !cash.length || !complaints.length) {
      return {
        overall: 0,
        breakdown: { revenue:0, cashflow:0, inventory:0, support:0, complaints:0 },
        label: "NO DATA",
        color: C.muted,
      };
    }
    return calcBusinessHealth(sales, inv, sup, cash, complaints);
  }, [hasData, sales, inv, sup, cash, complaints, parsedMetrics]);

  const alerts  = useMemo(() => {
    if (!hasData || !sales.length || !inv.length || !sup.length || !cash.length || !complaints.length) return [];
    return genAlerts(sales, inv, sup, cash, complaints);
  }, [hasData, sales, inv, sup, cash, complaints]);

  const totalRev = hasData ? sales.reduce((s,d)=>s+d.rev,0) : 0;
  const lastCash = hasData ? (cash[cash.length-1]||{}) : {};
  const lastSup  = hasData ? (sup[sup.length-1]||{}) : {};
  const openComplaints = hasData ? complaints.filter(c=>c.status==="open"||c.status==="escalated").length : 0;

  const stressScore = hasData ? Math.max(0, 100 - health.overall) : 0;
  const stressLabel =
    stressScore < 25 ? "CALM" :
    stressScore < 50 ? "ELEVATED" :
    stressScore < 75 ? "HIGH" :
    "CRITICAL";
  const stressColor =
    stressScore < 25 ? C.lime :
    stressScore < 50 ? C.amber :
    stressScore < 75 ? C.red :
    C.red;

  const ALL_TABS = ["Overview","Revenue","Inventory","Support","Cash Flow","Complaints","Files"];
  // SMART INTELLIGENT CSV PARSER - Works with ANY column naming convention

const handleFileUpload = e => {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    setUploadError("Please upload a file with your operations data to continue.");
    return;
  }

  const lower = (file.name || "").toLowerCase();
  if (lower.endsWith(".pdf")) {
    setUploadError("We detected a PDF, but couldn't read structured metrics. Please upload a CSV or JSON export of your operations data.");
    return;
  }
  if (!lower.endsWith(".csv") && !lower.endsWith(".json")) {
    setUploadError("Unsupported file type. Please upload a CSV or JSON file containing your data.");
    return;
  }
  if (file.size === 0) {
    setUploadError("The uploaded file appears to be empty. Export your data again and retry.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    setUploadError("");
    const text = reader.result;
    const rows = text.split(/\r?\n/).filter(r => r.trim());
    
    if (rows.length === 0) return;

    // Parse CSV properly
    const parseCSVLine = line => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const header = parseCSVLine(rows[0]);
    const metrics_obj = {};

    // Get the LAST ROW (most recent data)
    const lastRow = parseCSVLine(rows[rows.length - 1]);
    
    // SMART DETECTION: Keywords to look for in column names
    const patterns = {
      Revenue: ['revenue', 'sales', 'turnover', 'total_revenue', 'gross_revenue', 'income', 'earnings'],
      'Cash Flow': ['cash', 'cash_flow', 'cashflow', 'balance', 'bank', 'account_balance', 'liquidity'],
      Uptime: ['uptime', 'availability', 'system_health', 'operational_time', 'system_uptime', 'sla'],
      NPS: ['nps', 'satisfaction', 'customer_satisfaction', 'csat', 'score', 'rating', 'happiness'],
      Complaints: ['complaints', 'issues', 'tickets', 'support_tickets', 'open_tickets', 'problems', 'defects'],
      'Order Backlog': ['backlog', 'pending_orders', 'unfulfilled', 'orders_pending', 'queue', 'orders', 'pending'],
      Inventory: ['inventory', 'stock', 'stock_level', 'units', 'quantity', 'warehouse_stock', 'available'],
      'Fulfillment Stress': ['stress', 'pressure', 'load', 'fulfillment', 'utilization', 'capacity', 'throughput'],
      Returns: ['returns', 'rma', 'returned_items', 'refunds', 'restock', 'incoming'],
    };

    // FUNCTION: Find best matching metric for a column
    const findMetricType = (columnName) => {
      const col = columnName.toLowerCase().replace(/[_\s\-]/g, '');
      
      for (const [metricType, keywords] of Object.entries(patterns)) {
        for (const keyword of keywords) {
          const keywordNormalized = keyword.toLowerCase().replace(/[_\s\-]/g, '');
          if (col.includes(keywordNormalized) || keywordNormalized.includes(col)) {
            return metricType;
          }
        }
      }
      return null;
    };

    // Parse each column and auto-detect what it is
    for (let i = 0; i < header.length; i++) {
      const colName = header[i];
      const colValue = lastRow[i] || '';
      
      if (!colValue || colValue.trim() === '') continue; // Skip empty values
      
      // Find what metric this column represents
      const metricType = findMetricType(colName);
      
      if (metricType) {
        // Clean the value based on metric type
        let cleanValue = colValue.trim();
        
        if (metricType === 'Revenue' || metricType === 'Cash Flow') {
          // Parse currency values: $45000, $45K, 45M, etc.
          const numMatch = cleanValue.match(/[\d.]+/);
          if (numMatch) {
            let num = parseFloat(numMatch[0]);
            if (cleanValue.includes('K')) num *= 1000;
            if (cleanValue.includes('M')) num *= 1000000;
            if (cleanValue.includes('B')) num *= 1000000000;
            cleanValue = num.toString();
          }
        }
        
        if (metricType === 'Uptime') {
          // Ensure percentage format
          if (!cleanValue.includes('%')) {
            cleanValue = parseFloat(cleanValue) + '%';
          }
        }
        
        if (metricType === 'NPS' || metricType === 'Fulfillment Stress' || metricType === 'Complaints' || metricType === 'Returns' || metricType === 'Order Backlog' || metricType === 'Inventory') {
          // Parse numeric values
          const numMatch = cleanValue.match(/[\d.]+/);
          if (numMatch) {
            cleanValue = numMatch[0];
          }
        }
        
        metrics_obj[metricType] = cleanValue;
      }
    }

    setParsedMetrics(metrics_obj);
    
    const newFile = {
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(1) + " MB",
      date: new Date().toISOString().split('T')[0],
      status: "Analyzed",
      type: lower.endsWith(".csv") ? "csv" : "json",
      data: metrics_obj
    };
    
    setUserFiles(prev => [newFile, ...prev]);

    // Scale data to CSV revenue if found
    if (metrics_obj.Revenue) {
      const revVal = parseFloat(metrics_obj.Revenue.replace(/[^0-9.]/g, '')) * 
                     (metrics_obj.Revenue.includes('M') ? 1000000 : 1);
      if (!isNaN(revVal) && revVal > 0) {
        setSales(Array.from({length: 24}, (_, i) => ({ 
          h: `${i}:00`, 
          rev: (revVal/24) * rnd(0.85, 1.15), 
          orders: rndI(15, 60), 
          conv: rnd(2.5, 6.5) 
        })));
      }
    }
    
    if (!hasData) {
      setInv(genInventory());
      setSup(genSupport());
      setCash(genCash());
      setComplaints(genComplaints());
      setHasData(true);
    }
  };

  reader.onerror = () => {
    setUploadError("We couldn't read this file. Please provide a clean CSV/JSON export and try again.");
  };

  reader.readAsText(file);
};
  return (
    <div style={{ minHeight:"100vh",background:C.bg }}>
      {war && (
        <div style={{ background:C.red,color:"#fff",padding:"8px 24px",textAlign:"center",fontSize:11,fontFamily:C.mono,fontWeight:700,letterSpacing:2,position:"sticky",top:0,zIndex:300 }}>
          WAR ROOM MODE ACTIVE · RESOLVE CRITICAL ALERTS IMMEDIATELY
        </div>
      )}

      <nav style={{ padding:"16px 32px",borderBottom:`1px solid ${C.border}`,background:`${C.bg}F0`,backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:war?27:0,zIndex:200,gap:12,flexWrap:"wrap" }}>
        <div style={{ display:"flex",alignItems:"center",gap:14 }}>
          <button onClick={onBack} style={{ padding:"6px 12px",fontSize:10,background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:C.muted,fontFamily:C.mono,cursor:"none" }}>← EXIT</button>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:26,height:26,background:C.lime,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>⬡</div>
            <span style={{ fontFamily:C.display,fontSize:18,letterSpacing:2 }}>
              {(company?.name || "OpsPulse").toUpperCase()}
            </span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.lime,fontFamily:C.mono }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:C.lime,display:"inline-block",animation:"blink 1.5s infinite" }} />LIVE DATA
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:4,background:`${stressColor}15`,border:`1px solid ${stressColor}40` }}>
            <span style={{ fontSize:9,color:stressColor,fontFamily:C.mono,letterSpacing:1 }}>STRESS:</span>
            <span style={{ fontSize:11,fontWeight:700,color:stressColor,fontFamily:C.mono }}>{stressScore} · {hasData ? stressLabel : "NO DATA"}</span>
          </div>
        </div>
        <div style={{ display:"flex",gap:16,alignItems:"center",flexWrap:"wrap" }}>
          <div style={{ display:"flex",gap:20,fontSize:12,color:C.muted }}>
            {["About","Contact"].map(link=>(
              <button
                key={link}
                onClick={()=>{ setNavView(link.toLowerCase()); setTab("overview"); }}
                style={{ background:"transparent",border:"none",color:navView===link.toLowerCase()?C.lime:C.muted,cursor:"none",fontFamily:C.body,fontSize:12 }}
              >
                {link}
              </button>
            ))}
          </div>
          {initialRole === "owner" && (
            <div style={{ display:"flex",background:C.surface,borderRadius:6,padding:2,border:`1px solid ${C.border}` }}>
              {["owner","ops"].map(r=>(
                <button key={r} onClick={()=>{setRole(r);setTab("overview")}} style={{ padding:"6px 14px",borderRadius:4,border:"none",background:role===r?C.lime:"transparent",color:role===r?C.bg:C.muted,fontSize:11,fontWeight:700,fontFamily:C.body,cursor:"none" }}>
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {initialRole === "ops" && (
            <div style={{ padding:"6px 14px",background:`${C.lime}15`,border:`1px solid ${C.lime}40`,borderRadius:6,color:C.lime,fontSize:10,fontWeight:700,fontFamily:C.mono }}>
              OPS ACCESS ONLY
            </div>
          )}
          <div style={{ position:"relative" }}>
            <button
              onClick={()=>setProfileOpen(o=>!o)}
              style={{
                display:"flex",
                alignItems:"center",
                gap:8,
                padding:"6px 10px",
                borderRadius:999,
                border:`1px solid ${C.border}`,
                background:C.surface,
                cursor:"none"
              }}
            >
              <div style={{ width:26,height:26,borderRadius:"50%",background:C.lime,display:"flex",alignItems:"center",justifyContent:"center",color:C.bg,fontSize:12,fontWeight:700 }}>
                {(user?.name || "User").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:11,color:C.text,fontWeight:600 }}>{user?.name || "Signed user"}</div>
                <div style={{ fontSize:10,color:C.muted }}>{user?.email || "email@company.com"}</div>
              </div>
            </button>
            {profileOpen && (
              <div style={{ position:"absolute",right:0,top:"110%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,minWidth:220,boxShadow:"0 14px 40px rgba(0,0,0,0.7)",padding:10,zIndex:300 }}>
                <div style={{ padding:"8px 10px",borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:12,color:C.text,fontWeight:600 }}>{user?.name || "Signed user"}</div>
                  <div style={{ fontSize:11,color:C.muted }}>{user?.email || "email@company.com"}</div>
                </div>
                <button
                  onClick={() => { setNavView("settings"); setProfileOpen(false); }}
                  style={{ width:"100%",padding:"8px 10px",background:"transparent",border:"none",textAlign:"left",fontSize:12,color:navView==="settings"?C.lime:C.muted,cursor:"none" }}
                >
                  Settings
                </button>
                <button
                  onClick={onLogout}
                  style={{ width:"100%",padding:"8px 10px",background:"transparent",border:"none",textAlign:"left",fontSize:12,color:C.red,cursor:"none" }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
          <button onClick={()=>setWar(!war)} style={{ background:war?C.red:`${C.red}15`,border:`1px solid ${C.red}`,color:war?"#fff":C.red,padding:"7px 14px",borderRadius:6,fontSize:10,fontWeight:800,fontFamily:C.mono,cursor:"none" }}>
            {war?"WAR MODE OFF":"LAUNCH WAR ROOM"}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth:1280,margin:"0 auto",padding:"28px 32px" }}>
        {/* KPI row */}
        <div style={{ display:"grid",gridTemplateColumns:"160px 1fr",gap:14,marginBottom:22 }}>
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
            <span style={{ fontSize:9,color:C.muted,fontFamily:C.mono,letterSpacing:1.5 }}>STRESS SCORE</span>
            <ScoreRing score={stressScore} color={stressColor} size={130} label={hasData ? stressLabel : "NO DATA"} />
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12 }}>
            <KpiCard label="Revenue" value={parsedMetrics?.Revenue || (hasData?`$${totalRev.toLocaleString()}`:"—")} delta={parsedMetrics ? "From CSV Source" : (hasData?"+12.4% vs yesterday":"Add data")} color={C.lime} />
            <KpiCard label="Cash Flow" value={parsedMetrics?.["Cash Flow"] || (hasData?`$${Math.round(lastCash.bal/1000)}k` : "—")} delta={parsedMetrics ? "From CSV Source" : "Liquidity check"} color={C.purple} />
            <KpiCard label="Systems" value={parsedMetrics?.Uptime || (hasData ? "99.9%" : "—")} delta={parsedMetrics?.["API Response"] || "Uptime latency"} color={C.cyan} />
            <KpiCard label="NPS" value={parsedMetrics?.NPS || (hasData?"74":"—")} delta="Customer satisfaction" color={C.lime} />
            <KpiCard label="Complaints" value={hasData?`${openComplaints}`:"—"} delta={`${complaints.filter(c=>c.sentiment==="angry"&&c.status==="open").length} angry`} color={openComplaints>4?C.red:C.amber} />
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display:"flex",gap:4,marginBottom:18,flexWrap:"wrap" }}>
          {ALL_TABS.map(t=>{
            const key = t.toLowerCase().replace(" ","");
            const active = tab===key;
            const hasBadge = t==="Alerts"&&alerts.filter(a=>a.type==="crisis").length>0;
            const complaintBadge = t==="Complaints"&&openComplaints>0;
            return (
              <button key={t} onClick={()=>setTab(key)}
                style={{ padding:"8px 16px",borderRadius:6,border:`1px solid ${active?C.lime:C.border}`,background:active?`${C.lime}18`:"transparent",color:active?C.lime:C.muted,fontSize:11,fontWeight:active?700:400,fontFamily:C.mono,cursor:"none",transition:"all 0.2s",position:"relative",letterSpacing:0.5 }}>
                {t}
                {(hasBadge||complaintBadge) && <span style={{ position:"absolute",top:-4,right:-4,width:8,height:8,background:C.red,borderRadius:"50%",border:`1px solid ${C.bg}` }} />}
              </button>
            );
          })}
        </div>

        {/* Tab / nav content */}
        <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24,minHeight:400 }}>
          {navView === "about" && (
            <div style={{ maxWidth:780 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                <h3 style={{ fontFamily:C.display,fontSize:26,margin:0 }}>About OpsPulse</h3>
                <button
                  onClick={()=>setNavView(null)}
                  style={{ fontSize:11,color:C.muted,background:"transparent",border:"none",fontFamily:C.mono,cursor:"none" }}
                >
                  ← Return to Console
                </button>
              </div>
              <p style={{ fontSize:14,color:C.muted,lineHeight:1.8,marginBottom:18 }}>
                OpsPulse is your real-time operations Command Center. It connects revenue, inventory, support, complaints and cash flow into one tactical view so owners and operations managers can react before things break.
              </p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18 }}>
                <div>
                  <h4 style={{ fontFamily:C.display,fontSize:18,margin:"0 0 8px" }}>For owners</h4>
                  <ul style={{ paddingLeft:18,margin:0,fontSize:13,color:C.muted,lineHeight:1.7 }}>
                    <li>Live view of revenue, tickets, inventory risk and complaints.</li>
                    <li>Stress score summarising how close you are to breaking point.</li>
                    <li>Board-ready snapshots you can export in seconds.</li>
                  </ul>
                </div>
                <div>
                  <h4 style={{ fontFamily:C.display,fontSize:18,margin:"0 0 8px" }}>For operations managers</h4>
                  <ul style={{ paddingLeft:18,margin:0,fontSize:13,color:C.muted,lineHeight:1.7 }}>
                    <li>Floor-level telemetry for backlog, SLAs, and incident queues.</li>
                    <li>Complaint triage with sentiment, priority, and AI response helpers.</li>
                    <li>Inventory signals for stockouts and slow-moving SKUs.</li>
                  </ul>
                </div>
              </div>
              <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16 }}>
                <h4 style={{ fontFamily:C.display,fontSize:18,margin:"0 0 8px" }}>What this workspace includes</h4>
                <ul style={{ paddingLeft:18,margin:0,fontSize:13,color:C.muted,lineHeight:1.7 }}>
                  <li>Authentication and a setup wizard tuned to your company profile.</li>
                  <li>Role-based views for Owner vs Operations Manager.</li>
                  <li>Stress score ring, KPI cards, and detailed tabs for Revenue, Inventory, Support, Cash Flow and Complaints.</li>
                </ul>
              </div>
            </div>
          )}
          {navView === "contact" && (
            <div style={{ maxWidth:620 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
                <h3 style={{ fontFamily:C.display,fontSize:26,margin:0 }}>Tactical Support</h3>
                <button
                  onClick={()=>setNavView(null)}
                  style={{ fontSize:11,color:C.muted,background:"transparent",border:"none",fontFamily:C.mono,cursor:"none" }}
                >
                  ← Return to Console
                </button>
              </div>
              <p style={{ fontSize:14,color:C.muted,lineHeight:1.8,marginBottom:20 }}>
                Need help wiring OpsPulse into your stack or want to share feedback? Reach out to our tactical support units.
              </p>
              <div style={{ display:"flex",flexDirection:"column",gap:16,marginBottom:24 }}>
                <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:16 }}>
                   <div style={{ fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:4 }}>DIRECT CHANNEL</div>
                   <div style={{ fontSize:15,color:C.text }}>support@opspulse.io</div>
                </div>
                <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:16 }}>
                   <div style={{ fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:4 }}>WAR ROOM COMMS</div>
                   <div style={{ fontSize:15,color:C.text }}>#ops-hq-internal</div>
                </div>
              </div>
            </div>
          )}
          {navView === "settings" && (
            <div style={{ maxWidth:720 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
                <h3 style={{ fontFamily:C.display,fontSize:26,margin:0 }}>Workspace Settings</h3>
                <button
                  onClick={()=>setNavView(null)}
                  style={{ fontSize:11,color:C.muted,background:"transparent",border:"none",fontFamily:C.mono,cursor:"none" }}
                >
                  ← Return to Console
                </button>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:24 }}>
                <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20 }}>
                   <h4 style={{ fontSize:10,color:C.lime,fontFamily:C.mono,letterSpacing:1.5,marginBottom:16,marginTop:0 }}>PREFERENCES</h4>
                   <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                      <span style={{ fontSize:13 }}>Dark Mode Intensity</span>
                      <span style={{ color:C.lime,fontFamily:C.mono,fontSize:12 }}>Tactical (Max)</span>
                   </div>
                   <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <span style={{ fontSize:13 }}>Refresh Rate</span>
                      <span style={{ color:C.lime,fontFamily:C.mono,fontSize:12 }}>Real-time (1s)</span>
                   </div>
                </div>
                <div style={{ background:C.surface,border:`1px solid ${C.red}40`,borderRadius:10,padding:20 }}>
                   <h4 style={{ fontSize:10,color:C.red,fontFamily:C.mono,letterSpacing:1.5,marginBottom:16,marginTop:0 }}>DANGER ZONE</h4>
                   <p style={{ fontSize:12,color:C.muted,marginBottom:16 }}>Deleting your workspace data will wipe all tracked history and file mappings.</p>
                   <button style={{ padding:"10px 16px",background:`${C.red}15`,border:`1px solid ${C.red}`,borderRadius:6,color:C.red,fontSize:11,fontWeight:700,fontFamily:C.mono,cursor:"none" }}>Purge Workspace Data</button>
                </div>
              </div>
            </div>
          )}
          {navView === null && !hasData && (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",minHeight:320,gap:16 }}>
              <ScoreRing score={0} color={C.muted} size={120} label="NO DATA" />
              <div style={{ fontFamily:C.display,fontSize:22,marginBottom:4 }}>No data yet.</div>
              <p style={{ fontSize:13,color:C.muted,maxWidth:420,marginBottom:8 }}>
                Upload a CSV or JSON export of your operations (revenue, orders, inventory, tickets, complaints). We’ll analyse it and light up your stress score and KPIs.
              </p>
              <label style={{ fontSize:12,color:C.text,background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:"10px 14px",cursor:"none" }}>
                <span style={{ fontFamily:C.mono,fontSize:11,letterSpacing:1 }}>Choose file</span>
                <input
                  type="file"
                  accept=".csv,.json,application/json,text/csv,application/pdf"
                  onChange={handleFileUpload}
                  style={{ display:"none" }}
                />
              </label>
              {uploadError && (
                <div style={{ fontSize:12,color:C.red,maxWidth:420 }}>
                  {uploadError}
                </div>
              )}
              <div style={{ fontSize:11,color:C.muted,maxWidth:420 }}>
                Just exploring? You can also{" "}
                <button
                  onClick={loadSampleData}
                  style={{ background:"transparent",border:"none",color:C.cyan,cursor:"none",fontSize:11,textDecoration:"underline" }}
                >
                  load sample data
                </button>
                {" "}to see a realistic dashboard.
              </div>
            </div>
          )}
          {navView === null && hasData && tab==="overview" && (
            role === "ops" ? (
              <OpsOverview alerts={alerts} inv={inv} complaints={complaints} onTriggerWarRoom={() => setWar(true)} />
            ) : (
              <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:24 }}>
                <div>
                  <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:20 }}>REVENUE STREAM</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={sales}>
                      <defs>
                        <linearGradient id="colorRevOv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.lime} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={C.lime} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="h" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:10}} />
                      <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontFamily:C.mono,fontSize:11}} />
                      <Area type="monotone" dataKey="rev" stroke={C.lime} fillOpacity={1} fill="url(#colorRevOv)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                  <h3 style={{ fontFamily:C.display,fontSize:22 }}>ACTIVE ALERTS</h3>
                  <div style={{ display:"flex",flexDirection:"column",gap:8,maxHeight:300,overflowY:"auto" }}>
                    {alerts.length>0 ? alerts.map((a,i)=><AlertItem key={i} a={a} />) : (
                      <div style={{ textAlign:"center",padding:"40px 0",color:C.muted,fontFamily:C.mono,fontSize:12 }}>✓ ALL SYSTEMS NOMINAL</div>
                    )}
                  </div>
                  <div style={{ background:C.surface,border:`1px solid ${health.color}30`,borderRadius:8,padding:14 }}>
                    <div style={{ fontSize:9,color:C.muted,fontFamily:C.mono,letterSpacing:2,marginBottom:8 }}>QUICK HEALTH SNAPSHOT</div>
                    {Object.entries(health.breakdown).map(([k,v])=>(
                      <HealthBar key={k} label={k.toUpperCase()} score={v} />
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
          {navView === null && hasData && tab==="revenue"      && <RevenueTab sales={sales} />}
          {navView === null && hasData && tab==="cashflow"     && <CashFlowTab cash={cash} />}
          {navView === null && hasData && tab==="inventory"    && <InventoryTab inv={inv} />}
          {navView === null && hasData && tab==="support"      && <SupportTab sup={sup} />}
          {navView === null && hasData && tab==="complaints"   && <ComplaintsTab complaints={complaints} setComplaints={setComplaints} />}
          {navView === null && hasData && tab==="files"         && (
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
                <h3 style={{ fontFamily:C.display,fontSize:24,margin:0 }}>Data Source Management</h3>
                <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                   {uploadError && <span style={{ fontSize:11,color:C.red,fontFamily:C.mono }}>{uploadError}</span>}
                   <label style={{ padding:"8px 16px",background:C.lime,borderRadius:6,color:C.bg,fontSize:12,fontWeight:800,fontFamily:C.mono,cursor:"none" }}>
                     + Upload More Files
                     <input type="file" style={{ display:"none" }} onChange={handleFileUpload} />
                   </label>
                </div>
              </div>

              {selectedFile ? (
                <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20 }}>
                   <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                      <h4 style={{ margin:0,color:C.lime }}>{selectedFile.name} Data Preview</h4>
                      <button onClick={()=>setSelectedFile(null)} style={{ background:"transparent",border:"none",color:C.muted,fontSize:12,fontFamily:C.mono,cursor:"none" }}>← Back to list</button>
                   </div>
                   <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:12 }}>
                      {Object.entries(selectedFile.data).map(([k,v])=>(
                        <div key={k} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:14 }}>
                           <div style={{ fontSize:9,color:C.muted,fontFamily:C.mono,letterSpacing:1,marginBottom:4 }}>{k.toUpperCase()}</div>
                           <div style={{ fontSize:15,fontWeight:700,color:C.text }}>{v}</div>
                        </div>
                      ))}
                   </div>
                </div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {userFiles.map((f, i) => (
                    <div key={i} style={{ background:C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <span style={{ fontSize: 24 }}>{f.name.endsWith(".csv") ? "📊" : "📄"}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{f.name}</div>
                          <div style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>{f.size} • {f.date}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                         <span style={{ fontSize: 10, color: C.lime, background: `${C.lime}15`, padding: "4px 10px", borderRadius: 4, fontFamily: C.mono }}>{f.status.toUpperCase()}</span>
                         <button
                           onClick={()=>setSelectedFile(f)}
                           style={{ padding:"8px 14px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontSize:11,fontFamily:C.mono,cursor:"none" }}
                         >
                           View Data
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LANDING ──────────────────────────────────────────────────────────────────

function LandingPage({ onLaunch }) {
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    setTimeout(() => setReady(true), 100);
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tickerItems = ["💰 REVENUE LIVE · UPDATING","📦 STOCK LEVELS · OPTIMIZED","🎧 TICKETS · NO ESCALATIONS","🏦 BANK BALANCE · $124,000","🚀 NEW CONVERSION SPIKE","⚡ CSAT 4.2 · HEALTHY","😡 COMPLAINTS · 3 OPEN","🩺 HEALTH SCORE · 82"];

  return (
    <div style={{ background:C.bg,minHeight:"100vh" }}>
      <div style={{ position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:`linear-gradient(${C.lime}06 1px,transparent 1px),linear-gradient(90deg,${C.lime}06 1px,transparent 1px)`,backgroundSize:"40px 40px",animation:"gridScroll 10s linear infinite" }} />

      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 48px",background:scrolled?"rgba(8,10,6,0.9)":"transparent",backdropFilter:scrolled?"blur(20px)":"none",borderBottom:scrolled?`1px solid ${C.border}`:"1px solid transparent",transition:"all 0.4s" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:30,height:30,background:C.lime,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>⬡</div>
          <span style={{ fontFamily:C.display,fontSize:20,letterSpacing:2.5 }}>OPS<span style={{ color:C.lime }}>PULSE</span></span>
        </div>
        <div style={{ display:"flex",gap:36 }}>
          {["Features","Pricing","Demo"].map(n=><span key={n} style={{ fontSize:13,color:C.muted,fontWeight:500 }}>{n}</span>)}
        </div>
        <button onClick={onLaunch} style={{ padding:"12px 28px",background:C.lime,border:"none",borderRadius:6,color:C.bg,fontSize:13,fontWeight:800,fontFamily:C.mono,cursor:"none" }}>Launch Console →</button>
      </nav>

      <section style={{ minHeight:"100vh",display:"flex",alignItems:"center",padding:"130px 80px 80px",position:"relative",zIndex:2,gap:60,flexWrap:"wrap" }}>
        <div style={{ flex:1,maxWidth:640 }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:10,fontFamily:C.mono,fontSize:10,letterSpacing:1.5,color:C.lime,background:`${C.lime}10`,border:`1px solid ${C.lime}30`,borderRadius:3,padding:"8px 16px",marginBottom:44,opacity:ready?1:0,transition:"0.8s" }}>
            <span style={{ width:7,height:7,borderRadius:"50%",background:C.lime,display:"inline-block",animation:"pulseDot 1.8s infinite" }} />
            SYSTEMS NOMINAL · REAL-TIME TELEMETRY
          </div>
          <div style={{ fontFamily:C.display,fontSize:"clamp(60px,7.5vw,108px)",lineHeight:0.92,letterSpacing:1,color:C.text,opacity:ready?1:0,transform:ready?"translateY(0)":"translateY(40px)",transition:"1s cubic-bezier(0.16,1,0.3,1)" }}>
            Command Your.<br /><span style={{ color:C.lime }}>BUSINESS.</span><br />In Real-Time.
          </div>
          <p style={{ fontSize:18,color:C.muted,lineHeight:1.85,maxWidth:500,marginTop:36,marginBottom:48,opacity:ready?1:0,transform:ready?"translateY(0)":"translateY(32px)",transition:"1s 0.1s cubic-bezier(0.16,1,0.3,1)" }}>
            Toss the spreadsheets. OpsPulse connects your tools into one live Command Center — sales, stock, support, complaints, and cash flow at a glance.
          </p>
          <div style={{ display:"flex",gap:16,flexWrap:"wrap",opacity:ready?1:0,transform:ready?"translateY(0)":"translateY(24px)",transition:"1s 0.2s" }}>
            <button onClick={onLaunch} style={{ padding:"18px 48px",fontSize:16,background:C.lime,border:"none",borderRadius:6,color:C.bg,fontWeight:800,fontFamily:C.mono,cursor:"none" }}>🚀 Enter Dashboard</button>
            <button style={{ padding:"18px 32px",fontSize:14,background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontFamily:C.mono,cursor:"none" }}>Watch 2-min Demo</button>
          </div>
        </div>
        <div style={{ flex:1,display:"flex",justifyContent:"center",opacity:ready?1:0,transform:ready?"scale(1)":"scale(0.9)",transition:"1.2s 0.1s" }}>
          <LivePreview />
        </div>
      </section>

      <div style={{ overflow:"hidden",background:`${C.lime}08`,borderTop:`1px solid ${C.lime}20`,borderBottom:`1px solid ${C.lime}20`,padding:"14px 0",position:"relative",zIndex:2 }}>
        <div style={{ display:"flex",gap:80,animation:"ticker 30s linear infinite",width:"max-content" }}>
          {[...tickerItems,...tickerItems].map((t,i)=>(
            <span key={i} style={{ fontFamily:C.mono,fontSize:11,color:C.lime,whiteSpace:"nowrap",letterSpacing:1 }}>
              {t}<span style={{ margin:"0 24px",opacity:0.2 }}>|</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.6} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes gridScroll { 0%{background-position:0 0} 100%{background-position:0 40px} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes scanline { 0%{top:-3px} 100%{top:100%} }
        * { cursor: none !important; }
        ::-webkit-scrollbar { width:4px } ::-webkit-scrollbar-track { background:transparent } ::-webkit-scrollbar-thumb { background:rgba(200,255,0,0.2);border-radius:2px }
      `}</style>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("landing");
  const [company, setCompany] = useState(null);
  const [user, setUser] = useState(null);
  return (
    <div style={{ color:C.text,fontFamily:C.body }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pulseDot { 0%,100%{transform:scale(1)} 50%{transform:scale(1.6)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes gridScroll { 0%{background-position:0 0} 100%{background-position:0 40px} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        * { cursor: none !important; box-sizing: border-box; }
        ::-webkit-scrollbar { width:4px } ::-webkit-scrollbar-track { background:transparent } ::-webkit-scrollbar-thumb { background:rgba(200,255,0,0.2);border-radius:2px }
        option { background: #12160e; color: #e8f0d8; }
      `}</style>
      <Cursor />
      {view==="landing"    && <LandingPage onLaunch={()=>setView("auth")} />}
      {view==="auth"       && (
        <Auth
          onAuthenticated={u=>{ setUser(u); setView("wizard"); }}
          onBack={()=>setView("landing")}
        />
      )}
      {view==="wizard"     && (
        <SetupWizard
          user={user}
          onComplete={d=>{ setCompany(d); setView("dashboard"); }}
          onBack={()=>setView("auth")}
        />
      )}
      {view==="dashboard"  && (
        <Dashboard
          company={company}
          user={user}
          initialRole={company?.role || "owner"}
          onBack={()=>setView("landing")}
          onLogout={()=>{
            setUser(null);
            setCompany(null);
            setView("auth");
          }}
        />
      )}
    </div>
  );
}