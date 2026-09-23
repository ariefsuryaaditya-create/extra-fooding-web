import React,{useEffect,useMemo,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {supabase} from './supabase'
import './style.css'

const SHIFT={1:{label:'SHIFT 1',time:'12:00–13:00'},2:{label:'SHIFT 2',time:'20:00–21:00'},3:{label:'SHIFT 3',time:'04:00–05:00'}}
const parts=d=>(d||'').split('-').map(Number)
const fmt=d=>{const [y,m,day]=parts(d);return y?`${String(day).padStart(2,'0')}/${String(m).padStart(2,'0')}`:''}
const fmtLong=d=>{const [y,m,day]=parts(d);return y?`${String(day).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`:''}
const dateObj=d=>{const [y,m,day]=parts(d);return new Date(Date.UTC(y,m-1,day))}
const daysBetween=(a,b)=>Math.round((dateObj(b)-dateObj(a))/86400000)+1
const dateList=(period)=>period?Array.from({length:daysBetween(period.start_date,period.end_date)},(_,i)=>{const d=dateObj(period.start_date);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)}):[]

function App(){
 const [mode,setMode]=useState(window.location.pathname.startsWith('/admin')?'admin':'leader')
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(mode==='admin'),[err,setErr]=useState('')
 useEffect(()=>{
   if(mode!=='admin'){setLoading(false);return}
   supabase.auth.getSession().then(({data})=>setSession(data.session))
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
   return()=>subscription.unsubscribe()
 },[mode])
 useEffect(()=>{
   if(mode!=='admin')return
   if(!session){setProfile(null);setLoading(false);return}
   setLoading(true)
   supabase.from('profiles').select('id,full_name,role,work_group_id,active,work_groups(code,name)').eq('id',session.user.id).single().then(({data,error})=>{if(error)setErr(error.message);setProfile(data);setLoading(false)})
 },[session,mode])
 if(mode==='admin'){
   if(loading)return <div className="center">Memuat…</div>
   if(!session)return <AdminLogin setErr={setErr} err={err}/>
   if(!profile?.active || profile.role!=='admin')return <div className="center"><div><h2>Akses ditolak</h2><p className="muted">Akun ini bukan Admin.</p><button onClick={()=>supabase.auth.signOut()}>Keluar</button></div></div>
   return <Admin profile={profile}/>
 }
 const stored=sessionStorage.getItem('ef_employee')
 if(stored){
   try{ JSON.parse(stored); return <Leader/> }catch{ sessionStorage.removeItem('ef_employee') }
 }
 return <NikEntry/>
}

function AdminLogin({setErr,err}){const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);async function go(e){e.preventDefault();setBusy(true);setErr('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setErr(error.message);setBusy(false)}return <div className="login"><div className="card login-card"><div className="brand">PT NEW ASIA INTERNATIONAL</div><h1>Admin Extra Fooding</h1><p className="muted">Halaman khusus Admin. Leader tidak perlu login.</p><form onSubmit={go}><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required autoComplete="username"/></label><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required autoComplete="current-password"/></label>{err&&<div className="error">{err}</div>}<button className="primary" disabled={busy}>{busy?'Masuk…':'Masuk Admin'}</button></form></div></div>}

function NikEntry(){
 const[nik,setNik]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('')
 async function go(e){e.preventDefault();const value=nik.trim();if(!value)return;setBusy(true);setErr('');const {data,error}=await supabase.rpc('lookup_employee_by_nik',{p_nik:value});if(error){setErr(error.message);setBusy(false);return}if(!data?.length){setErr('NIK tidak ditemukan atau tidak aktif.');setBusy(false);return}sessionStorage.setItem('ef_employee',JSON.stringify(data[0]));window.location.href='/';}
 return <div className="login nik-login"><div className="card login-card"><div className="brand">PT NEW ASIA INTERNATIONAL</div><h1>Extra Fooding</h1><p className="muted">Masukkan NIK untuk membuka kelompok kerja sesuai data karyawan.</p><form onSubmit={go}><label>NIK<input value={nik} onChange={e=>setNik(e.target.value.replace(/\D/g,''))} inputMode="numeric" autoFocus autoComplete="off" placeholder="Masukkan nomor NIK" maxLength={20} required/></label>{err&&<div className="error">{err}</div>}<button className="primary" disabled={busy}>{busy?'Mencari…':'Masuk'}</button></form><p className="admin-link"><a href="/admin">Login Admin</a></p></div></div>
}

function Header({profile,title}){const leave=()=>{if(profile.role==='leader'){sessionStorage.removeItem('ef_employee');window.location.href='/'}else supabase.auth.signOut()};return <header><div><div className="brand">PT NEW ASIA INTERNATIONAL</div><h1>{title}</h1></div><div className="user"><div><b>{profile.full_name||'-'}</b><small>{profile.role==='admin'?'ADMIN':profile.work_groups?.name||'-'}</small></div><button onClick={leave}>{profile.role==='leader'?'Ganti NIK':'Keluar'}</button></div></header>}
function Alert({message,error}){return <>{message&&<div className="notice">{message}</div>}{error&&<div className="error">{error}</div>}</>}

function Leader(){
 const stored=sessionStorage.getItem('ef_employee');
 const identity=stored?JSON.parse(stored):null;
 const[periods,setPeriods]=useState([]),[period,setPeriod]=useState(null),[employees,setEmployees]=useState([]),[entries,setEntries]=useState({}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[err,setErr]=useState('')
 useEffect(()=>{if(!identity){window.location.href='/';return}load()},[])
 async function load(){setErr('');const {data:p,error:pe}=await supabase.rpc('get_open_periods_for_nik',{p_nik:identity.nik});if(pe){setErr(pe.message);return}setPeriods(p||[]);if(p?.[0])setPeriod(p[0]);const {data:e,error:ee}=await supabase.rpc('get_group_employees_for_nik',{p_nik:identity.nik});if(ee)setErr(ee.message);else setEmployees(e||[])}
 useEffect(()=>{if(!period||!identity)return;supabase.rpc('get_ef_entries_for_nik',{p_nik:identity.nik,p_period_id:period.id}).then(({data,error})=>{if(error)setErr(error.message);else{const x={};(data||[]).forEach(r=>x[`${r.employee_id}_${r.food_date}`]=r);setEntries(x)}})},[period])
 const dates=useMemo(()=>dateList(period),[period])
 async function choose(emp,date,value){if(!period)return;setMessage('');const key=`${emp}_${date}`,old=entries[key];if(old?.status==='submitted'){setMessage('Data yang sudah submitted tidak dapat diubah.');return}setBusy(true);let result;if(value===''){result=await supabase.rpc('delete_ef_for_nik',{p_nik:identity.nik,p_period_id:period.id,p_employee_id:emp,p_food_date:date})}else{result=await supabase.rpc('upsert_ef_for_nik',{p_nik:identity.nik,p_period_id:period.id,p_employee_id:emp,p_food_date:date,p_shift:Number(value)})}if(result.error)setErr(result.error.message);else await reloadEntries();setBusy(false)}
 async function submit(){if(!period)return;const rows=Object.values(entries).filter(x=>x.status==='draft');if(!rows.length){setMessage('Tidak ada data draft untuk dikirim.');return}if(!confirm(`KONFIRMASI SIMPAN & KUNCI

Apakah kamu yakin ingin menyimpan ${rows.length} entri Extra Fooding untuk kelompok ${identity.group_name}?

Data yang sudah disimpan TIDAK DAPAT DIUBAH LAGI.

Jika terdapat masalah atau kesalahan data, silakan hubungi Admin.

Lanjutkan simpan dan kunci data?`))return;setBusy(true);const {error}=await supabase.rpc('submit_ef_for_nik',{p_nik:identity.nik,p_period_id:period.id});if(error)setErr(error.message);else{setMessage('Data berhasil disubmit dan dikunci.');await reloadEntries()}setBusy(false)}
 async function reloadEntries(){const {data,error}=await supabase.rpc('get_ef_entries_for_nik',{p_nik:identity.nik,p_period_id:period.id});if(error)setErr(error.message);else{const x={};(data||[]).forEach(r=>x[`${r.employee_id}_${r.food_date}`]=r);setEntries(x)}}
 function leave(){sessionStorage.removeItem('ef_employee');window.location.href='/'}
 const total=Object.keys(entries).length,submitted=Object.values(entries).filter(x=>x.status==='submitted').length
 const fakeProfile={full_name:identity.name,role:'leader',work_groups:{name:identity.group_name}}
 return <><Header profile={fakeProfile} title="Extra Fooding"/><main><div className="toolbar"><label>Periode<select value={period?.id||''} onChange={e=>setPeriod(periods.find(p=>p.id===e.target.value))}>{periods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="group-pill">NIK: <b>{identity.nik}</b> · Kelompok: <b>{identity.group_name}</b><span className="muted"> · {employees.length} karyawan</span></div><button onClick={leave}>Ganti NIK</button></div><Alert message={message} error={err}/>{!period&&<div className="empty">Belum ada periode yang dibuka Admin.</div>}{period&&<><div className="legend"><span>Shift 1 · 12:00–13:00</span><span>Shift 2 · 20:00–21:00</span><span>Shift 3 · 04:00–05:00</span><span>{total} entri · {submitted} terkunci</span></div><div className="hint">Kelompok kerja otomatis mengikuti NIK. Tidak ada pilihan kelompok lain. Pilih shift pada tanggal karyawan yang mendapat Extra Fooding. Setelah SUBMIT, data terkunci.</div><div className="leader-table-wrap table-wrap"><table><thead><tr><th>NIK</th><th>Nama</th>{dates.map(d=><th key={d}>{fmt(d)}</th>)}</tr></thead><tbody>{employees.map(e=><tr key={e.id}><td>{e.nik}</td><td className="name">{e.name}</td>{dates.map(d=>{const r=entries[`${e.id}_${d}`];return <td key={d}><select disabled={busy||r?.status==='submitted'} value={r?.shift||''} onChange={x=>choose(e.id,d,x.target.value)}><option value="">-</option><option value="1">S1</option><option value="2">S2</option><option value="3">S3</option></select>{r?.status==='submitted'&&<small className="lock">LOCK</small>}</td>})}</tr>)}</tbody></table></div><div className="bottom"><button className="primary" disabled={busy} onClick={submit}>SUBMIT & KUNCI</button></div></>}</main></>
}

function Admin({profile}){
 const[tabs,setTabs]=useState('dashboard'),[periods,setPeriods]=useState([]),[groups,setGroups]=useState([]),[employees,setEmployees]=useState([]),[leaders,setLeaders]=useState([]),[rows,setRows]=useState([]),[audits,setAudits]=useState([]),[selected,setSelected]=useState(''),[groupFilter,setGroupFilter]=useState('ALL'),[dateFilter,setDateFilter]=useState(''),[shiftFilter,setShiftFilter]=useState('ALL'),[msg,setMsg]=useState(''),[err,setErr]=useState(''),[loading,setLoading]=useState(false)
 const period=periods.find(p=>p.id===selected)||null
 async function loadBase(){setErr('');const [p,g,e,l]=await Promise.all([supabase.from('periods').select('*').order('start_date',{ascending:false}),supabase.from('work_groups').select('*').order('name'),supabase.from('employees').select('id,nik,name,active,work_group_id,work_groups(name)').order('name'),supabase.from('profiles').select('id,full_name,role,active,work_group_id,work_groups(name)').eq('role','leader').order('full_name')]);if(p.error||g.error||e.error||l.error){setErr(p.error?.message||g.error?.message||e.error?.message||l.error?.message);return}setPeriods(p.data||[]);setGroups(g.data||[]);setEmployees(e.data||[]);setLeaders(l.data||[]);if(!selected&&p.data?.[0])setSelected(p.data[0].id)}
 async function loadRows(){if(!selected){setRows([]);return}let q=supabase.from('extra_fooding').select('id,food_date,shift,status,submitted_at,employees!inner(id,nik,name,work_group_id,work_groups(name))').eq('period_id',selected).order('food_date').order('shift');if(groupFilter!=='ALL'){q=q.eq('employees.work_group_id',groupFilter)}if(dateFilter)q=q.eq('food_date',dateFilter);if(shiftFilter!=='ALL')q=q.eq('shift',Number(shiftFilter));const {data,error}=await q;if(error)setErr(error.message);else setRows(data||[])}
 async function loadAudit(){const {data,error}=await supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(300);if(error)setErr(error.message);else setAudits(data||[])}
 useEffect(()=>{loadBase()},[]);useEffect(()=>{loadRows()},[selected,groupFilter,dateFilter,shiftFilter]);useEffect(()=>{if(tabs==='audit')loadAudit()},[tabs])
 function flash(m){setMsg(m);setTimeout(()=>setMsg(''),3500)}
 async function savePeriod(form){const payload={name:form.name,start_date:form.start_date,end_date:form.end_date,status:form.status};if(!payload.name||!payload.start_date||!payload.end_date){setErr('Nama, tanggal mulai, dan tanggal selesai wajib diisi.');return}if(payload.end_date<payload.start_date){setErr('Tanggal selesai tidak boleh sebelum tanggal mulai.');return}if(daysBetween(payload.start_date,payload.end_date)!==7){setErr('Periode Extra Fooding harus tepat 7 hari agar format cetak mengikuti form Excel.');return}setLoading(true);const {error}=form.id?await supabase.from('periods').update(payload).eq('id',form.id):await supabase.from('periods').insert({...payload,created_by:profile.id});setLoading(false);if(error)setErr(error.message);else{flash('Periode tersimpan.');await loadBase()}}
 async function deletePeriod(id){if(!confirm('Hapus periode ini? Hanya periode tanpa entri yang sebaiknya dihapus.'))return;const {error}=await supabase.from('periods').delete().eq('id',id);if(error)setErr(error.message);else{flash('Periode dihapus.');setSelected('');await loadBase()}}
 async function saveEmployee(form){const payload={nik:form.nik,name:form.name,work_group_id:form.work_group_id,active:form.active};if(!payload.nik||!payload.name||!payload.work_group_id){setErr('NIK, nama, dan kelompok wajib diisi.');return}const {error}=form.id?await supabase.from('employees').update(payload).eq('id',form.id):await supabase.from('employees').insert(payload);if(error)setErr(error.message);else{flash('Karyawan tersimpan.');await loadBase()}}
 async function saveLeader(form){const payload={full_name:form.full_name,role:'leader',work_group_id:form.work_group_id||null,active:form.active};const {error}=await supabase.from('profiles').update(payload).eq('id',form.id);if(error)setErr(error.message);else{flash('Profil leader diperbarui.');await loadBase()}}
 async function correct(id,shift){const val=shift===''?null:Number(shift);if(!confirm('Simpan koreksi Admin pada entri ini?'))return;const {error}=val===null?await supabase.from('extra_fooding').delete().eq('id',id):await supabase.from('extra_fooding').update({shift:val,status:'submitted',submitted_by:profile.id,submitted_at:new Date().toISOString()}).eq('id',id);if(error)setErr(error.message);else{flash('Koreksi tersimpan.');await loadRows()}}
 function exportCsv(){const headers=['Tanggal','Shift','Jam','NIK','Nama','Kelompok','Status'];const lines=[headers,...rows.map(r=>[r.food_date,SHIFT[r.shift]?.label||'',SHIFT[r.shift]?.time||'',r.employees?.nik||'',r.employees?.name||'',r.employees?.work_groups?.name||'',r.status])].map(a=>a.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(','));const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`extra-fooding-${period?.name||'laporan'}.csv`;a.click();URL.revokeObjectURL(a.href)}
 async function printReport(){
  if(!period){setErr('Pilih periode terlebih dahulu.');return}
  setErr('');
  const {data:empData,error:ee}=await supabase.from('employees').select('id,nik,name,active,work_group_id,work_groups(name)').eq('active',true).order('name');
  if(ee){setErr(ee.message);return}
  const {data:entryData,error:xe}=await supabase.from('extra_fooding').select('employee_id,food_date,shift,status').eq('period_id',period.id);
  if(xe){setErr(xe.message);return}
  const byEmployee={};
  (entryData||[]).forEach(r=>{(byEmployee[r.employee_id]??={})[r.food_date]=r})
  const selectedGroups=groupFilter==='ALL'?groups:groups.filter(g=>g.id===groupFilter);
  if(!selectedGroups.length){setErr('Kelompok kerja tidak ditemukan.');return}
  const dateCols=dateList(period);
  const periodLabel=`${fmt(period.start_date)}-${fmt(period.end_date)}`;
  const escapeHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const logoSrc='data:image/png;base64,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';

  const groupPage=(group,pageEmployees)=>{
    const rowsHtml=Array.from({length:35},(_,i)=>{
      const e=pageEmployees[i];
      if(!e)return `<tr><td class="center">${i+1}</td><td></td><td></td>${dateCols.map(()=>'<td class="food blank"></td>').join('')}<td></td><td class="sign-cell"></td></tr>`;
      const map=byEmployee[e.id]||{};
      const total=dateCols.reduce((n,d)=>n+(map[d]?1:0),0);
      return `<tr><td class="center">${i+1}</td><td class="nik">${escapeHtml(e.nik)}</td><td class="name-cell">${escapeHtml(e.name)}</td>${dateCols.map(d=>{const r=map[d];if(!r)return `<td class="food empty"><svg class="food-mark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/></svg></td>`;const t=SHIFT[r.shift]?.time||'';const [start,end]=t.split('–');return `<td class="food filled"><svg class="food-mark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="100" x2="100" y2="0"/></svg><div class="shift-time"><span class="start-time">${start||''}</span><span class="end-time">${end||''}</span></div></td>`}).join('')}<td class="center total">${total||''}</td><td class="sign-cell"></td></tr>`
    }).join('');
    const total=pageEmployees.filter(Boolean).reduce((n,e)=>n+dateCols.filter(d=>byEmployee[e.id]?.[d]).length,0);
    const dayTotals=dateCols.map(d=>pageEmployees.filter(e=>e&&byEmployee[e.id]?.[d]).length||'');
    return `<section class="ef-page">
      <table class="top-table"><tr>
        <td class="logo-cell"><img src="${logoSrc}" alt="NAI"></td>
        <td class="title-cell" colspan="10"><div class="doc-title">Extra fooding 生产班中就餐补贴单</div></td>
      </tr><tr>
        <td class="logo-spacer"></td>
        <td class="company-cell" colspan="10">PT NEW ASIA INTERNATIONAL</td>
      </tr></table>
      <table class="meta-table">
        <tr>
          <td class="meta-label">Departemen<br>部门</td><td class="meta-value dept">SLITTING</td>
          <td class="meta-label">Grup Kerja<br>班组</td><td class="meta-value group">${escapeHtml(group.name === 'EF' ? 'SLITTING' : group.name)}</td>
          <td class="meta-label">JAM AWAL<br>开始时间</td><td class="meta-value"></td>
          <td class="meta-label">JAM AKHIR<br>结束时间</td><td class="meta-value"></td>
          <td class="meta-label">Periode<br>月份</td><td class="meta-value">${periodLabel}</td>
        </tr>
        <tr class="sign-row">
          <td colspan="3">TTD Kepala bagian<br>负责人</td><td></td>
          <td colspan="3">TTD Kepala Divisi<br>部门主管</td><td></td>
          <td colspan="2"></td>
        </tr>
      </table>
      <table class="ef-table">
        <colgroup>
          <col class="c-no"><col class="c-nik"><col class="c-name">
          ${dateCols.map(()=>'<col class="c-day">').join('')}
          <col class="c-total"><col class="c-sign">
        </colgroup>
        <thead><tr>
          <th>NO<br>序号</th><th>NIK 工号</th><th>Nama Karyawan 员工姓名</th>
          ${dateCols.map(d=>`<th>${fmt(d)}日</th>`).join('')}
          <th>Total<br>合计</th><th class="sign-cell">TTD Karyawan<br>员工签字</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr><td></td><td colspan="2" class="footer-label">Nomor sistem NAI</td><td colspan="9"></td></tr>
          <tr><td></td><td colspan="2" class="footer-label">Nomor sistem KBM</td><td colspan="9"></td></tr>
          <tr><td></td><td colspan="2" class="footer-label">Nomor sistem MAR</td><td colspan="9"></td></tr>
        </tfoot>
      </table>
    </section>`
  };

  const pages=[];
  selectedGroups.forEach(g=>{
    const groupEmployees=(empData||[]).filter(e=>e.work_group_id===g.id);
    const prefixes=['19','23','26'];
    const grouped=[];
    prefixes.forEach(prefix=>{
      const block=groupEmployees.filter(e=>String(e.nik||'').startsWith(prefix));
      if(block.length){grouped.push(...block);grouped.push(null)}
    });
    const others=groupEmployees.filter(e=>!prefixes.some(prefix=>String(e.nik||'').startsWith(prefix)));
    if(others.length){grouped.push(...others)}
    while(grouped.length&&grouped[grouped.length-1]===null)grouped.pop();
    if(!grouped.length)pages.push(groupPage(g,[]));
    else for(let i=0;i<grouped.length;i+=35)pages.push(groupPage(g,grouped.slice(i,i+35)));
  });

  const win=window.open('','_blank','width=1200,height=900');
  if(!win){setErr('Popup diblokir browser. Izinkan popup untuk mencetak.');return}
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>FORM EXTRA FOODING - ${escapeHtml(period.name)}</title><style>${printCss()}</style></head><body>${pages.join('')}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(),500);
 }

 const filteredGroups=groupFilter==='ALL'?groups:groups.filter(g=>g.id===groupFilter)
 return <><Header profile={profile} title="Admin Extra Fooding"/><main className="admin-main"><nav className="tabs">{[['dashboard','Dashboard'],['data','Data & Koreksi'],['periods','Periode'],['employees','Karyawan'],['leaders','Leader'],['audit','Audit']].map(([id,label])=><button key={id} className={tabs===id?'active':''} onClick={()=>setTabs(id)}>{label}</button>)}</nav><Alert message={msg} error={err}/>{tabs==='dashboard'&&<Dashboard periods={periods} groups={groups} rows={rows} period={period} selected={selected} setSelected={setSelected} setTab={setTabs}/>} {tabs==='data'&&<DataTab period={period} periods={periods} selected={selected} setSelected={setSelected} groups={groups} groupFilter={groupFilter} setGroupFilter={setGroupFilter} dateFilter={dateFilter} setDateFilter={setDateFilter} shiftFilter={shiftFilter} setShiftFilter={setShiftFilter} rows={rows} correct={correct} exportCsv={exportCsv} printReport={printReport}/>} {tabs==='periods'&&<PeriodsTab periods={periods} save={savePeriod} remove={deletePeriod} busy={loading}/>} {tabs==='employees'&&<EmployeesTab employees={employees} groups={groups} save={saveEmployee}/>} {tabs==='leaders'&&<LeadersTab leaders={leaders} groups={groups} save={saveLeader}/>} {tabs==='audit'&&<AuditTab audits={audits}/>}</main></>}

function Dashboard({periods,groups,rows,period,selected,setSelected,setTab}){return <section><div className="page-title"><div><h2>Dashboard</h2><p className="muted">Ringkasan periode dan pemantauan pengisian.</p></div><select className="compact" value={selected} onChange={e=>setSelected(e.target.value)}>{periods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="stats big"><div><b>{groups.length}</b><span>Kelompok kerja</span></div><div><b>{rows.length}</b><span>Entri periode terpilih</span></div><div><b>{rows.filter(r=>r.status==='submitted').length}</b><span>Submitted</span></div><div><b>{rows.filter(r=>r.status==='draft').length}</b><span>Draft</span></div></div><div className="card pad"><h3>Periode aktif</h3>{period?<p><b>{period.name}</b> · {fmtLong(period.start_date)} – {fmtLong(period.end_date)} · <Status status={period.status}/></p>:<p className="muted">Belum ada periode.</p>}<button className="primary" onClick={()=>setTab('data')}>Buka data</button></div></section>}
function Status({status}){return <span className={`status ${status}`}>{status}</span>}
function DataTab({period,periods,selected,setSelected,groups,groupFilter,setGroupFilter,dateFilter,setDateFilter,shiftFilter,setShiftFilter,rows,correct,exportCsv,printReport}){return <section><div className="page-title"><div><h2>Data & Koreksi</h2><p className="muted">Admin dapat mengoreksi data yang sudah submitted; perubahan tercatat di audit.</p></div><div className="actions"><button onClick={exportCsv}>Export CSV / Excel</button><button onClick={printReport}>Cetak</button></div></div><div className="filters"><label>Periode<select value={selected} onChange={e=>setSelected(e.target.value)}>{periods.map(p=><option key={p.id} value={p.id}>{p.name} — {p.status}</option>)}</select></label><label>Kelompok<select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option value="ALL">Semua kelompok</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label>Tanggal<input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></label><label>Shift<select value={shiftFilter} onChange={e=>setShiftFilter(e.target.value)}><option value="ALL">Semua</option><option value="1">Shift 1</option><option value="2">Shift 2</option><option value="3">Shift 3</option></select></label></div><div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Shift</th><th>Jam</th><th>NIK</th><th>Nama</th><th>Kelompok</th><th>Status</th><th className="no-print">Koreksi</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{fmtLong(r.food_date)}</td><td>{SHIFT[r.shift]?.label}</td><td>{SHIFT[r.shift]?.time}</td><td>{r.employees?.nik}</td><td>{r.employees?.name}</td><td>{r.employees?.work_groups?.name}</td><td><Status status={r.status}/></td><td className="no-print"><select value={r.shift} onChange={e=>correct(r.id,e.target.value)}><option value="1">S1</option><option value="2">S2</option><option value="3">S3</option><option value="">Hapus</option></select></td></tr>)}</tbody></table>{!rows.length&&<div className="empty">Tidak ada data sesuai filter.</div>}</div></section>}
function PeriodsTab({periods,save,remove,busy}){const blank={id:'',name:'',start_date:'',end_date:'',status:'draft'};const[form,setForm]=useState(blank);return <section><div className="page-title"><div><h2>Periode</h2><p className="muted">Buat periode baru. Untuk menjaga format cetak sama seperti Excel, periode wajib 7 hari.</p></div><button onClick={()=>setForm({...blank})}>+ Periode Baru</button></div><div className="card pad form-grid"><label>Nama<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Extra Fooding 24-30 September 2026"/></label><label>Mulai<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label><label>Selesai<input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="open">Open</option><option value="locked">Locked</option></select></label><div><button className="primary" disabled={busy} onClick={()=>save(form)}>Simpan</button></div></div><div className="cards-list">{periods.map(p=><div className="card row-card" key={p.id}><div><b>{p.name}</b><div className="muted">{fmtLong(p.start_date)} – {fmtLong(p.end_date)} · <Status status={p.status}/></div></div><div className="actions"><button onClick={()=>setForm(p)}>Edit</button><button className="danger" onClick={()=>remove(p.id)}>Hapus</button></div></div>)}</div></section>}
function EmployeesTab({employees,groups,save}){const blank={id:'',nik:'',name:'',work_group_id:groups[0]?.id||'',active:true};const[form,setForm]=useState(blank);const[q,setQ]=useState('');const list=employees.filter(e=>(`${e.nik} ${e.name}`.toLowerCase()).includes(q.toLowerCase()));return <section><div className="page-title"><div><h2>Karyawan</h2><p className="muted">Total {employees.length} data.</p></div><button onClick={()=>setForm({...blank,work_group_id:groups[0]?.id||''})}>+ Karyawan</button></div><div className="filters"><label>Pencarian<input value={q} onChange={e=>setQ(e.target.value)} placeholder="NIK / nama"/></label></div><div className="card pad form-grid"><label>NIK<input value={form.nik} onChange={e=>setForm({...form,nik:e.target.value})}/></label><label>Nama<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Kelompok<select value={form.work_group_id} onChange={e=>setForm({...form,work_group_id:e.target.value})}>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label>Aktif<select value={String(form.active)} onChange={e=>setForm({...form,active:e.target.value==='true'})}><option value="true">Ya</option><option value="false">Tidak</option></select></label><div><button className="primary" onClick={()=>save(form)}>Simpan</button></div></div><div className="table-wrap"><table><thead><tr><th>NIK</th><th>Nama</th><th>Kelompok</th><th>Aktif</th><th>Aksi</th></tr></thead><tbody>{list.map(e=><tr key={e.id}><td>{e.nik}</td><td>{e.name}</td><td>{e.work_groups?.name}</td><td>{e.active?'Ya':'Tidak'}</td><td><button onClick={()=>setForm(e)}>Edit</button></td></tr>)}</tbody></table></div></section>}
function LeadersTab({leaders,groups,save}){const[edit,setEdit]=useState(null);return <section><div className="page-title"><div><h2>Leader</h2><p className="muted">Kelompok leader ditentukan Admin dan tidak dapat dipilih sendiri oleh leader.</p></div></div><div className="table-wrap"><table><thead><tr><th>Nama</th><th>UID</th><th>Kelompok</th><th>Aktif</th><th>Aksi</th></tr></thead><tbody>{leaders.map(l=><tr key={l.id}><td>{l.full_name}</td><td className="mono">{l.id}</td><td>{l.work_groups?.name||'-'}</td><td>{l.active?'Ya':'Tidak'}</td><td><button onClick={()=>setEdit(l)}>Edit</button></td></tr>)}</tbody></table></div>{edit&&<div className="modal-backdrop"><div className="modal card"><h3>Edit Leader</h3><label>Nama<input value={edit.full_name||''} onChange={e=>setEdit({...edit,full_name:e.target.value})}/></label><label>Kelompok<select value={edit.work_group_id||''} onChange={e=>setEdit({...edit,work_group_id:e.target.value})}><option value="">-</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label>Aktif<select value={String(edit.active)} onChange={e=>setEdit({...edit,active:e.target.value==='true'})}><option value="true">Ya</option><option value="false">Tidak</option></select></label><div className="actions"><button onClick={()=>setEdit(null)}>Batal</button><button className="primary" onClick={()=>{save(edit);setEdit(null)}}>Simpan</button></div></div></div>}</section>}
function AuditTab({audits}){return <section><div className="page-title"><div><h2>Audit</h2><p className="muted">Riwayat perubahan yang dicatat database.</p></div></div><div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Tabel</th><th>Record ID</th><th>Data baru</th></tr></thead><tbody>{audits.map(a=><tr key={a.id}><td>{new Date(a.created_at).toLocaleString('id-ID')}</td><td className="mono">{a.actor_user_id||'-'}</td><td>{a.action}</td><td>{a.table_name}</td><td className="mono">{a.record_id||'-'}</td><td><pre>{JSON.stringify(a.new_data||{},null,2)}</pre></td></tr>)}</tbody></table></div></section>}

createRoot(document.getElementById('root')).render(<App/>);

function printCss(){return `
  @page{size:A4 portrait;margin:7mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Calibri,sans-serif}
  body{font-size:9px}
  .ef-page{width:196mm;height:283mm;min-height:0;page-break-after:always;break-after:page;overflow:hidden}
  .ef-page:last-child{page-break-after:auto;break-after:auto}
  table{border-collapse:collapse;border-spacing:0}
  .top-table{width:100%;table-layout:fixed;border:1px solid #000}
  .top-table td{border:1px solid #000;height:8mm;padding:0}
  .logo-cell{width:25mm;height:12mm!important;text-align:left;vertical-align:middle;padding-left:1mm!important}
  .logo-cell img{width:19mm;height:11mm;object-fit:contain;display:block}
  .logo-spacer{width:25mm;height:6mm!important;border-top:0!important}
  .title-cell{height:8mm!important;text-align:center;vertical-align:middle}
  .doc-title{font-size:16px;font-weight:700;line-height:1}
  .company-cell{height:7mm!important;text-align:center;font-size:15px;font-weight:700;vertical-align:middle}

  .meta-table{width:100%;table-layout:fixed;border:1px solid #000}
  .meta-table td{border:1px solid #000;text-align:center;vertical-align:middle;height:9mm;padding:1mm;font-size:8px;line-height:1.05}
  .meta-table td:last-child{border-right:1px solid #000}
  .meta-table .meta-label{font-weight:400}
  .meta-table .meta-value{font-weight:700}
  .meta-table .dept,.meta-table .group{font-size:9px}
  .sign-row td{height:10mm!important;font-size:8px}
  .sign-row td[colspan="3"]{font-weight:700}

  .ef-table{width:100%;table-layout:fixed;border:1px solid #000}
  .ef-table th,.ef-table td{border:1px solid #000;text-align:center;vertical-align:middle;padding:0;font-size:7.5px;line-height:1.05;height:5.5mm}
  .ef-table th{height:8.5mm;font-size:8px;font-weight:700}
  .ef-table .c-no{width:7mm}.ef-table .c-nik{width:18mm}.ef-table .c-name{width:46mm}
  .ef-table .c-day{width:13mm}.ef-table .c-total{width:14mm}.ef-table .c-sign{width:20mm}
  /* Paksa garis kanan kolom TTD tetap tercetak seperti border kanan tabel meta */
  .ef-table tr > :last-child{border-right:0!important;position:relative}
  .ef-table tr > :last-child::after{content:"";position:absolute;top:-1px;right:-1px;bottom:-1px;width:1px;background:#000;display:block;pointer-events:none;z-index:20}
  .ef-table .sign-cell{position:relative}
  .ef-table .nik{font-size:8.5px;font-weight:700}
  .ef-table .name-cell{text-align:left;padding-left:1.2mm;font-size:8px;font-weight:700;white-space:normal;word-break:normal}
  .ef-table .food{height:5.5mm;position:relative;overflow:hidden;padding:0!important}
  .food.blank{background:#fff}
  .food-mark{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;pointer-events:none}
  .food-mark line{stroke:#000;stroke-width:1.2;vector-effect:non-scaling-stroke}
  .xmark{display:none}
  .shift-time{position:relative;z-index:2;display:block;width:100%;height:100%;font-size:7px;font-weight:700;line-height:1;background:transparent}
  .start-time{position:absolute;left:1mm;top:.7mm}
  .end-time{position:absolute;right:1mm;bottom:.7mm}
  .total{font-size:8.5px;font-weight:700}
  .footer-label{text-align:left!important;padding-left:2mm!important;font-weight:700;font-size:7.5px!important}
  .shift-legend{font-size:7.5px;margin-top:2mm;line-height:1.2}
  .center{text-align:center}
  @media print{.ef-page{break-after:page}.ef-page:last-child{break-after:auto}}
 `}

