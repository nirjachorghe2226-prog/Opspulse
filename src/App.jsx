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

function ScoreRing({ score, color, size = 140 }) {
  const c = color || (score > 70 ? C.lime : score > 45 ? C.amber : C.red);
  const label = score > 75 ? "THRIVING" : score > 55 ? "STABLE" : score > 35 ? "AT RISK" : "CRITICAL";
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
        <div style={{ fontSize:size*0.07,color:C.muted,fontFamily:C.mono,marginTop:4,letterSpacing:1 }}>{label}</div>
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

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ company, onBack }) {
  const [sales]   = useState(genSales);
  const [inv, setInv] = useState(genInventory);
  const [sup]     = useState(genSupport);
  const [cash]    = useState(genCash);
  const [complaints, setComplaints] = useState(genComplaints);
  const [role, setRole] = useState("owner");
  const [war, setWar]   = useState(false);
  const [tab, setTab]   = useState("overview");

  const health  = useMemo(() => calcBusinessHealth(sales, inv, sup, cash, complaints), [sales, inv, sup, cash, complaints]);
  const alerts  = useMemo(() => genAlerts(sales, inv, sup, cash, complaints), [sales, inv, sup, cash, complaints]);
  const totalRev = sales.reduce((s,d)=>s+d.rev,0);
  const lastCash = cash[cash.length-1]||{};
  const lastSup  = sup[sup.length-1]||{};
  const openComplaints = complaints.filter(c=>c.status==="open"||c.status==="escalated").length;

  const ALL_TABS = ["Overview","Health","Revenue","Inventory","Cash Flow","Support","Complaints","Alerts"];

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
            <span style={{ fontFamily:C.display,fontSize:18,letterSpacing:2 }}>{company?.name?.toUpperCase()||"OPS"}<span style={{ color:C.lime }}>PULSE</span></span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.lime,fontFamily:C.mono }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:C.lime,display:"inline-block",animation:"blink 1.5s infinite" }} />LIVE DATA
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:4,background:`${health.color}15`,border:`1px solid ${health.color}40` }}>
            <span style={{ fontSize:9,color:health.color,fontFamily:C.mono,letterSpacing:1 }}>HEALTH:</span>
            <span style={{ fontSize:11,fontWeight:700,color:health.color,fontFamily:C.mono }}>{health.overall} · {health.label}</span>
          </div>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <div style={{ display:"flex",background:C.surface,borderRadius:6,padding:2,border:`1px solid ${C.border}` }}>
            {["owner","ops"].map(r=>(
              <button key={r} onClick={()=>{setRole(r);setTab("overview")}} style={{ padding:"6px 14px",borderRadius:4,border:"none",background:role===r?C.lime:"transparent",color:role===r?C.bg:C.muted,fontSize:11,fontWeight:700,fontFamily:C.body,cursor:"none" }}>
                {r.toUpperCase()}
              </button>
            ))}
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
            <span style={{ fontSize:9,color:C.muted,fontFamily:C.mono,letterSpacing:1.5 }}>HEALTH SCORE</span>
            <ScoreRing score={health.overall} color={health.color} size={130} />
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12 }}>
            <KpiCard label="Daily Revenue" value={`$${totalRev.toLocaleString()}`} delta="+12.4%" color={C.lime} />
            <KpiCard label="Low Stock" value={inv.filter(i=>i.stock<i.thr).length} delta="Items Below Threshold" color={inv.filter(i=>i.stock<i.thr).length>0?C.red:C.cyan} />
            <KpiCard label="Cash Balance" value={`$${Math.round(lastCash.bal/1000)}k`} delta="+Inflow Today" color={C.purple} />
            <KpiCard label="Open Tickets" value={lastSup.open} delta={`${lastSup.escalated} Escalated`} color={lastSup.escalated>5?C.red:C.amber} />
            <KpiCard label="Complaints" value={openComplaints} delta={`${complaints.filter(c=>c.sentiment==="angry"&&c.status==="open").length} Angry`} color={openComplaints>4?C.red:C.amber} />
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

        {/* Tab content */}
        <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24,minHeight:400 }}>
          {tab==="overview" && (
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
          )}
          {tab==="health"       && <BusinessHealthTab health={health} sales={sales} inv={inv} sup={sup} cash={cash} complaints={complaints} />}
          {tab==="revenue"      && <RevenueTab sales={sales} />}
          {tab==="cashflow"     && <CashFlowTab cash={cash} />}
          {tab==="inventory"    && <InventoryTab inv={inv} />}
          {tab==="support"      && <SupportTab sup={sup} />}
          {tab==="complaints"   && <ComplaintsTab complaints={complaints} setComplaints={setComplaints} />}
          {tab==="alerts"       && (
            <div>
              <h3 style={{ fontFamily:C.display,fontSize:22,marginBottom:20 }}>ALL ALERTS</h3>
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {alerts.length>0 ? alerts.map((a,i)=><AlertItem key={i} a={a} />) : (
                  <div style={{ textAlign:"center",padding:"60px 0",color:C.lime,fontFamily:C.mono,fontSize:14 }}>✓ ALL CLEAR — NO ACTIVE ALERTS</div>
                )}
              </div>
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
      {view==="landing"    && <LandingPage onLaunch={()=>setView("onboarding")} />}
      {view==="onboarding" && <Onboarding onComplete={d=>{ setCompany(d); setView("dashboard"); }} />}
      {view==="dashboard"  && <Dashboard company={company} onBack={()=>setView("landing")} />}
    </div>
  );
}