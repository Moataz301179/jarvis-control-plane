if (window.location.protocol === 'file:') window.location.replace('http://127.0.0.1:13100/');
  const state = { status: null, data: null, settings: null, ollamaStatus: null, telegramStatus: null, nousStatus: null, agentRingStatus: null, githubStatus: null, repositories: [], ventureRepositories: [], capabilityAudit: null, hermesState: null, memoryEntries: [], approvals: [], accountConnections: [], factory: {catalog:null,agents:[],runs:[],schedules:[],handoffs:[]}, selectedAgent: null, selectedProject: null, conversationId: null, chatMessages: [], imageData: null, imageName: null, muted: false, micMuted: false, listening: false, elevenStatus: null, voiceSession: null, voiceAudio: null, voiceAudioUrl: null, voiceAudioContext: null, voiceAudioSource: null, audioMeterFrame: null, wakeArmed: false, wakeStarting: false, wakeRecognition: null, wakeRestartTimer: null, rearmAfterVoice: false, autoWake: false };
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const titleCase = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const formatTime = (value) => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const statusBadge = (status) => `<span class="status ${esc(status)}">${esc(titleCase(status))}</span>`;

function installAudioControls(){
  const mute=$('#muteButton');const head=$('.mini-chat-head');const rail=$('#openChat');
  if(!mute||!head||!rail)return;
  mute.classList.add('audio-toggle');mute.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg><span id="muteLabel">MIC ON</span>';
  const mic=$('#micButton');mic.classList.add('wake-toggle');mic.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg><span id="micLabel">VOICE</span>';
  const talk=document.createElement('button');talk.id='talkButton';talk.className='command-talk-control';talk.type='button';talk.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg><span class="talk-copy"><strong>TALK TO JARVIS</strong><small id="talkStateLabel">CLICK TO SPEAK</small></span>';document.getElementById('commandRoom')?.appendChild(talk);
  const indicator=document.createElement('div');indicator.id='soundIndicator';indicator.className='sound-indicator';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');indicator.innerHTML='<span class="sound-kicker">MICROPHONE</span><span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><strong id="soundStateLabel">MIC ON</strong>';
  head.insertAdjacentElement('afterend',indicator);
  const railState=document.createElement('small');railState.id='railAudioState';railState.className='rail-audio-state';railState.textContent='MIC ON';rail.append(railState);
  renderSoundState();
}
function installClaudeControls(){
  const agentsView=$('#view-agents');const grid=$('#agentGrid');if(!agentsView||!grid||$('#claudePanel'))return;
  const panel=document.createElement('article');panel.id='claudePanel';panel.className='panel claude-panel';
  panel.innerHTML=`<div class="panel-head"><div><span class="micro">PRIMARY EXECUTION · CLAUDE CODE</span><h3>Yes Boss engineering and memory</h3></div><span id="claudeCodeStatus" class="status">CHECKING</span></div><div class="grid-2"><div><div class="system-row"><div><strong>Claude Code runtime</strong><small id="claudeCodeProfile">Mac bridge · waiting for heartbeat</small></div><span id="claudeCodeGateway" class="pill off">OFFLINE</span></div><p class="muted">Claude Code receives the Yes Boss operating personality, project-scoped memory, an evidence gate, and the approved workspace. Successful work products are written back to shared memory.</p><form id="claudeJobForm" class="form-grid"><label>PROJECT<select id="claudeProject"><option value="STUDIO">STUDIO</option><option value="HV">HOTELSVENDORS</option></select></label><label>TASK CLASS<select id="claudeTaskClass"><option value="review">REVIEW · PLAN</option><option value="build">BUILD · EDIT</option></select></label><label>PERMISSION<select id="claudePermission"><option value="plan">PLAN</option><option value="acceptEdits">ACCEPT EDITS</option></select></label><label class="wide">MISSION TITLE<input id="claudeTitle" required maxlength="200" placeholder="What should Claude Code do?"></label><label class="wide">INSTRUCTION<textarea id="claudeInstruction" rows="4" required maxlength="12000" placeholder="Give Claude Code the outcome, constraints, evidence and acceptance criteria."></textarea></label><div class="form-actions"><button class="holo-button primary" type="submit">QUEUE CLAUDE CODE JOB</button></div></form><p id="claudeMessage" class="status-message"></p></div><div><div id="claudeJobs" class="stack"></div></div></div>`;
  agentsView.insertBefore(panel,grid);
  const runtimeRow=$('#claudeCodeGateway')?.closest('.system-row');const egmRow=document.createElement('div');egmRow.className='system-row';egmRow.innerHTML='<div><strong>Elephant-Goldfish Model</strong><small>Design, review, resolve and drift workflows</small></div><span id="claudeEgmStatus" class="pill off">CHECKING</span>';runtimeRow?.insertAdjacentElement('afterend',egmRow);
  const taskLabel=$('#claudeTaskClass')?.closest('label');const egmLabel=document.createElement('label');egmLabel.innerHTML='EGM WORKFLOW<select id="claudeEgmMode"><option value="auto">AUTO · INFER</option><option value="review-loop">REVIEW LOOP</option><option value="review">REVIEW</option><option value="draft">DESIGN DRAFT</option><option value="brainstorm">BRAINSTORM</option><option value="resolve">RESOLVE</option><option value="drift-report">DRIFT REPORT</option><option value="bootstrap">BOOTSTRAP</option><option value="off">OFF</option></select>';taskLabel?.insertAdjacentElement('afterend',egmLabel);
  $('#claudeJobForm').addEventListener('submit',async(e)=>{e.preventDefault();const project=$('#claudeProject').value;const workspace=project==='HV'?'/Users/Moatazi/hotels-vendors-new':'/Users/Moatazi/Documents/ChatGPT/Jarvis';const taskClass=$('#claudeTaskClass').value;const permission=$('#claudePermission').value;const egmMode=$('#claudeEgmMode').value==='auto'?'off':$('#claudeEgmMode').value;try{await api('/v1/agents/claude/jobs',{method:'POST',body:JSON.stringify({project_code:project,workspace,prompt:`${$('#claudeTitle').value}\n\n${$('#claudeInstruction').value}`,task_class:taskClass,permission_mode:permission,egm_mode:egmMode})});$('#claudeTitle').value='';$('#claudeInstruction').value='';$('#claudeMessage').textContent='Claude Code job queued with Yes Boss personality, memory and EGM routing';await loadClaudeState();}catch(err){$('#claudeMessage').textContent=err.message;}});
}
function renderClaude(){const node=$('#claudeCodeStatus');if(!node)return;const data=state.claudeState||{};const bridge=data.bridge||{};const cc=bridge.claude_code||{};const online=Boolean(bridge.online&&cc.ready);node.textContent=online?'READY':bridge.online?'AUTH CHECK':'NOT CONNECTED';node.className=`status ${online?'completed':'failed'}`;const authLabel=cc.auth?.openrouter_key?'OpenRouter Keychain':cc.auth?.auth_method||'authenticated';$('#claudeCodeProfile').textContent=online?`Claude Code ${cc.version||''} · ${authLabel} · memory-aware`:bridge.online?'Mac bridge online · Claude auth unavailable':'Mac bridge unavailable';$('#claudeCodeGateway').textContent=online?'READY':'OFFLINE';$('#claudeCodeGateway').className=`pill ${online?'':'off'}`;const jobs=data.jobs||[];$('#claudeJobs').innerHTML=jobs.length?jobs.slice(0,20).map(job=>`<div class="system-row"><div><strong>${esc(job.params?.prompt?.split('\n')[0]||'Claude Code mission')}</strong><small>${esc(job.params?.project_code||'STUDIO')} · ${esc(job.risk)} · ${formatTime(job.created_at)} · memory ${job.params?.memory_context_count||0} entries</small>${job.error?`<small>${esc(job.error)}</small>`:''}</div>${statusBadge(job.status)}</div>`).join(''):'<div class="empty-state">No Claude Code jobs yet.</div>';}
function renderEgmState(){const node=$('#claudeEgmStatus');if(!node)return;const egm=state.claudeState?.egm||{};const installed=Number(egm.installed||0);node.textContent=installed>=7?'INSTALLED':'NOT READY';node.className=`pill ${installed>=7?'':'off'}`;node.title=installed?`${installed} EGM skills installed`:'EGM skills not registered';}
async function loadClaudeState(){try{state.claudeState=await api('/v1/agents/claude/state');renderClaude();renderEgmState();}catch(error){const node=$('#claudeCodeStatus');if(node){node.textContent='CHECK FAILED';node.className='status failed';}console.error(error);}}
function installHermesControls(){
  const agentsView=$('#view-agents');const grid=$('#agentGrid');if(!agentsView||!grid||$('#hermesPanel'))return;
  const hermes=document.createElement('article');hermes.id='hermesPanel';hermes.className='panel';hermes.innerHTML=`<div class="panel-head"><div><span class="micro">HERMES EXECUTION BRIDGE</span><h3>Employee execution and shared memory</h3></div><span id="hermesBridgeStatus" class="status">NOT CONNECTED</span></div><div class="grid-2"><div><div class="system-row"><div><strong>Bridge profile</strong><small id="hermesProfile">default · waiting for heartbeat</small></div><span id="hermesGateway" class="pill off">OFFLINE</span></div><p class="muted">The Mac bridge uses the Hermes default profile and gives each job only the selected toolsets. Successful results are written into project memory automatically.</p><form id="hermesJobForm" class="form-grid"><label>PROJECT<select id="hermesProject"><option value="STUDIO">STUDIO</option></select></label><label>TOOLSET<select id="hermesToolset"><option value="file">FILE</option><option value="web">WEB</option><option value="memory">MEMORY</option><option value="todo">TODO</option><option value="terminal">TERMINAL · REVIEW</option><option value="code_execution">CODE EXECUTION · REVIEW</option></select></label><label class="wide">MISSION TITLE<input id="hermesTitle" required maxlength="200"></label><label class="wide">INSTRUCTION<textarea id="hermesInstruction" rows="4" required maxlength="12000"></textarea></label><div class="form-actions"><button class="holo-button primary" type="submit">QUEUE HERMES JOB</button></div></form><p id="hermesMessage" class="status-message"></p></div><div><div id="hermesJobs" class="stack"></div></div></div>`;
  const memory=document.createElement('article');memory.id='sharedMemoryPanel';memory.className='panel';memory.innerHTML=`<div class="panel-head"><div><span class="micro">PROJECT-SCOPED SHARED MEMORY</span><h3>JARVIS and execution agents</h3></div><span id="memoryCount" class="pill">0 ENTRIES</span></div><div class="grid-2"><div><form id="memorySearchForm" class="form-grid"><label>PROJECT<select id="memoryProject"><option value="STUDIO">STUDIO</option><option value="HV">HOTELSVENDORS</option></select></label><label class="wide">SEARCH MEMORY<input id="memoryQuery" placeholder="decision, blocker, supplier, architecture…"></label><div class="form-actions"><button class="holo-button" type="submit">SEARCH</button></div></form><div id="memorySearchResults" class="stack" style="margin-top:12px"></div></div><form id="memoryForm" class="form-grid"><label>PROJECT<select id="memoryWriteProject"><option value="STUDIO">STUDIO</option><option value="HV">HOTELSVENDORS</option></select></label><label>AGENT<select id="memoryAgent"><option value="jarvis">JARVIS</option><option value="hermes-cto">HERMES</option><option value="forge-office">FORGE</option></select></label><label class="wide">TITLE<input id="memoryTitle" required maxlength="240"></label><label class="wide">MEMORY CONTENT<textarea id="memoryContent" rows="5" required maxlength="20000"></textarea></label><div class="form-actions"><button class="holo-button primary" type="submit">WRITE MEMORY</button></div></form><p id="memoryMessage" class="status-message"></p></div></div>`;
  agentsView.insertBefore(hermes,grid);agentsView.insertBefore(memory,grid);
  $('#hermesJobForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await api('/v1/hermes/jobs',{method:'POST',body:JSON.stringify({project_code:$('#hermesProject').value,title:$('#hermesTitle').value,instruction:$('#hermesInstruction').value,toolsets:[$('#hermesToolset').value]})});$('#hermesTitle').value='';$('#hermesInstruction').value='';$('#hermesMessage').textContent='Hermes job queued';await loadData();}catch(err){$('#hermesMessage').textContent=err.message;}});
  $('#memorySearchForm').addEventListener('submit',async(e)=>{e.preventDefault();try{const data=await api(`/v1/memory?project_code=${encodeURIComponent($('#memoryProject').value)}&q=${encodeURIComponent($('#memoryQuery').value)}`);state.memoryEntries=data.memories;renderMemory();}catch(err){$('#memoryMessage').textContent=err.message;}});
  $('#memoryForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await api('/v1/memory',{method:'POST',body:JSON.stringify({project_code:$('#memoryWriteProject').value,agent_id:$('#memoryAgent').value,memory_type:'note',title:$('#memoryTitle').value,content:$('#memoryContent').value,tags:['owner-entry']})});$('#memoryTitle').value='';$('#memoryContent').value='';$('#memoryMessage').textContent='Memory written';await loadData();}catch(err){$('#memoryMessage').textContent=err.message;}});
}
function installAgentFactory(){
  const view=$('#view-agents'),grid=$('#agentGrid');if(!view||!grid||$('#agentFactoryPanel'))return;
  const panel=document.createElement('article');panel.id='agentFactoryPanel';panel.className='panel';
  panel.innerHTML=`<div class="panel-head"><div><span class="micro">JARVIS AGENT FACTORY · HERMES RUNTIME</span><h3>Create specialists from the connected Hermes inventory</h3></div><span id="factoryBridge" class="status">CHECKING</span></div><p class="muted">The cloud Hermes runtime is the default for continuous work. The Mac runtime is reserved for tasks that need the owner’s Mac. Indexed skills and integrations are not treated as connected capabilities. Select the exact workspace whenever you grant file, terminal, code or desktop access.</p><div class="grid-2"><form id="factoryDefinitionForm" class="form-grid"><label>NAME<input id="factoryName" required maxlength="120" placeholder="Research specialist"></label><label>SLUG<input id="factorySlug" required maxlength="63" placeholder="market-research"></label><label>PROJECT<select id="factoryProject"><option value="STUDIO">STUDIO</option><option value="HV">HOTELSVENDORS</option></select></label><label>RUNTIME<select id="factoryTarget"><option value="cloud">JARVIS CLOUD · 24/7</option><option value="mac">OWNER MAC</option></select></label><label>MODEL PROVIDER<select id="factoryProvider"><option value="ollama-cloud">OLLAMA CLOUD</option></select></label><label class="wide">MODEL<input id="factoryModel" required value="deepseek-v4.1-flash"></label><label>HERMES PROFILE<select id="factoryProfile"><option value="default">default</option></select></label><label>POLICY<select id="factoryPolicy"><option value="standard">STANDARD</option><option value="strict">STRICT</option><option value="permissive">PERMISSIVE</option><option value="experimental">EXPERIMENTAL</option></select></label><label class="wide">AUTHORIZED WORKSPACE<input id="factoryWorkspace" maxlength="500" placeholder="Exact path inside the selected runtime’s project workspace"></label><label class="wide">DESCRIPTION<input id="factoryDescription" maxlength="2000" placeholder="Role and boundaries"></label><label class="wide">HERMES TOOLSETS<select id="factoryTools" multiple size="5"></select><small>Hold Command on Mac to select multiple. Powerful toolsets require owner approval.</small></label><label class="wide">INSTALLED HERMES SKILLS<select id="factorySkills" multiple size="5"></select><small>Only skills confirmed present in the selected Hermes runtime can be assigned.</small></label><div class="form-actions"><button class="holo-button primary" type="submit">CREATE DRAFT AGENT</button></div><p id="factoryMessage" class="status-message"></p></form><div><div class="panel-head"><div><span class="micro">REGISTERED AGENTS</span><h3>Draft, testing and active</h3></div></div><div id="factoryAgents" class="stack"></div></div></div><div class="grid-2" style="margin-top:20px"><form id="factoryRunForm" class="form-grid"><label>AGENT<select id="factoryRunAgent" required></select></label><label>RUN OBJECTIVE<input id="factoryObjective" required maxlength="4000" placeholder="Give this agent a bounded task"></label><div class="form-actions"><button class="holo-button" type="submit">RUN THROUGH HERMES</button></div></form><form id="factoryScheduleForm" class="form-grid"><label>ACTIVE AGENT<select id="factoryScheduleAgent" required></select></label><label>SCHEDULE TITLE<input id="factoryScheduleTitle" required maxlength="180"></label><label>INTERVAL MINUTES<input id="factoryInterval" type="number" min="5" max="10080" value="1440" required></label><label class="wide">REPEATING OBJECTIVE<input id="factoryScheduleObjective" required maxlength="4000"></label><div class="form-actions"><button class="holo-button" type="submit">CREATE SCHEDULE</button></div></form></div><div class="grid-2" style="margin-top:20px"><div><h4>Recent runs</h4><div id="factoryRuns" class="stack"></div><h4>Schedules</h4><div id="factorySchedules" class="stack"></div></div><form id="factoryHandoffForm" class="form-grid"><h4 class="wide">AGENT TO AGENT HANDOFF</h4><label>FROM<select id="handoffFrom" required></select></label><label>TO<select id="handoffTo" required></select></label><label class="wide">WORK PACKAGE TITLE<input id="handoffTitle" required maxlength="180"></label><label class="wide">PAYLOAD<textarea id="handoffPayload" rows="4" placeholder="Context and expected deliverable"></textarea></label><div class="form-actions"><button class="holo-button" type="submit">SEND TO INBOX</button></div><div id="factoryHandoffs" class="stack wide"></div></form></div><h4>Integration candidates</h4><p id="factoryIntegrations" class="muted"></p>`;
  view.insertBefore(panel,grid);
  const refresh=()=>loadFactoryData();
  $('#factoryDefinitionForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/v1/agent-definitions',{method:'POST',body:JSON.stringify({name:$('#factoryName').value,slug:$('#factorySlug').value,description:$('#factoryDescription').value,project_code:$('#factoryProject').value,execution_target:$('#factoryTarget').value,model_provider:$('#factoryProvider').value,model:$('#factoryModel').value,hermes_profile:$('#factoryProfile').value,policy_profile:$('#factoryPolicy').value,approval_policy:'require_owner',workspace:$('#factoryWorkspace').value,tool_allowlist:[...$('#factoryTools').selectedOptions].map(x=>x.value),skill_allowlist:[...$('#factorySkills').selectedOptions].map(x=>x.value),memory_scope:[$('#factoryProject').value]})});$('#factoryMessage').textContent='Draft registered. Start a smoke run, review its evidence, then activate it.';e.target.reset();$('#factoryModel').value='deepseek-v4.1-flash';await refresh();}catch(err){$('#factoryMessage').textContent=err.message;}});
  $('#factoryRunForm').addEventListener('submit',async e=>{e.preventDefault();try{await api(`/v1/agent-definitions/${encodeURIComponent($('#factoryRunAgent').value)}/runs`,{method:'POST',body:JSON.stringify({objective:$('#factoryObjective').value,acceptance_criteria:['Return concrete evidence, result and blockers']})});$('#factoryObjective').value='';await refresh();}catch(err){toast(err.message);}});
  $('#factoryScheduleForm').addEventListener('submit',async e=>{e.preventDefault();try{await api(`/v1/agent-definitions/${encodeURIComponent($('#factoryScheduleAgent').value)}/schedules`,{method:'POST',body:JSON.stringify({title:$('#factoryScheduleTitle').value,objective:$('#factoryScheduleObjective').value,interval_minutes:Number($('#factoryInterval').value),approval_policy:'require_owner'})});$('#factoryScheduleTitle').value='';$('#factoryScheduleObjective').value='';await refresh();}catch(err){toast(err.message);}});
  $('#factoryHandoffForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/v1/agent-handoffs',{method:'POST',body:JSON.stringify({from_agent_id:$('#handoffFrom').value,to_agent_id:$('#handoffTo').value,title:$('#handoffTitle').value,payload:{work:$('#handoffPayload').value}})});$('#handoffTitle').value='';$('#handoffPayload').value='';await refresh();}catch(err){toast(err.message);}});
  panel.addEventListener('click',async e=>{const b=e.target.closest('[data-factory-action]');if(!b)return;try{if(b.dataset.factoryAction==='activate')await api(`/v1/agent-definitions/${b.dataset.id}/activate`,{method:'POST'});else if(b.dataset.factoryAction==='accept')await api(`/v1/agent-handoffs/${b.dataset.id}/accept`,{method:'POST'});else if(b.dataset.factoryAction==='schedule')await api(`/v1/agent-schedules/${b.dataset.id}`,{method:'PATCH',body:JSON.stringify({enabled:b.dataset.enabled!=='true'})});await refresh();}catch(err){toast(err.message);}});
}
async function loadFactoryData(){
  if(!$('#agentFactoryPanel'))return;
  try{
    const target=$('#factoryTarget')?.value||'cloud';const [catalog,agents,runs,schedules,handoffs]=await Promise.all([api(`/v1/agent-factory/catalog?execution_target=${target}`),api('/v1/agent-definitions'),api('/v1/agent-factory/runs?limit=12'),api('/v1/agent-schedules'),api('/v1/agent-handoffs')]);
    state.factory={catalog,agents:agents.agents||[],runs:runs.runs||[],schedules:schedules.schedules||[],handoffs:handoffs.handoffs||[]};
    const c=state.factory.catalog;$('#factoryBridge').textContent=c.bridgeOnline?`${target.toUpperCase()} HERMES CONNECTED`:`${target.toUpperCase()} HERMES OFFLINE`;$('#factoryBridge').className=`status ${c.bridgeOnline?'completed':'failed'}`;
    const profile=$('#factoryProfile').value;$('#factoryProfile').innerHTML=(c.profiles||[]).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');if((c.profiles||[]).includes(profile))$('#factoryProfile').value=profile;
    $('#factoryTools').innerHTML=(c.toolsets||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    $('#factorySkills').innerHTML=(c.runtimeCapabilities||[]).filter(x=>x.capability_type==='skill'&&x.status==='connected').map(x=>`<option value="${esc(x.display_name)}">${esc(x.display_name)} · Hermes live</option>`).join('');
    const selectable=state.factory.agents;const active=selectable.filter(x=>x.status==='active');const options=list=>list.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.status)}</option>`).join('');
    $('#factoryRunAgent').innerHTML=options(selectable);$('#factoryScheduleAgent').innerHTML=options(active);$('#handoffFrom').innerHTML=options(active);$('#handoffTo').innerHTML=options(active);
    $('#factoryAgents').innerHTML=selectable.length?selectable.map(a=>`<div class="system-row"><div><strong>${esc(a.name)} · ${esc(a.slug)}</strong><small>${esc(a.project_code)} · ${esc(a.execution_target||'cloud')} · ${esc(a.model_provider)}:${esc(a.model)} · Hermes ${esc(a.hermes_profile)} · ${esc((a.tool_allowlist||[]).join(', '))}</small><small>${esc((a.skill_allowlist||[]).join(', ')||'No skills assigned')}</small></div><span>${statusBadge(a.status)}${a.status==='testing'?` <button class="holo-button" data-factory-action="activate" data-id="${esc(a.id)}">ACTIVATE</button>`:''}</span></div>`).join(''):'<div class="empty-state">No generated agents yet.</div>';
    $('#factoryRuns').innerHTML=state.factory.runs.length?state.factory.runs.map(r=>`<div class="system-row"><div><strong>${esc(r.name)} · ${esc(r.objective)}</strong><small>${esc(r.model_provider)}:${esc(r.model)} · ${formatTime(r.created_at)}</small>${r.error?`<small>${esc(r.error)}</small>`:''}${r.hermes_result?`<small>${esc(String(r.hermes_result).slice(0,320))}</small>`:''}</div>${statusBadge(r.status)}</div>`).join(''):'<div class="empty-state">No runs yet.</div>';
    $('#factorySchedules').innerHTML=state.factory.schedules.length?state.factory.schedules.map(s=>`<div class="system-row"><div><strong>${esc(s.name)} · ${esc(s.title)}</strong><small>Every ${esc(s.interval_minutes)} minutes · next ${formatTime(s.next_run_at)} · last ${esc(s.last_status)}</small></div><button class="holo-button" data-factory-action="schedule" data-id="${esc(s.id)}" data-enabled="${s.enabled}">${s.enabled?'PAUSE':'RESUME'}</button></div>`).join(''):'<div class="empty-state">No schedules yet.</div>';
    $('#factoryHandoffs').innerHTML=state.factory.handoffs.map(h=>`<div class="system-row"><div><strong>${esc(h.from_slug)} → ${esc(h.to_slug)} · ${esc(h.title)}</strong><small>${esc(h.status)} · ${formatTime(h.created_at)}</small></div>${h.status==='pending'?`<button class="holo-button" data-factory-action="accept" data-id="${esc(h.id)}">ACCEPT & RUN</button>`:statusBadge(h.status)}</div>`).join('')||'<div class="empty-state">No agent handoffs yet.</div>';
    $('#factoryIntegrations').textContent=[...(c.integrations||[]).map(i=>`${i.repository}: ${i.status} candidate (${i.source_kind})`),...(c.runtimeCapabilities||[]).filter(i=>['mcp','plugin','connection'].includes(i.capability_type)).map(i=>`${i.display_name}: ${i.status} live ${i.capability_type}`)].join(' · ')||'No integration catalogue records.';
    const targetSelector=$('#factoryTarget');if(targetSelector&&!targetSelector.dataset.bound){targetSelector.dataset.bound='1';targetSelector.addEventListener('change',()=>loadFactoryData());}
  }catch(error){$('#factoryBridge').textContent='FACTORY API NOT AVAILABLE';$('#factoryBridge').className='status failed';console.warn('Agent Factory data unavailable:',error.message);}
}
function installRepositoryRegistry(){
  const view=$('#view-projects');const grid=$('#projectGrid');if(!view||!grid||$('#ventureRepositoriesPanel'))return;
  const panel=document.createElement('article');panel.id='ventureRepositoriesPanel';panel.className='panel';panel.innerHTML='<div class="panel-head"><div><span class="micro">HATCHABLE REPOSITORY INVENTORY</span><h3>Venture Studio GitHub projects</h3></div><span id="ventureRepoCount" class="pill">0 REPOSITORIES</span></div><p class="muted">Imported from the Venture Studio export. Local paths are shown where the repository is already present on this Mac; remote-only repositories require separate credentials before cloning.</p><div id="ventureRepositoryList" class="stack"></div>';
  view.insertBefore(panel,grid);
}
function renderSoundState(){
  const speaking=document.body.classList.contains('jarvis-speaking');const recording=Boolean(voiceTurnRecorder&&voiceTurnRecorder.state!=='inactive');const listening=Boolean(state.listening||recording||voiceTurnRecognition||document.body.classList.contains('jarvis-listening'));
  const label=state.micMuted?'MIC MUTED':speaking?'SPEAKING':listening?'LISTENING':state.voiceSession?'LIVE':state.wakeArmed?'LISTENING FOR JARVIS':'MIC ON';
  const mode=state.micMuted?'muted':speaking?'speaking':listening?'listening':state.voiceSession?'live':state.wakeArmed?'wake':'ready';
  document.body.classList.toggle('jarvis-muted',state.micMuted);document.body.classList.toggle('jarvis-mic-muted',state.micMuted);
  $('#soundStateLabel')&&($('#soundStateLabel').textContent=label);
  $('#railAudioState')&&($('#railAudioState').textContent=label);
  $('#soundIndicator')&&$('#soundIndicator').setAttribute('data-mode',mode);
  const button=$('#muteButton');if(button){button.setAttribute('aria-label',state.micMuted?'Turn JARVIS microphone on':'Mute JARVIS microphone');button.setAttribute('title',state.micMuted?'Turn JARVIS microphone on':'Mute JARVIS microphone');button.setAttribute('aria-pressed',String(state.micMuted));}
  const mic=$('#micButton');if(mic){const wakeText=recording?'LISTENING':state.voiceSession?'LIVE':state.wakeArmed?'ARMED':'VOICE';mic.setAttribute('aria-pressed',String(Boolean(recording||voiceTurnRecognition||state.voiceSession||state.wakeArmed)));mic.setAttribute('aria-label',recording?'Stop and send JARVIS voice recording':state.voiceSession?'End JARVIS voice session':state.wakeArmed?'Stop JARVIS wake listening':'Start JARVIS voice input');mic.setAttribute('title',recording?'Recording — click to stop and send':state.voiceSession?'End JARVIS voice session':state.wakeArmed?'Say JARVIS to start. Click to stop.':'Tap to speak to JARVIS');const micLabel=$('#micLabel');if(micLabel)micLabel.textContent=wakeText;}
  const talk=$('#talkButton');if(talk){talk.setAttribute('aria-pressed',String(Boolean(recording||voiceTurnRecognition||state.voiceSession)));talk.setAttribute('aria-label',recording?'Stop and send JARVIS voice recording':state.voiceSession?'End live voice conversation':'Talk to JARVIS now');talk.setAttribute('title',recording?'Recording — click to stop and send':state.voiceSession?'End live voice conversation':'Start microphone capture and transcribe your speech');}
  const muteLabel=$('#muteLabel');if(muteLabel)muteLabel.textContent=state.micMuted?'MIC OFF':'MIC ON';
}
function startAudioMeter(){
  cancelAnimationFrame(state.audioMeterFrame);
  const bars=[...document.querySelectorAll('.sound-bars i')];if(!bars.length)return;
  const tick=()=>{
    let level=0;
    try{if(state.voiceSession&&!state.muted)level=Math.max(0,Math.min(1,Number(state.voiceSession.getOutputVolume?.()||0)));}catch{}
    bars.forEach((bar,index)=>{const shape=[.5,.9,1,.72,.88,.58,.95][index]||.7;bar.style.height=`${4+Math.round(level*shape*17)}px`;});
    state.audioMeterFrame=requestAnimationFrame(tick);
  };
  tick();
}
function stopAudioMeter(){cancelAnimationFrame(state.audioMeterFrame);state.audioMeterFrame=null;for(const bar of document.querySelectorAll('.sound-bars i'))bar.style.height='4px';}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  if (response.status === 401) { showLogin(); throw new Error('Session required'); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}
function toast(message) { const node = $('#toast'); node.textContent = message; node.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 4000); }
function showLogin() { $('#shell').hidden = true; $('#login').hidden = false; }
function showApp() { $('#login').hidden = true; $('#shell').hidden = false; }

function installGithubControls(){
  const settings=$('#view-settings');const runtime=$('#runtimeSettings')?.closest('article');if(!settings||!runtime||$('#githubForm'))return;
  const panel=document.createElement('article');panel.className='panel';panel.innerHTML=`<div class="panel-head"><div><span class="micro">GITHUB</span><h3>Repository-scoped automation credential</h3></div><span id="githubStatus" class="status">NOT CONFIGURED</span></div><form id="githubForm" class="form-grid"><label class="wide">GITHUB TOKEN<input id="githubToken" type="password" autocomplete="off" placeholder="Paste a fine-grained token; encrypted on the VPS"></label><p class="wide muted">Use a fine-grained token limited to the intended repository with <b>Contents: Read</b> and <b>Actions: Read and write</b>. Never paste it into chat.</p><div class="form-actions"><button class="holo-button primary" type="submit">SAVE GITHUB TOKEN</button></div></form><p id="githubMessage" class="status-message"></p>`;
  settings.insertBefore(panel,runtime);
  $('#githubForm').addEventListener('submit',async(e)=>{e.preventDefault();try{state.githubStatus=await api('/v1/providers/github',{method:'POST',body:JSON.stringify({token:$('#githubToken').value})});$('#githubToken').value='';renderGithubStatus();toast('GitHub token saved encrypted');}catch(err){$('#githubMessage').textContent=err.message;}});
}
function renderGithubStatus(){const node=$('#githubStatus');if(!node)return;const data=state.githubStatus||{};node.textContent=data.ready?'CONNECTED':data.configured?'CHECK FAILED':'NOT CONFIGURED';node.className=`status ${data.ready?'completed':'failed'}`;$('#githubMessage').textContent=data.ready?`Connected as ${data.login||'GitHub user'} · ${data.scopes||0} reported scopes`:data.configured?'Token saved but GitHub authentication failed':'Paste a fine-grained repository token above.';}

function installProviderKeyControls(){
  const settings=$('#view-settings');const runtime=$('#runtimeSettings')?.closest('article');if(!settings||!runtime||$('#providerKeyForm'))return;
  const panel=document.createElement('article');panel.className='panel';
  panel.innerHTML=`<div class="panel-head"><div><span class="micro">PROVIDER KEYS</span><h3>API key pool · daily rotation</h3></div><span id="keyPoolStatus" class="status">0 KEYS</span></div><p class="muted">Add several keys per provider. JARVIS rotates once per UTC day and switches immediately when a key is rate-limited. Keys are encrypted on the VPS.</p><form id="providerKeyForm" class="form-grid"><label>PROVIDER<select id="keyProvider"><option value="openrouter">OpenRouter</option><option value="ollama-cloud">Ollama Cloud (ollama.com)</option></select></label><label>LABEL<input id="keyLabel" required maxlength="60" placeholder="account-1"></label><label class="wide">API KEY<input id="keyValue" type="password" autocomplete="off" placeholder="Paste once; encrypted on the VPS"></label><div class="form-actions"><button class="holo-button primary" type="submit">ADD KEY</button><button id="refreshProviderKeys" class="holo-button" type="button">↻ REFRESH KEYS</button></div></form><p id="providerKeyMessage" class="status-message"></p><div id="providerKeyList" class="stack"></div>`;
  settings.insertBefore(panel,runtime);
  $('#providerKeyForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await api('/v1/provider-keys',{method:'POST',body:JSON.stringify({provider:$('#keyProvider').value,label:$('#keyLabel').value.trim(),key:$('#keyValue').value.trim()})});$('#keyValue').value='';$('#providerKeyMessage').textContent='Key saved encrypted';toast('Provider key saved');await loadProviderKeys();}catch(err){$('#providerKeyMessage').textContent=err.message;}});
  $('#refreshProviderKeys').addEventListener('click',()=>loadProviderKeys());
  $('#providerKeyList').addEventListener('click',async(e)=>{const button=e.target.closest('button[data-key-id]');if(!button)return;try{await api('/v1/provider-keys/'+encodeURIComponent(button.dataset.keyId),{method:'DELETE'});toast('Key removed');await loadProviderKeys();}catch(err){$('#providerKeyMessage').textContent=err.message;}});
}
async function loadProviderKeys(){try{state.providerKeys=await api('/v1/provider-keys');renderProviderKeys();}catch(err){const message=$('#providerKeyMessage');if(message)message.textContent=err.message;}}
function renderProviderKeys(){
  const list=$('#providerKeyList');if(!list)return;
  const keys=state.providerKeys?.keys||[];const rotation=state.providerKeys?.rotation||[];
  const status=$('#keyPoolStatus');if(status)status.textContent=`${keys.length} KEY${keys.length===1?'':'S'}`;
  if(!keys.length){list.innerHTML='<p class="muted">No pooled keys yet. The environment key remains the fallback.</p>';return;}
  list.innerHTML=keys.map((key)=>{const rot=rotation.find((row)=>row.provider===key.provider);const current=rot&&rot.current_key_id===key.id;const label=key.status==='active'?(current?'ACTIVE NOW':'STANDBY'):String(key.status||'').toUpperCase();const cooldown=key.cooldown_until?' · cooldown until '+new Date(key.cooldown_until).toLocaleString():'';const used=key.last_used_at?' · last used '+new Date(key.last_used_at).toLocaleString():'';return `<div class="system-row"><div><strong>${esc(key.label)}</strong><small>${esc(key.provider)} · ${esc(label)}${esc(cooldown)}${esc(used)}</small></div><button class="holo-button" data-key-id="${esc(key.id)}">REMOVE</button></div>`;}).join('');
}

function installChatPresence(){
  const body=document.querySelector('#chatConsole .intelligence-body');const header=body?.querySelector('.mini-chat-head');
  if(!body||!header||body.querySelector('.jarvis-chat-presence'))return;
  const stage=document.createElement('div');stage.className='jarvis-chat-presence';stage.setAttribute('aria-hidden','true');stage.innerHTML='<img class="chat-face-base" src="assets/jarvis-hologram-face.png" alt=""><img class="chat-face-speaking" src="assets/jarvis-hologram-face-speaking.png" alt=""><i class="chat-lip-glow"></i>';
  header.insertAdjacentElement('afterend',stage);body.classList.add('has-chat-presence');
}
function installPresenceLipSync(){
  const presence=document.getElementById('presenceAnimation');if(!presence||presence.querySelector('.jarvis-face-stack'))return;
  const stack=document.createElement('div');stack.className='jarvis-face-stack';stack.setAttribute('aria-hidden','true');
  stack.innerHTML='<img class="presence-face-base" src="assets/jarvis-hologram-face.png" alt=""><img class="presence-face-speaking" src="assets/jarvis-hologram-face-speaking.png" alt=""><i class="presence-lip-glow"></i>';
  presence.append(stack);
}
function installCollapsibleWidgets(){
  let collapsed={};try{collapsed=JSON.parse(localStorage.getItem('jarvis_collapsed_widgets')||'{}')||{};}catch{}
  const persist=()=>localStorage.setItem('jarvis_collapsed_widgets',JSON.stringify(collapsed));
  const keyFor=element=>{
    if(element.dataset.widgetKey)return element.dataset.widgetKey;
    const view=element.closest('.view')?.id||element.closest('aside')?.id||'workspace';
    const title=element.querySelector('h2,h3,.card-title')?.textContent?.trim()||element.querySelector('.micro')?.textContent?.trim()||element.className;
    element.dataset.widgetKey=`${view}:${title}`.toLowerCase().replace(/[^a-z0-9:_-]+/g,'-').replace(/-+/g,'-').slice(0,100);
    return element.dataset.widgetKey;
  };
  const apply=element=>{const key=keyFor(element),button=element.querySelector(':scope > .panel-head > .widget-toggle, :scope > .widget-toggle'),isCollapsed=Boolean(collapsed[key]);element.classList.toggle('widget-collapsed',isCollapsed);element.dataset.widgetCollapsed=String(isCollapsed);if(button){button.setAttribute('aria-expanded',String(!isCollapsed));button.setAttribute('aria-label',isCollapsed?'Expand widget':'Collapse widget');const label=isCollapsed?'+':'−';if(button.textContent!==label)button.textContent=label;}};
  const enhance=()=>{
    document.querySelectorAll('article.panel, .resource-card').forEach(element=>{
      const head=element.querySelector(':scope > .panel-head');
      if(!head)return;
      keyFor(element);
      if(!head.querySelector(':scope > .widget-toggle')){const button=document.createElement('button');button.type='button';button.className='widget-toggle';head.appendChild(button);}
      apply(element);
    });
  };
  document.addEventListener('click',event=>{
    const toggle=event.target.closest('.widget-toggle');const head=toggle?null:event.target.closest('.panel-head');
    if(!toggle&&!head)return;
    if(!toggle&&event.target.closest('button,a,input,select,textarea'))return;
    const element=(toggle||head).closest('article.panel, .resource-card');if(!element)return;
    event.preventDefault();const key=keyFor(element);collapsed[key]=!Boolean(collapsed[key]);persist();apply(element);
  });
  new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
  enhance();
}
function installTwilioControls(){
  const settings=$('#view-settings');const runtime=$('#runtimeSettings')?.closest('article');if(!settings||!runtime||$('#twilioForm'))return;
  const panel=document.createElement('article');panel.className='panel';
  panel.innerHTML=`<div class="panel-head"><div><span class="micro">PHONE CALLS · TWILIO</span><h3>Outbound owner calls</h3></div><span id="twilioStatus" class="status">NOT CONFIGURED</span></div><p class="muted">JARVIS dials your phone and speaks the message when a decision or blocker needs you. Twilio bills per minute; trial credit works.</p><form id="twilioForm" class="form-grid"><label>ACCOUNT SID<input id="twilioSid" placeholder="AC..." autocomplete="off"></label><label>AUTH TOKEN<input id="twilioToken" type="password" autocomplete="off" placeholder="Leave blank to keep existing"></label><label>FROM NUMBER<input id="twilioFrom" type="tel" placeholder="+1..."></label><label>MY PHONE (DEFAULT)<input id="twilioTo" type="tel" placeholder="+20..."></label><div class="form-actions"><button class="holo-button primary" type="submit">SAVE TWILIO</button><button id="twilioTest" class="holo-button" type="button">TEST CALL</button></div></form><p id="twilioMessage" class="status-message"></p>`;
  settings.insertBefore(panel,runtime);
  $('#twilioForm').addEventListener('submit',async(e)=>{e.preventDefault();try{state.twilioStatus=await api('/v1/providers/twilio',{method:'POST',body:JSON.stringify({account_sid:$('#twilioSid').value.trim(),auth_token:$('#twilioToken').value.trim(),from_number:$('#twilioFrom').value.trim(),default_to:$('#twilioTo').value.trim()})});$('#twilioToken').value='';renderTwilio();toast('Twilio saved');await loadData();}catch(err){$('#twilioMessage').textContent=err.message;}});
  $('#twilioTest').addEventListener('click',async()=>{try{const result=await api('/v1/providers/twilio/test-call',{method:'POST',body:JSON.stringify({to_phone:$('#twilioTo').value.trim()||null,message:'This is JARVIS testing the phone line.'})});$('#twilioMessage').textContent=result?.placed?'Test call placed':`Not placed · ${result?.reason||result?.external?.body?.error||'unknown'}`;toast(result?.placed?'Calling your phone':'Call failed');}catch(err){$('#twilioMessage').textContent=err.message;}});
  loadTwilioStatus();
}
async function loadTwilioStatus(){try{state.twilioStatus=await api('/v1/providers/twilio/status');renderTwilio();}catch(err){const node=$('#twilioStatus');if(node){node.textContent='UNAVAILABLE';node.className='status failed';}}}
function renderTwilio(){
  const node=$('#twilioStatus');const data=state.twilioStatus||{};if(!node)return;
  node.textContent=data.ready?'CONNECTED':data.configured?'CHECK FAILED':'NOT CONFIGURED';
  node.className=`status ${data.ready?'completed':data.configured?'failed':''}`;
  if($('#twilioFrom')&&data.from_number)$('#twilioFrom').value=data.from_number;
  if($('#twilioTo')&&data.default_to)$('#twilioTo').value=data.default_to;
  const message=$('#twilioMessage');if(message)message.textContent=data.ready?`Account ${data.account||'connected'} · from ${data.from_number||'—'}`:data.error||'Add your Twilio Account SID, auth token, from number and phone.';
}
function installFaceTimeControls(){
  const settings=$('#view-settings');const runtime=$('#runtimeSettings')?.closest('article');if(!settings||!runtime||$('#faceTimeForm'))return;
  const panel=document.createElement('article');panel.className='panel';
  panel.innerHTML=`<div class="panel-head"><div><span class="micro">FACETIME CALLS · FREE</span><h3>Call the owner from the Mac</h3></div><span id="faceTimeStatus" class="status">NOT CONFIGURED</span></div><p class="muted">Runs on the Mac through FaceTime using iPhone continuity. Free; the Mac must be awake and signed in.</p><form id="faceTimeForm" class="form-grid"><label class="wide">TARGET · APPLE ID EMAIL OR +PHONE<input id="faceTimeTarget" placeholder="+201234567890 or you@icloud.com"></label><label>KIND<select id="faceTimeKind"><option value="video">VIDEO</option><option value="audio">AUDIO</option></select></label><div class="form-actions"><button class="holo-button primary" type="submit">SAVE DEFAULT</button><button id="faceTimeCall" class="holo-button" type="button">CALL NOW</button></div></form><p id="faceTimeMessage" class="status-message"></p>`;
  settings.insertBefore(panel,runtime);
  $('#faceTimeForm').addEventListener('submit',async(e)=>{e.preventDefault();try{state.faceTimeStatus=await api('/v1/providers/facetime',{method:'POST',body:JSON.stringify({target:$('#faceTimeTarget').value.trim(),kind:$('#faceTimeKind').value})});renderFaceTime();toast('FaceTime target saved');}catch(err){$('#faceTimeMessage').textContent=err.message;}});
  $('#faceTimeCall').addEventListener('click',async()=>{try{const result=await api('/v1/providers/facetime/call',{method:'POST',body:JSON.stringify({target:$('#faceTimeTarget').value.trim()||null,kind:$('#faceTimeKind').value})});$('#faceTimeMessage').textContent=result?.status==='succeeded'?`Calling ${result.target_masked} on FaceTime ${result.kind}`:`Not placed · ${result?.error||result?.status||'unknown'}`;toast(result?.status==='succeeded'?'FaceTime call started':'Call failed');}catch(err){$('#faceTimeMessage').textContent=err.message;}});
  loadFaceTimeStatus();
}
async function loadFaceTimeStatus(){try{state.faceTimeStatus=await api('/v1/providers/facetime/status');renderFaceTime();}catch(err){const node=$('#faceTimeStatus');if(node){node.textContent='UNAVAILABLE';node.className='status failed';}}}
function renderFaceTime(){const node=$('#faceTimeStatus');const data=state.faceTimeStatus||{};if(!node)return;node.textContent=data.configured?'CONFIGURED':'NOT CONFIGURED';node.className=`status ${data.configured?'completed':''}`;if($('#faceTimeKind')&&data.kind)$('#faceTimeKind').value=data.kind;const message=$('#faceTimeMessage');if(message)message.textContent=data.configured?`Default ${data.target_masked||''} · ${data.kind} call`:'Save your Apple ID email or phone number to enable FaceTime calls.';}
function installNavigationIA(){
  const nav=document.querySelector('.side-nav');const content=$('.content');if(!nav||!content)return;
  const addView=(id,kicker,title,refreshId)=>{if($('#view-'+id))return $('#view-'+id);const section=document.createElement('section');section.id='view-'+id;section.className='view';section.innerHTML=`<div class="section-head"><div><p class="micro purple">${kicker}</p><h1>${title}</h1></div><button id="${refreshId}" class="holo-button" type="button">↻ REFRESH</button></div>`;content.appendChild(section);return section;};
  const navButton=(view,label,glyph)=>{const button=document.createElement('button');button.className='nav-button';button.type='button';button.dataset.view=view;button.setAttribute('aria-label',label);button.innerHTML=`<span aria-hidden="true" style="width:16px;text-align:center">${glyph}</span><span>${label}</span>`;return button;};
  const groupLabel=(text,group)=>{const node=document.createElement('div');node.className='nav-group-label';node.dataset.group=group;node.textContent=text;return node;};
  const overviewBtn=nav.querySelector('[data-view="overview"]');
  const projectsBtn=nav.querySelector('[data-view="projects"]');
  const macBtn=nav.querySelector('[data-view="mac"]');
  const settingsBtn=nav.querySelector('[data-view="settings"]');
  if(!$('#chatNav')&&overviewBtn){const chat=document.createElement('button');chat.id='chatNav';chat.className='nav-button';chat.type='button';chat.setAttribute('aria-label','Chat');chat.innerHTML='<span aria-hidden="true" style="width:16px;text-align:center">◍</span><span>Chat</span>';chat.addEventListener('click',()=>{setChatWorkspace(true);chat.classList.add('active');setTimeout(()=>chat.classList.remove('active'),700);});overviewBtn.insertAdjacentElement('afterend',chat);}
  if(projectsBtn&&!$('#nav-memory')){const memory=navButton('memory','Memory','◈');memory.id='nav-memory';projectsBtn.insertAdjacentElement('afterend',memory);}
  if(macBtn&&!$('#nav-security')){const security=navButton('security','Security','⛨');security.id='nav-security';macBtn.insertAdjacentElement('afterend',security);}
  if(overviewBtn&&!nav.querySelector('.nav-group-label[data-group="operate"]'))overviewBtn.insertAdjacentElement('beforebegin',groupLabel('OPERATE','operate'));
  if(macBtn&&!nav.querySelector('.nav-group-label[data-group="control"]'))macBtn.insertAdjacentElement('beforebegin',groupLabel('CONTROL','control'));
  if(settingsBtn&&!nav.querySelector('.nav-group-label[data-group="system"]'))settingsBtn.insertAdjacentElement('beforebegin',groupLabel('SYSTEM','system'));

  const memoryView=addView('memory','DURABLE CONTEXT · RECALL','Memory','refreshMemory');
  const memoryPanel=$('#sharedMemoryPanel');if(memoryPanel&&memoryPanel.parentElement!==memoryView)memoryView.appendChild(memoryPanel);
  const memoryResults=$('#memorySearchResults');const memoryMessage=$('#memoryMessage');
  if(memoryPanel&&memoryResults&&memoryResults.closest('.grid-2')){memoryPanel.appendChild(memoryResults);if(memoryMessage)memoryPanel.appendChild(memoryMessage);memoryResults.classList.add('memory-results');}

  const securityView=addView('security','TERMINAL · RECON · SCOPE','Security','refreshSecurity');
  const keyPanel=$('#providerKeyForm')?.closest('article');if(keyPanel&&keyPanel.parentElement!==securityView)securityView.appendChild(keyPanel);
  const githubPanel=$('#githubForm')?.closest('article');if(githubPanel&&githubPanel.parentElement!==securityView)securityView.appendChild(githubPanel);
  if(!$('#securityScopePanel')){const panel=document.createElement('article');panel.id='securityScopePanel';panel.className='panel';panel.innerHTML='<div class="panel-head"><div><span class="micro">LINUX RECON SCOPE</span><h3>Authorized targets and tools</h3></div><span id="securityScopeState" class="status">CHECKING</span></div><p class="muted">The local model can run nmap, dig, whois, traceroute and curl on the VPS. Private and loopback targets are always allowed; every other target must be listed in the scope file.</p><div id="securityScope" class="stack"></div>';securityView.appendChild(panel);}

  const settings=$('#view-settings');const elevenPanel=$('#elevenForm')?.closest('article');if(elevenPanel&&settings&&elevenPanel.parentElement!==settings)settings.appendChild(elevenPanel);
  const projects=$('#view-projects');const repoPanel=$('#repositoryForm')?.closest('article');if(repoPanel&&projects){const grid=$('#projectGrid');projects.insertBefore(repoPanel,grid);}

  const metrics=$('#overviewMetrics');const room=$('#commandRoom');if(metrics&&room&&room.parentElement===metrics.parentElement)room.parentElement.insertBefore(metrics,room);

  $('#refreshMemory')?.addEventListener('click',()=>loadData());
  $('#refreshSecurity')?.addEventListener('click',()=>{loadSecurityScope();loadProviderKeys();});
  loadSecurityScope();
}
async function loadSecurityScope(){
  const node=$('#securityScope');if(!node)return;
  try{
    const scope=await api('/v1/linux-tools');
    const chips=(items)=>items&&items.length?items.map((item)=>`<span class="pill">${esc(item)}</span>`).join(' '):'<span class="muted">none</span>';
    node.innerHTML=`<div class="system-row"><div><strong>ALLOWED DOMAINS</strong><small>${esc(scope.scope_file)}</small></div><div class="button-row">${chips(scope.domains)}</div></div><div class="system-row"><div><strong>ALLOWED IPS</strong></div><div class="button-row">${chips(scope.ips)}</div></div><div class="system-row"><div><strong>ALLOWED CIDRS</strong></div><div class="button-row">${chips(scope.cidrs)}</div></div><div class="system-row"><div><strong>TOOLS</strong><small>Allowlisted flags only · 60s timeout · audited</small></div><div class="button-row"><span class="pill">nmap</span><span class="pill">dig</span><span class="pill">whois</span><span class="pill">traceroute</span><span class="pill">curl</span></div></div>`;
    const state=$('#securityScopeState');if(state){state.textContent='LOADED';state.className='status completed';}
  }catch(error){
    node.textContent=error.message;
    const state=$('#securityScopeState');if(state){state.textContent='UNAVAILABLE';state.className='status failed';}
  }
}
function installControlSurfaces(){
  const shell=$('#shell'),main=$('.main'),chat=$('#chatConsole'),overview=$('#view-overview'),metrics=$('#overviewMetrics');
  if(shell&&main&&chat&&!$('#statusConsole')){
    const status=document.createElement('aside');status.id='statusConsole';status.className='status-rail';status.setAttribute('aria-label','JARVIS runtime status and approvals');
    status.innerHTML=`<article class="panel status-summary"><div class="panel-head"><div><span class="micro">LIVE CONTROL PLANE</span><h3>Runtime Status</h3></div><span class="pill">LIVE</span></div><div class="stack"><div class="system-row"><div><strong>Worker</strong><small>Authenticated execution queue</small></div><span id="statusWorker" class="pill">CHECKING</span></div><div class="system-row"><div><strong>Voice pipeline</strong><small>Local Whisper input · local speech output</small></div><span id="statusVoice" class="pill">CHECKING</span></div><div class="system-row"><div><strong>Telegram</strong><small>Owner channel and inbound bridge</small></div><span id="statusTelegram" class="pill">CHECKING</span></div><div class="system-row"><div><strong>Mac bridge</strong><small>Local desktop execution</small></div><span id="statusMac" class="pill">CHECKING</span></div></div></article><article class="panel status-note"><div class="panel-head"><div><span class="micro">CONVERSATION</span><h3>Owner workspace</h3></div></div><p class="muted">Chat stays in the main workspace. This rail keeps operational status and approvals visible while work is running.</p></article>`;
    shell.insertBefore(status,chat);
  }
  const approvalHost=$('#statusConsole')||overview;
  if(approvalHost&&!$('#approvalInboxPanel')){const panel=document.createElement('article');panel.id='approvalInboxPanel';panel.className='panel approval-inbox';panel.innerHTML='<div class="panel-head"><div><span class="micro">OWNER DECISIONS</span><h3>Approval Inbox</h3></div><span id="approvalCount" class="pill">0 PENDING</span></div><div id="approvalInbox" class="stack"></div>';approvalHost.appendChild(panel);}
  const agents=$('#view-agents'),grid=$('#agentGrid');
  if(agents&&grid&&!$('#connectedAccountsPanel')){const panel=document.createElement('article');panel.id='connectedAccountsPanel';panel.className='panel';panel.innerHTML='<div class="panel-head"><div><span class="micro">AUTHENTICATED CONNECTIONS</span><h3>Connected Accounts</h3></div><span id="accountConnectionCount" class="pill">0 CONNECTED</span></div><p class="muted">JARVIS never stores passwords. Login occurs in its dedicated browser profile; independent browser evidence determines whether the session is verified.</p><div id="accountConnectionList" class="stack"></div>';agents.insertBefore(panel,grid);}
}
function renderApprovals(){
  const node=$('#approvalInbox');if(!node)return;const pending=state.approvals||[];$('#approvalCount').textContent=`${pending.length} PENDING`;
  node.innerHTML=pending.length?pending.map(item=>`<div class="system-row"><div><strong>${esc(item.title)}</strong><small>${esc(item.project_code)} · ${esc(item.kind)} · ${esc(item.risk)} · ${esc(item.reason||'Owner decision required')}</small></div><div class="button-row"><button class="holo-button primary" data-approval-kind="${esc(item.kind)}" data-approval-id="${esc(item.id)}" data-decision="yes">YES</button><button class="holo-button" data-approval-kind="${esc(item.kind)}" data-approval-id="${esc(item.id)}" data-decision="no">NO</button></div></div>`).join(''):'<div class="empty-state">No decisions require you.</div>';
}
function renderAccountConnections(){
  const node=$('#accountConnectionList');if(!node)return;const accounts=state.accountConnections||[];const verified=accounts.filter(a=>a.status==='verified').length;$('#accountConnectionCount').textContent=`${verified} VERIFIED`;
  node.innerHTML=accounts.length?accounts.map(account=>`<div class="system-row"><div><strong>${esc(account.service)} · ${esc(account.account_alias)}</strong><small>${esc(account.project_code)} · ${esc(account.status)} · expires ${formatTime(account.expires_at)}</small></div><div class="button-row">${['opened','awaiting_verification','failed'].includes(account.status)?`<button class="holo-button primary" data-account-verify="${esc(account.id)}">VERIFY LOGIN</button>`:statusBadge(account.status)}</div></div>`).join(''):'<div class="empty-state">No account connections yet. Ask JARVIS in chat to connect an account.</div>';
}
const titles = { overview: 'OVERVIEW', agents: 'AGENTS', projects: 'PROJECTS', mac: 'MAC CONTROL', settings: 'SETTINGS', memory: 'MEMORY', security: 'SECURITY' };
function setView(view) { for (const b of document.querySelectorAll('[data-view]')) b.classList.toggle('active', b.dataset.view === view); for (const v of document.querySelectorAll('.view')) v.classList.toggle('active', v.id === `view-${view}`); $('#pageTitle').textContent = titles[view]; if (view === 'security') loadSecurityScope(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function renderStatus() {
  if (!state.status) return;
  const workers = state.status.workers.filter((worker) => worker.online).length;
  $('#workerDot').classList.toggle('ready', workers > 0);
  $('#workerState').textContent = workers ? 'ONLINE' : 'OFFLINE';
  $('#routerState').textContent = state.status.providers.openrouter.ready ? 'CONNECTED' : 'CHECK';
  $('#routerBalance').textContent = state.status.providers.openrouter.ready ? 'CONNECTED' : 'NOT READY';
  const voiceSpendEnabled=Boolean(state.settings?.settings?.voice?.enabled);
  $('#voiceBalance').textContent = state.status.providers.elevenlabs.configured ? (voiceSpendEnabled && state.status.providers.elevenlabs.ready ? 'READY' : 'SPEND OFF') : 'NOT SET';
  const updateRail=(selector,text,ready)=>{const node=$(selector);if(!node)return;node.textContent=text;node.className=`pill ${ready?'':'off'}`;};
  updateRail('#statusWorker',workers?`${workers} ONLINE`:'OFFLINE',workers>0);
  updateRail('#statusVoice',voiceSpendEnabled?(state.status.providers.elevenlabs.ready?'ELEVENLABS':'CHECK FAILED'):'LOCAL',voiceSpendEnabled?state.status.providers.elevenlabs.ready:true);
  updateRail('#statusTelegram',state.status.providers.telegram.ready?'CONNECTED':state.status.providers.telegram.configured?'CHECK FAILED':'NOT SET',state.status.providers.telegram.ready);
  updateRail('#statusMac',state.data?.macBridge?.status==='online'?'ONLINE':String(state.data?.macBridge?.status||'OFFLINE').toUpperCase(),state.data?.macBridge?.status==='online');
}

function renderOverview() {
  if (!state.data) return;
  const activeRuns = state.data.runs.filter((run) => ['queued','running','paused','blocked'].includes(run.status));
  $('#heroAgents').textContent = `${state.data.agents.filter((agent) => agent.status.includes('active')).length} / ${state.data.agents.length}`;
  $('#heroProjects').textContent = String(state.data.projects.length).padStart(2, '0');
  $('#heroMac').textContent = state.data.macBridge.status.toUpperCase();
  $('#agentNavCount').textContent = state.data.agents.length;
  $('#projectNavCount').textContent = state.data.projects.length;
  $('#macNavState').textContent = state.data.macBridge.status === 'online' ? 'ON' : 'OFF';
  $('#overviewMetrics').innerHTML = [['Agents', state.data.agents.length, `${activeRuns.length} active runs`], ['Projects', state.data.projects.length, 'Managed portfolio'], ['Blocked runs', state.data.runs.filter((run) => run.status === 'blocked').length, 'Needs intervention'], ['Mac bridge', state.data.macBridge.status, state.data.macBridge.hostname || 'Local computer']].map(([label,value,detail]) => `<div class="metric-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`).join('');
  renderUsage();
  $('#overviewRuns').innerHTML = activeRuns.length ? activeRuns.slice(0,6).map((run)=>{const agent=state.data.agents.find(a=>a.id===run.agent_id);return `<div class="compact-row"><div><strong>${esc(agent?.name || run.agent_id)} · ${esc(run.objective)}</strong><small>${esc(run.project_code || 'No project')} · ${run.progress}%</small></div>${statusBadge(run.status)}</div>`}).join('') : '<div class="empty-state">No active agent runs.</div>';
  $('#overviewProjects').innerHTML = state.data.projects.map((p)=>`<div class="compact-row"><div><strong>${esc(p.name)}</strong><small>${p.progress}% · ${esc(p.control?.manager || 'Unassigned')} · ${esc(p.control?.next_step || 'Next step not set')}</small></div>${statusBadge(p.status)}</div>`).join('');
  renderAgents(); renderProjects(); renderMac();
}

function renderCapabilityAudit(){const node=$('#capabilityAuditList');if(!node)return;const audit=state.capabilityAudit;node.innerHTML=audit?audit.capabilities.map(item=>`<div class="system-row"><div><strong>${esc(item.name)}</strong><small>${esc(typeof item.evidence==='string'?item.evidence:JSON.stringify(item.evidence))}</small></div>${statusBadge(item.status)}</div>`).join(''):'<div class="empty-state">Run the live audit to measure current capabilities.</div>';}
function renderUsage(){
  if(!state.settings)return;
  const s=state.settings, voice=s.settings.voice, sessions=s.usage.voice_sessions_today, el=s.providers.elevenlabs;
  const voiceUsage=state.elevenStatus?.ready?{used:Number(state.elevenStatus.characters_used),limit:Number(state.elevenStatus.characters_limit)}:{used:Number(el.charactersUsed??0),limit:Number(el.characterLimit??0)};const voiceLeft=Number.isFinite(voiceUsage.limit)&&voiceUsage.limit>0?Math.max(0,voiceUsage.limit-(Number.isFinite(voiceUsage.used)?voiceUsage.used:0)).toLocaleString():'—';$('#usageStrip').innerHTML=[`VOICE INPUT <b class="ready">LOCAL WHISPER</b>`,`VOICE OUTPUT <b class="ready">LOCAL SYSTEM</b>`,`ELEVENLABS <b class="${voice.enabled&&el.ready?'ready':'off'}">${voice.enabled&&el.ready?`${voiceLeft} chars left`:'SPEND OFF'}</b>`,`OLLAMA CLOUD <b class="${state.ollamaStatus?.ready?'ready':'off'}">${state.ollamaStatus?.ready?'READY':'NOT READY'}</b>`,`TELEGRAM <b class="${state.telegramStatus?.ready?'ready':'off'}">${state.telegramStatus?.ready?'CONNECTED':'NOT READY'}</b>`,`MAC <b class="${s.macBridge.status==='online'?'ready':'off'}">${s.macBridge.status}</b>`].map(x=>`<span>${x}</span>`).join('');
  $('#voiceMaxSeconds').value=voice.session_max_seconds;$('#voiceDailyLimit').value=voice.daily_session_limit;
  if(localStorage.getItem('jarvis_local_voice_migrated')!=='1'){localStorage.setItem('jarvis_speak_replies','1');localStorage.setItem('jarvis_local_voice_migrated','1');}
  const speakToggle=document.getElementById('speakReplies');if(localStorage.getItem('jarvis_speak_replies')===null)localStorage.setItem('jarvis_speak_replies','1');if(speakToggle){speakToggle.checked=localStorage.getItem('jarvis_speak_replies')!=='0';const speakLabel=speakToggle.closest('label');if(speakLabel){[...speakLabel.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>{if(node.textContent.trim())node.textContent=' SPEAK CHAT REPLIES · FREE LOCAL SYSTEM VOICE';});speakLabel.title='Uses the browser/system voice. No ElevenLabs characters are used.';}}
  const voiceToggle=document.getElementById('voiceEnabled');if(voiceToggle)voiceToggle.checked=Boolean(s.settings.voice.enabled);
  $('#settingsUsage').innerHTML=[['ElevenLabs',voice.enabled?(el.ready?'READY':'OFFLINE'):'SPEND OFF',voice.enabled?(el.ready?`${el.charactersUsed??'—'} / ${el.characterLimit??'—'} characters`:'Not authenticated'):'Paid speech generation is disabled',voice.enabled&&el.ready],['OpenRouter',s.providers.openrouter.ready?'READY':'OFFLINE','Free-model routing',s.providers.openrouter.ready],['Ollama',s.providers.ollama.ready?'READY':'OFFLINE','Private local inference',s.providers.ollama.ready]].map(([name,status,detail,ready])=>`<div class="system-row"><div><strong>${esc(name)}</strong><small>${esc(detail)}</small></div><span class="pill ${ready?'':'off'}">${esc(status)}</span></div>`).join('');
  $('#runtimeSettings').innerHTML=`<div class="system-row"><div><strong>Worker runtime</strong><small>${s.workers.filter(w=>w.online).length} of ${s.workers.length} authenticated</small></div><span class="pill ${s.workers.some(w=>w.online)?'':'off'}">${s.workers.some(w=>w.online)?'ONLINE':'OFFLINE'}</span></div><div class="system-row"><div><strong>Mac bridge</strong><small>${esc(s.macBridge.hostname||'No host')}</small></div><span class="pill ${s.macBridge.status==='online'?'':'off'}">${esc(s.macBridge.status)}</span></div><div class="system-row"><div><strong>Voice allowance today</strong><small>${sessions} / ${voice.daily_session_limit} sessions</small></div><span class="pill">${voice.session_max_seconds}s MAX</span></div><div class="button-row"><button id="auditCapabilities" class="holo-button" type="button">RUN LIVE CAPABILITY AUDIT</button></div><div id="capabilityAuditList" class="stack"></div>`;
  renderCapabilityAudit();
  $('#ollamaCloudStatus').textContent=state.ollamaStatus?.ready?'READY':state.ollamaStatus?.configured?'CHECK FAILED':'NOT CONFIGURED';
  $('#ollamaCloudStatus').className=`status ${state.ollamaStatus?.ready?'completed':'failed'}`;
  $('#ollamaBaseUrl').value=state.ollamaStatus?.base_url||'https://ollama.com';
  $('#ollamaMessage').textContent=state.ollamaStatus?.ready?`Connected · ${state.ollamaStatus.models||0} models available`:state.ollamaStatus?.configured?'Key saved but connection failed':'Paste an Ollama API key to enable cloud routing.';
  $('#telegramStatus').textContent=state.telegramStatus?.ready?'CONNECTED':state.telegramStatus?.configured?'CHECK FAILED':'NOT CONFIGURED';
  $('#telegramStatus').className=`status ${state.telegramStatus?.ready?'completed':'failed'}`;
  if(state.telegramStatus?.chat_id)$('#telegramChatId').value=state.telegramStatus.chat_id;
  $('#telegramMessage').textContent=state.telegramStatus?.ready?`Connected${state.telegramStatus.bot_username?` · @${state.telegramStatus.bot_username}`:''}`:state.telegramStatus?.configured?'Token saved but authentication failed':'Add the bot token and authorized chat ID.';
  $('#nousStatus').textContent=state.nousStatus?.ready?'CONNECTED':state.nousStatus?.configured?'CHECK FAILED':'NOT CONFIGURED';
  $('#nousStatus').className=`status ${state.nousStatus?.ready?'completed':'failed'}`;
  $('#nousBaseUrl').value=state.nousStatus?.base_url||'https://inference-api.nousresearch.com/v1';
  $('#nousMessage').textContent=state.nousStatus?.ready?`Connected · ${state.nousStatus.models||0} Nous models available`:state.nousStatus?.configured?'Key saved but connection failed':'Paste a Nous Portal API key to enable Nous routing.';
  const ring=state.agentRingStatus||{};const ringCalls=Array.isArray(ring.calls)?ring.calls.length:0;
  $('#agentRingStatus').textContent=ring.configured?(ring.mode==='twilio'?'TWILIO LIVE':'BRIDGE LIVE'):'NOT CONFIGURED';
  $('#agentRingStatus').className=`status ${ring.configured?'completed':'failed'}`;
  $('#agentRingStatus').textContent=ring.configured?`${ring.mode==='twilio'?'Twilio':'Bridge'} · ${ringCalls} calls logged`:'Add Twilio in the Phone calls panel, or set AGENT_RING_URL on the VPS.';
}

function agentTile(agent) { const active = agent.runs.find((run)=>['running','queued','paused','blocked'].includes(run.status)); return `<article class="agent-tile" data-agent="${esc(agent.id)}"><div class="card-kicker"><span>${esc(agent.agent_type)}</span>${statusBadge(agent.status)}</div><strong>${esc(agent.name)}</strong><small>Manager: ${esc(agent.manager)} · Provider: ${esc(agent.provider || 'internal')}</small><p>${active ? esc(active.objective) : esc(agent.capabilities.join(' · '))}</p><div class="progress-line"><i style="width:${active?.progress || 0}%"></i></div></article>`; }
function renderAgents() { if (!state.data) return; $('#agentGrid').innerHTML = state.data.agents.map(agentTile).join(''); for (const tile of document.querySelectorAll('[data-agent]')) tile.addEventListener('click',()=>openAgent(tile.dataset.agent)); }
function openAgent(id) { const agent=state.data.agents.find(a=>a.id===id); if(!agent)return; $('#agentDetail').hidden=false; $('#agentDetail').innerHTML=`<div class="panel-head"><div><span class="micro">AGENT CONTROL</span><h3>${esc(agent.name)}</h3><p>${esc(agent.capabilities.join(' · '))}</p></div>${statusBadge(agent.status)}</div><div class="project-detail-grid"><div class="detail-block"><h4>Provider routes</h4>${agent.routes.map(r=>`<div class="compact-row"><div><strong>${esc(r.provider)}</strong><small>${esc(r.model)} · ${esc(r.credential_env || 'local')}</small></div>${statusBadge(r.status)}</div>`).join('') || '<small class="muted">No provider route configured.</small>'}</div><div class="detail-block"><h4>Current project</h4><strong>${esc(agent.current_project || 'Not assigned')}</strong><p>Manager: ${esc(agent.manager)}</p></div></div><div class="command-list">${agent.allowed_commands.map(command=>`<button data-agent-command="${esc(command)}">${esc(command)}</button>`).join('')}</div><div class="stack" style="margin-top:12px">${agent.runs.length?agent.runs.map(run=>`<div class="run-row"><div><strong>${esc(run.objective)}</strong><small>${esc(run.project_code || 'No project')} · ${run.progress}% · ${esc(run.current_step)}</small></div><div class="button-row">${statusBadge(run.status)}${run.status==='running'?'<button class="holo-button" data-run-control="pause" data-run-id="'+esc(run.id)+'">PAUSE</button>':run.status==='paused'?'<button class="holo-button" data-run-control="resume" data-run-id="'+esc(run.id)+'">RESUME</button>':''}</div></div>`).join(''):'<div class="empty-state">No runs yet.</div>'}</div>`;
  for (const b of document.querySelectorAll('[data-run-control]')) b.addEventListener('click',async()=>{try{await api(`/v1/agent-runs/${b.dataset.runId}/${b.dataset.runControl}`,{method:'POST',body:'{}'});toast(`Run ${b.dataset.runControl}d`);await loadData();openAgent(id);}catch(e){toast(e.message)}});
  for (const b of document.querySelectorAll('[data-agent-command]')) b.addEventListener('click',async()=>{if(!['create-run','review-code','run-tests','research-query','review-architecture','review-security','summarize-status'].includes(b.dataset.agentCommand)){toast('This command is available after its runtime is connected');return;}const objective=`${b.dataset.agentCommand.replaceAll('-',' ')} for ${agent.current_project || 'the current portfolio'}`;try{await api(`/v1/agents/${agent.id}/runs`,{method:'POST',body:JSON.stringify({objective,project_code:agent.current_project,todo:['Inspect current state','Produce evidence','Report next action']})});toast('Agent run queued');await loadData();openAgent(id);}catch(e){toast(e.message)}}); }

function projectTile(project) { return `<article class="project-tile" data-project="${esc(project.code)}"><div class="card-kicker"><span>${esc(project.code)}</span>${statusBadge(project.status)}</div><strong>${esc(project.name)}</strong><small>${esc(project.stage)} · Manager ${esc(project.control?.manager || 'JARVIS')}</small><p>${esc(project.control?.target_outcome || project.summary)}</p><div class="progress-line"><i style="width:${project.progress}%"></i></div><small>${project.progress}% complete</small></article>`; }
function renderProjects() { if (!state.data) return; $('#projectGrid').innerHTML=state.data.projects.map(projectTile).join(''); for(const tile of document.querySelectorAll('[data-project]')) tile.addEventListener('click',()=>openProject(tile.dataset.project)); }
function openProject(code) { const project=state.data.projects.find(p=>p.code===code); if(!project)return; const control=project.control||{}; const timing=project.timing||{}; $('#projectDetail').hidden=false; $('#projectDetail').innerHTML=`<div class="panel-head"><div><span class="micro">PROJECT CONTROL</span><h3>${esc(project.name)}</h3><p>${esc(project.summary)}</p></div><strong>${project.progress}%</strong></div><div class="progress-line"><i style="width:${project.progress}%"></i></div><div class="project-detail-grid"><div class="detail-block"><h4>Target outcome</h4><p>${esc(control.target_outcome || 'Not set')}</p></div><div class="detail-block"><h4>Manager / next step</h4><p>${esc(control.manager || 'JARVIS')} · ${esc(control.next_step || 'Not set')}</p></div><div class="detail-block"><h4>Timeline</h4><p>Elapsed: ${timing.elapsedDays == null ? 'Unknown' : `${timing.elapsedDays} days`}<br>Deadline: ${control.deadline || 'Not set'}<br>Remaining: ${timing.remainingDays == null ? 'Not calculated' : `${timing.remainingDays} days`}</p></div><div class="detail-block"><h4>Blockers</h4>${(control.blockers||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<small class="muted">None recorded</small>'}</div><div class="detail-block"><h4>Enhancements</h4>${(control.enhancements||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<small class="muted">None recorded</small>'}</div><div class="detail-block"><h4>Roadmap</h4>${(control.roadmap||[]).map((x,i)=>`<li>${i+1}. ${esc(x)}</li>`).join('')||'<small class="muted">Roadmap not set</small>'}</div><div class="detail-block" style="grid-column:1/-1"><h4>Recent updates</h4>${project.updates.length?project.updates.map(u=>`<div class="update-row"><div><strong>${esc(u.title)}</strong><small>${esc(u.detail)} · ${formatTime(u.created_at)}</small></div><span>${esc(u.update_type)}</span></div>`).join(''):'<small class="muted">No updates recorded</small>'}</div></div>`; }

const macActions=[['open_terminal','Open Terminal','safe','Launch Terminal'],['cursor_status','Cursor status','safe','Check Cursor Agent login'],['cursor_open','Open in Cursor','safe','Open the JARVIS workspace'],['cursor_agent','Cursor plan','danger','Run a read-only Cursor plan'],['remote_desktop_device','Remote Desktop','safe','Verify linked RDC device'],['disk_inventory','Disk inventory','safe','Measure home folders'],['list_files','List Desktop','safe','Inspect Desktop files'],['arrange_photos','Arrange photos','review','Organize Pictures by month'],['clean_temp_files','Clean cache','danger','Delete old cache files'],['trash_file','Move to Trash','danger','Requires owner approval']];
function renderMac(){if(!state.data)return;const bridge=state.data.macBridge;$('#macBridgeStatus').textContent=bridge.status==='online'?'CONNECTED':'NOT CONNECTED';$('#macBridgeStatus').className=`status ${bridge.status==='online'?'completed':'failed'}`;$('#macActions').innerHTML=macActions.map(([action,label,risk,detail])=>`<button class="mac-action ${risk}" data-mac-action="${action}"><strong>${label}</strong><small>${risk.toUpperCase()} · ${detail}</small></button>`).join('');for(const b of document.querySelectorAll('[data-mac-action]'))b.addEventListener('click',()=>requestMacJob(b.dataset.macAction));const jobs=state.data.macBridge?.jobs||[];$('#macJobs').innerHTML=jobs.length?jobs.map(j=>`<div class="system-row"><div><strong>${esc(j.action)}</strong><small>${esc(j.risk)} · ${esc(j.status)} · ${formatTime(j.created_at)}</small></div>${j.status==='awaiting_approval'?`<button class="holo-button primary" data-approve-mac="${esc(j.id)}">APPROVE</button>`:statusBadge(j.status)}</div>`).join(''):'<div class="empty-state">No Mac jobs yet.</div>';for(const b of document.querySelectorAll('[data-approve-mac]'))b.addEventListener('click',()=>approveMacJob(b.dataset.approveMac));}
async function requestMacJob(action){const params={};if(action==='list_files')params.path='/Users/Moatazi/Desktop';if(action==='arrange_photos')params.path='/Users/Moatazi/Pictures';if(action==='clean_temp_files'){params.path='/Users/Moatazi/Library/Caches';params.max_age_days=14;}if(action==='cursor_open')params.path='/Users/Moatazi/Documents/ChatGPT/Jarvis';if(action==='cursor_agent'){params.path=prompt('Cursor workspace path','/Users/Moatazi/Documents/ChatGPT/Jarvis');if(!params.path)return;params.prompt=prompt('Cursor planning request');if(!params.prompt)return;params.mode='plan';}if(action==='trash_file'){const target=prompt('Full path of the file to move to Trash');if(!target)return;params.path=target;}try{const job=await api('/v1/mac/jobs',{method:'POST',body:JSON.stringify({action,params,requested_by:'Owner'})});toast(job.status==='awaiting_approval'?'Danger-zone job requires approval':'Mac job queued');await loadData();}catch(e){toast(e.message)}}
async function approveMacJob(id){try{await api(`/v1/mac/jobs/${id}/approve`,{method:'POST',body:'{}'});toast('Mac job approved and queued');await loadData();}catch(e){toast(e.message)}}

async function loadStatus(){state.status=await api('/v1/system/status');renderStatus();}
function renderElevenStatus(data){state.elevenStatus=data;$('#elevenStatus').textContent=data.ready?'READY':data.configured?'CHECK FAILED':'NOT CONFIGURED';$('#elevenStatus').className=`status ${data.ready?'completed':'failed'}`;if(data.agent_id)$('#elevenAgentId').value=data.agent_id;$('#elevenMessage').textContent=data.ready?`Authenticated · ${data.characters_used ?? '—'} / ${data.characters_limit ?? '—'} characters used`:'Paste the API key once and save it securely.';}
async function loadElevenStatus(){const data=await api('/v1/providers/elevenlabs/status');renderElevenStatus(data);}
function renderRepositories(){const data=state.repositories?.repositories||[];$('#repositoryStatus').textContent=data.length?`${data.length} INSTALLED`:'NONE INSTALLED';$('#repositoryStatus').className=`status ${data.length?'completed':'failed'}`;$('#repositoryList').innerHTML=data.length?data.map(repo=>`<div class="system-row"><div><strong>${esc(repo.repository)} · ${esc(repo.project_code)}</strong><small>${esc(repo.branch||'—')}@${esc(String(repo.commit_sha||'').slice(0,12))} · ${esc(repo.dependency_status||'not requested')} · ${esc(repo.workspace_path||'')}</small></div>${statusBadge(repo.status)}</div>`).join(''):'<div class="empty-state">No repositories cloned into the isolated JARVIS workspace.</div>';}
function renderVentureRepositories(){const node=$('#ventureRepositoryList');if(!node)return;const data=state.ventureRepositories||[];$('#ventureRepoCount').textContent=`${data.length} REPOSITORIES`;node.innerHTML=data.length?data.map(repo=>`<div class="system-row"><div><strong>${esc(repo.repo_full_name)}</strong><small>${esc(repo.business_scope)} · ${esc(repo.visibility)} · ${esc(repo.handover_status)}${repo.local_path?` · ${esc(repo.local_path)}`:' · remote only'}</small><small>${esc(repo.role)}</small></div><span class="pill ${repo.local_path?'':'off'}">${repo.local_path?'LOCAL':'REMOTE'}</span></div>`).join(''):'<div class="empty-state">No repository registry imported.</div>';}
function renderHermes(){const node=$('#hermesBridgeStatus');if(!node)return;const data=state.hermesState||{};const bridge=data.bridge||{};const online=bridge.last_seen&&Date.now()-new Date(bridge.last_seen).getTime()<60000&&bridge.gateway_status==='online';node.textContent=online?'CONNECTED':'NOT CONNECTED';node.className=`status ${online?'completed':'failed'}`;$('#hermesProfile').textContent=`${bridge.profile||'default'} · ${online?`last seen ${formatTime(bridge.last_seen)}`:'waiting for Mac bridge'}`;$('#hermesGateway').textContent=(bridge.gateway_status||'offline').toUpperCase();$('#hermesGateway').className=`pill ${online?'':'off'}`;const jobs=data.jobs||[];$('#hermesJobs').innerHTML=jobs.length?jobs.slice(0,20).map(job=>`<div class="system-row"><div><strong>${esc(job.title)}</strong><small>${esc(job.project_code)} · ${esc(job.risk)} · ${esc((job.toolsets||[]).join(', '))} · ${formatTime(job.created_at)}</small>${job.result?`<small>${esc(String(job.result).slice(0,260))}</small>`:''}</div>${statusBadge(job.status)}</div>`).join(''):'<div class="empty-state">No Hermes jobs yet.</div>';}
function renderMemory(){const list=$('#memorySearchResults');if(!list)return;const data=state.memoryEntries||[];$('#memoryCount').textContent=`${data.length} ENTRIES`;list.innerHTML=data.length?data.map(item=>`<div class="system-row"><div><strong>${esc(item.title)}</strong><small>${esc(item.project_code)} · ${esc(item.agent_id)} · ${esc(item.confidence)} · ${formatTime(item.updated_at)}</small><small>${esc(String(item.content).slice(0,320))}</small></div><span class="pill">${esc(item.memory_type)}</span></div>`).join(''):'<div class="empty-state">No shared memory entries found.</div>';}
async function loadData(){const [data,settings,ollamaStatus,telegramStatus,nousStatus,agentRingStatus,githubStatus,repositories,ventureRepositories,hermesData,memoryData,approvalData,accountData]=await Promise.all([api('/v1/agents-projects/state'),api('/v1/settings'),api('/v1/providers/ollama/status'),api('/v1/providers/telegram/status'),api('/v1/providers/nous/status'),api('/v1/agent-ring'),api('/v1/providers/github/status'),api('/v1/repositories'),api('/v1/venture/repositories'),api('/v1/hermes/state'),api('/v1/memory?project_code=STUDIO'),api('/v1/approvals'),api('/v1/account-connections')]);state.data=data;state.settings=settings;state.ollamaStatus=ollamaStatus;state.telegramStatus=telegramStatus;state.nousStatus=nousStatus;state.agentRingStatus=agentRingStatus;state.githubStatus=githubStatus;state.repositories=repositories;state.ventureRepositories=ventureRepositories.repositories||[];state.hermesState=hermesData;state.memoryEntries=memoryData.memories||[];state.approvals=approvalData.pending||[];state.accountConnections=accountData.accounts||[];renderRepositories();renderVentureRepositories();renderHermes();renderMemory();renderGithubStatus();renderApprovals();renderAccountConnections();renderOverview();loadProviderKeys().catch(()=>null);loadSecurityScope().catch(()=>null);loadTwilioStatus().catch(()=>null);loadFaceTimeStatus().catch(()=>null);Promise.all([loadStatus(),loadElevenStatus(),loadFactoryData()]).catch(()=>null);}

async function loadModels(force=false){try{const data=await api(`/v1/models${force?'?refresh=1':''}`);state.allModels=data.models;const providerFilter=$('#providerFilter');const providers=[...new Set(data.models.map(m=>m.provider))].sort();
if(!providerFilter.options.length||providerFilter.dataset.all!=='1'){providerFilter.dataset.all='1';providerFilter.innerHTML='<option value="all">ALL PROVIDERS</option>'+providers.map(p=>`<option value="${esc(p)}">${esc(p.toUpperCase())}</option>`).join('');}
const current=providerFilter.value||'all';const visible=current==='all'?data.models:data.models.filter(m=>m.provider===current);
const order={free:0,cheap:1,paid:2};visible.sort((a,b)=>(a.free===b.free?String(a.provider).localeCompare(b.provider):Number(b.free?1:0)-Number(a.free?1:0))||(order[a.cost_class]??2)-(order[b.cost_class]??2));
const groups=Object.groupBy?Object.groupBy(visible,(m)=>m.provider):visible.reduce((r,m)=>{(r[m.provider]||=[]).push(m);return r},{});const selected=`${data.selected.provider}::${data.selected.model}`;const selectedVisible=visible.some(m=>`${m.provider}::${m.id}`===selected);const unavailable=selectedVisible?'':`<option value="${esc(selected)}" selected disabled>SELECTED / UNAVAILABLE · ${esc(selected)}</option>`;
$('#modelSelect').innerHTML=unavailable+Object.entries(groups).map(([provider,models])=>`<optgroup label="${provider.toUpperCase()}">${models.map(m=>`<option value="${esc(`${m.provider}::${m.id}`)}" ${`${m.provider}::${m.id}`===selected?'selected':''}>${m.free?'FREE · ':''}${esc(m.label)}</option>`).join('')}</optgroup>`).join('');
$('#modelMessage').textContent=`${visible.length} of ${data.models.length} models${current==='all'?'':' · filter: '+current.toUpperCase()}`;
const chosen=data.models.find(m=>`${m.provider}::${m.id}`===selected);$('#modelCostHint').textContent=chosen?(chosen.free?'FREE':chosen.cost_per_million?`$${chosen.cost_per_million.prompt.toFixed(3)}/1M`:''):'';
}catch(e){$('#modelMessage').textContent=e.message.toUpperCase();}}

function renderChat(){const node=$('#chatMessages');node.innerHTML=state.chatMessages.length?state.chatMessages.map(m=>`<div class="chat-message ${esc(m.role)}"><span>${esc(m.content)}</span><small>${esc(m.role)} · ${formatTime(m.created_at)}${m.provider_used?` · ${esc(m.provider_used)}`:''}</small></div>`).join(''):'<div class="chat-empty">Ask JARVIS about an agent, project, blocker or next action.</div>';node.scrollTop=node.scrollHeight;}
function renderHologramState(){const last=[...state.chatMessages].reverse().find(m=>m.role==='assistant');updateHologram(last?.content||'');}
function updateHologram(text){
  const overlay=document.getElementById('hologramOverlay'); if(!overlay) return;
  const voiceOn=Boolean(state.settings?.settings?.voice?.enabled);
  const body=String(text||'').replace(/[`*#_>]/g,'').replace(/\s+/g,' ').trim();
  if(!body||voiceOn){overlay.hidden=true;return;}
  document.getElementById('hologramText').textContent=body.slice(0,600);
  overlay.hidden=false;
}
async function loadChat(){const data=await api('/v1/chat/latest');state.conversationId=data.conversation?.id||null;state.chatMessages=data.messages||[];renderChat();const last=[...state.chatMessages].reverse().find(m=>m.role==='assistant');updateHologram(last?.content||'');}

async function loadSessions(){try{const data=await api('/v1/conversations');state.sessions=data.conversations||[];renderSessions();}catch(err){console.error('sessions',err);}}
function renderSessions(){const list=$('#chatSessionList');if(!list)return;const sessions=state.sessions||[];list.innerHTML=sessions.length?sessions.map(s=>`<button class="chat-session${s.id===state.conversationId?' active':''}" type="button" data-session-id="${esc(s.id)}"><strong>${esc(s.title||'Untitled')}</strong><small>${esc(s.message_count||0)} msgs · ${esc(formatTime(s.updated_at))}</small></button>`).join(''):'<p class="muted">No sessions yet.</p>';}
async function openSession(id){try{const data=await api('/v1/conversations/'+encodeURIComponent(id));state.conversationId=data.conversation?.id||null;state.chatMessages=data.messages||[];renderChat();renderSessions();const last=[...state.chatMessages].reverse().find(m=>m.role==='assistant');updateHologram(last?.content||'');}catch(err){toast('Could not open session: '+err.message);}}
function startNewChat(){state.conversationId=null;state.chatMessages=[];renderChat();renderSessions();updateHologram('');const input=$('#chatInput');if(input)input.focus();toast('New chat started');}
function installChatSessions(){const body=document.querySelector('#chatConsole .intelligence-body');const header=body?.querySelector('.mini-chat-head');if(!body||!header||$('#chatSessions'))return;const panel=document.createElement('div');panel.id='chatSessions';panel.className='chat-sessions';panel.innerHTML='<div class="chat-sessions-head"><span class="micro">SESSIONS</span><button id="newChat" class="mini-icon" type="button" title="New chat" aria-label="Start a new chat">＋</button></div><div id="chatSessionList" class="chat-session-list"></div>';header.insertAdjacentElement('afterend',panel);$('#newChat').addEventListener('click',startNewChat);$('#chatSessionList').addEventListener('click',(event)=>{const button=event.target.closest('button[data-session-id]');if(button)openSession(button.dataset.sessionId);});loadSessions();}
async function playJarvisAudio(blob,finish){
  if(!blob?.size)throw new Error('The speech response was empty');
  const mediaType=blob.type||'audio/mpeg';
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(AudioContextClass){
    const context=new AudioContextClass();
    try{
      const decoded=await context.decodeAudioData((await blob.arrayBuffer()).slice(0));
      const source=context.createBufferSource();source.buffer=decoded;source.connect(context.destination);
      state.voiceAudioContext=context;state.voiceAudioSource=source;
      source.onended=()=>{finish();context.close().catch(()=>{});if(state.voiceAudioContext===context)state.voiceAudioContext=null;if(state.voiceAudioSource===source)state.voiceAudioSource=null;};
      document.body.classList.add('jarvis-speaking');renderSoundState();await context.resume();source.start(0);return;
    }catch(error){
      console.warn('[JARVIS voice] Web Audio decode failed',{mediaType,bytes:blob.size,error:error?.message||String(error)});
      context.close().catch(()=>{});
      state.voiceAudioContext=null;state.voiceAudioSource=null;
    }
  }
  state.voiceAudioUrl=URL.createObjectURL(blob);
  const audio=new Audio();audio.preload='auto';audio.src=state.voiceAudioUrl;audio.hidden=true;document.body.appendChild(audio);state.voiceAudio=audio;
  audio.onplay=()=>{document.body.classList.add('jarvis-speaking');renderSoundState();};
  audio.onended=audio.onerror=()=>{finish();audio.remove();if(state.voiceAudioUrl){URL.revokeObjectURL(state.voiceAudioUrl);state.voiceAudioUrl=null;}};
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Audio loading timed out')),8000);
    audio.addEventListener('canplay',()=>{clearTimeout(timer);resolve();},{once:true});
    audio.addEventListener('error',()=>{clearTimeout(timer);reject(new Error(`Audio decode failed (${mediaType}, ${blob.size} bytes, code ${audio.error?.code||0})`));},{once:true});
    audio.load();
  });
  await audio.play();
}
function speakWithLocalVoice(text,finish,onFailure){
  const synth=window.speechSynthesis;
  if(!synth||typeof SpeechSynthesisUtterance==='undefined'){onFailure?.(new Error('This browser has no local speech voice'));return;}
  synth.cancel();
  const utterance=new SpeechSynthesisUtterance(String(text).replace(/[`*#_>]/g,'').replace(/\s+/g,' ').trim().slice(0,2000));
  const voices=synth.getVoices();
  const language=(navigator.language||'en').split('-')[0];
  utterance.voice=voices.find(voice=>voice.lang?.toLowerCase().startsWith(`${language}-`)&&/Daniel|Alex|Google UK English Male|Microsoft (Guy|Ryan|George)/i.test(voice.name))||voices.find(voice=>voice.lang?.toLowerCase().startsWith(language))||null;
  utterance.rate=.94;utterance.pitch=.84;utterance.volume=1;
  utterance.onstart=()=>{console.info('[JARVIS local voice] started',utterance.voice?.name||'default system voice');document.body.classList.add('jarvis-speaking');renderSoundState();};
  utterance.onend=()=>{console.info('[JARVIS local voice] finished');finish();};
  utterance.onerror=(event)=>{console.warn('[JARVIS local voice] error',event.error);if(['interrupted','canceled'].includes(event.error)){finish();return;}onFailure?.(new Error(event.error||'local playback failed'));};
  synth.speak(utterance);
}
async function speak(text){
  if(state.muted||state.voiceSession||!text)return;
  if(localStorage.getItem('jarvis_speak_replies')==='0')return;
  const resumeWake=state.wakeArmed;
  if(resumeWake)stopWakeWord(false);
  let finished=false;
  const finish=()=>{
    if(finished)return;finished=true;document.body.classList.remove('jarvis-speaking');renderSoundState();
    if((resumeWake||state.rearmAfterVoice||state.autoWake)&&!state.voiceSession)setTimeout(()=>{if(!state.voiceSession&&!state.wakeArmed)armWakeWord();state.rearmAfterVoice=false;},900);
  };
  const paidVoiceEnabled=state.settings?.settings?.voice?.enabled===true&&state.elevenStatus?.ready;
  const useElevenLabs=async()=>{
    if(!paidVoiceEnabled){finish();toast('Free local voice is unavailable and ElevenLabs fallback is off');return;}
    try{
    try{state.voiceAudioSource?.stop();}catch{}try{state.voiceAudioContext?.close();}catch{}
    state.voiceAudioContext=null;state.voiceAudioSource=null;state.voiceAudio?.pause();if(state.voiceAudioUrl)URL.revokeObjectURL(state.voiceAudioUrl);
    const spoken=String(text).replace(/[`*#_>]/g,'').replace(/\s+/g,' ').trim().slice(0,2000);
    const response=await fetch('/v1/voice/speak',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({text:spoken})});
    if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||`HTTP ${response.status}`);}
    await playJarvisAudio(await response.blob(),finish);
    }catch(error){console.error(error);finish();toast(`ElevenLabs fallback: ${error.message}`);}
  };
  speakWithLocalVoice(text,finish,()=>useElevenLabs());
}
let voiceTurnRecognition=null;
let voiceTurnRecorder=null;
let voiceTurnStream=null;
let voiceTurnChunks=[];
let voiceTurnShouldSend=true;
let voiceTurnVadTimer=null;
let voiceTurnLimitTimer=null;
let voiceTurnAudioContext=null;
let voiceTurnTranscribing=false;
function clearVoiceTurnResources(){
  clearInterval(voiceTurnVadTimer);clearTimeout(voiceTurnLimitTimer);voiceTurnVadTimer=null;voiceTurnLimitTimer=null;
  try{voiceTurnAudioContext?.close();}catch{}voiceTurnAudioContext=null;
  try{voiceTurnStream?.getTracks().forEach(track=>track.stop());}catch{}voiceTurnStream=null;
  voiceTurnRecorder=null;voiceTurnChunks=[];voiceTurnRecognition=null;
}
function finishVoiceTurn(){clearVoiceTurnResources();document.body.classList.remove('jarvis-listening');setListening(false);renderSoundState();}
function stopVoiceTurnRecording(send=true){voiceTurnShouldSend=send;if(voiceTurnRecorder&&voiceTurnRecorder.state!=='inactive'){try{voiceTurnRecorder.stop();}catch{finishVoiceTurn();}}}
async function transcribeVoiceBlob(blob){
  if(!blob?.size){toast('No audio was captured');finishVoiceTurn();return;}
  voiceTurnTranscribing=true;document.body.classList.add('jarvis-thinking');toast('Transcribing your voice…');
  try{
    const response=await fetch('/v1/voice/transcribe',{method:'POST',credentials:'same-origin',headers:{'content-type':blob.type||'audio/webm','x-jarvis-language':navigator.language||'en'},body:blob});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||`Transcription failed with HTTP ${response.status}`);
    const transcript=String(result.text||'').trim();
    if(!transcript)throw new Error('No speech was detected');
    const input=$('#chatInput');input.value=transcript;toast(`Heard: ${transcript.slice(0,100)}`);
    await sendChat();
  }catch(error){console.error(error);toast(`Voice input: ${error.message}`);}
  finally{voiceTurnTranscribing=false;document.body.classList.remove('jarvis-thinking');}
}
async function startMediaVoiceTurn(){
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
  const candidates=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const mimeType=candidates.find(type=>window.MediaRecorder?.isTypeSupported?.(type))||'';
  const recorder=mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);
  voiceTurnStream=stream;voiceTurnRecorder=recorder;voiceTurnChunks=[];voiceTurnShouldSend=true;
  recorder.ondataavailable=event=>{if(event.data?.size)voiceTurnChunks.push(event.data);};
  recorder.onerror=event=>{toast(`Microphone: ${event.error?.message||'recording failed'}`);finishVoiceTurn();};
  recorder.onstop=()=>{
    const shouldSend=voiceTurnShouldSend;const blob=new Blob(voiceTurnChunks,{type:recorder.mimeType||mimeType||'audio/webm'});
    finishVoiceTurn();if(shouldSend)transcribeVoiceBlob(blob);
  };
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(AudioContextClass){
    const context=new AudioContextClass();voiceTurnAudioContext=context;
    const analyser=context.createAnalyser();analyser.fftSize=1024;const source=context.createMediaStreamSource(stream);source.connect(analyser);
    const samples=new Uint8Array(analyser.fftSize);let heardSpeech=false;let silenceStarted=0;
    voiceTurnVadTimer=setInterval(()=>{
      analyser.getByteTimeDomainData(samples);let sum=0;for(const sample of samples){const normalized=(sample-128)/128;sum+=normalized*normalized;}
      const rms=Math.sqrt(sum/samples.length);const now=Date.now();
      if(rms>.028){heardSpeech=true;silenceStarted=0;}else if(heardSpeech&&rms<.012){if(!silenceStarted)silenceStarted=now;if(now-silenceStarted>1100)stopVoiceTurnRecording(true);}
    },110);
  }
  recorder.start(250);voiceTurnLimitTimer=setTimeout(()=>stopVoiceTurnRecording(true),12000);
  document.body.classList.add('jarvis-listening');setListening(true);renderSoundState();toast('Listening now — speak normally. Tap the mic again to send.');
}
function startBrowserSpeechTurn(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){toast('This browser cannot access the microphone');finishVoiceTurn();return;}
  const recognition=new Recognition();voiceTurnRecognition=recognition;
  recognition.lang=navigator.language||'en-US';recognition.continuous=false;recognition.interimResults=true;
  let handled=false;
  recognition.onstart=()=>{document.body.classList.add('jarvis-listening');setListening(true);toast('Listening… speak to JARVIS');};
  recognition.onresult=(event)=>{
    let transcript='';
    for(let i=event.resultIndex;i<event.results.length;i+=1)transcript+=event.results[i][0]?.transcript||'';
    transcript=transcript.trim();
    if(!transcript||event.results[event.results.length-1]?.isFinal===false)return;
    handled=true;const input=$('#chatInput');input.value=transcript;finishVoiceTurn();sendChat();
  };
  recognition.onerror=(event)=>{if(!['aborted','no-speech'].includes(event.error))toast(`Voice input: ${event.error}`);};
  recognition.onend=()=>{if(!handled&&voiceTurnRecognition===recognition)finishVoiceTurn();};
  try{recognition.start();}catch(error){finishVoiceTurn();toast(`Voice input: ${error.message}`);}
}
async function startVoiceTurn(){
  if(state.micMuted){toast('Microphone is muted');return;}
  if(voiceTurnTranscribing){toast('Please wait for the current transcription');return;}
  if(voiceTurnRecorder&&voiceTurnRecorder.state!=='inactive'){stopVoiceTurnRecording(true);return;}
  if(voiceTurnRecognition){try{voiceTurnRecognition.stop();}catch{}return;}
  if(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder){
    document.body.classList.add('jarvis-listening');setListening(true);renderSoundState();
    try{await startMediaVoiceTurn();return;}catch(error){finishVoiceTurn();console.error(error);toast(`Microphone: ${error.message||error.name}`);return;}
  }
  startBrowserSpeechTurn();
}
async function sendChat(){const input=$('#chatInput'),message=input.value.trim();if(!message&&!state.imageData)return;state.chatMessages.push({role:'assistant',content:'JARVIS is processing…',created_at:new Date().toISOString()});renderChat();document.body.classList.add('jarvis-thinking');input.disabled=true;try{const result=await api('/v1/chat',{method:'POST',body:JSON.stringify({conversation_id:state.conversationId,message:message||'Analyze the attached image.',image_data_url:state.imageData,image_name:state.imageName})});state.conversationId=result.conversationId;input.value='';clearImage();await loadChat();loadSessions();$('#chatProvider').textContent=result.providerUsed.toUpperCase();document.body.classList.remove('jarvis-thinking');updateHologram(result.message.content);speak(result.message.content);}catch(e){document.body.classList.remove('jarvis-thinking');state.chatMessages=state.chatMessages.filter(m=>!m.content.includes('processing'));state.chatMessages.push({role:'assistant',content:`Request failed: ${e.message}`,created_at:new Date().toISOString()});renderChat();}finally{input.disabled=false;input.focus();}}
function setListening(value){state.listening=value;$('#micButton').setAttribute('aria-pressed',String(value));document.body.classList.toggle('jarvis-listening',value);renderSoundState();}
function stopWakeWord(clearIntent=true){
  clearTimeout(state.wakeRestartTimer);state.wakeRestartTimer=null;state.wakeArmed=false;
  if(clearIntent)state.rearmAfterVoice=false;
  try{state.wakeRecognition?.abort();}catch{}
  state.wakeRecognition=null;setListening(false);renderSoundState();
}
function maybeAutoArmWake(){
  if(state.micMuted||!state.autoWake||state.voiceSession||state.wakeArmed||state.wakeStarting)return;
  setTimeout(()=>{if(!state.micMuted&&state.autoWake&&!state.voiceSession&&!state.wakeArmed&&!state.wakeStarting)armWakeWord(true);},700);
}
function armWakeWord(autoStart=false){
  if(state.voiceSession||state.wakeStarting)return;
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){toast('Wake listening requires Chrome speech recognition');return;}
  stopWakeWord(false);
  const recognition=new Recognition();state.wakeRecognition=recognition;state.wakeArmed=true;
  recognition.continuous=true;recognition.interimResults=true;recognition.lang='en-US';
  let lastWakeAt=0;
  recognition.onstart=()=>{state.wakeArmed=true;renderSoundState();if(!autoStart)toast('Wake listening armed. Say “JARVIS”.');};
  recognition.onresult=(event)=>{
    let transcript='';
    for(let index=event.resultIndex;index<event.results.length;index+=1)transcript+=` ${event.results[index][0]?.transcript||''}`;
    const heard=transcript.trim();
    if(/\bjarvis\b/i.test(heard)&&Date.now()-lastWakeAt>3000&&!state.wakeStarting){lastWakeAt=Date.now();activateWakePhrase(heard);}
  };
  recognition.onerror=(event)=>{
    if(['not-allowed','service-not-allowed','audio-capture'].includes(event.error)){state.wakeArmed=false;toast(`Microphone: ${event.error}`);}
    renderSoundState();
  };
  recognition.onend=()=>{
    if(state.wakeArmed&&!state.voiceSession&&!state.wakeStarting){state.wakeRestartTimer=setTimeout(()=>{try{recognition.start();}catch{}},600);}
    else renderSoundState();
  };
  try{recognition.start();}catch(error){state.wakeArmed=false;state.wakeRecognition=null;if(!autoStart)toast(`Wake listening: ${error.message}`);renderSoundState();}
}
async function activateWakePhrase(transcript){
  state.wakeStarting=true;state.wakeArmed=false;state.rearmAfterVoice=true;
  clearTimeout(state.wakeRestartTimer);try{state.wakeRecognition?.abort();}catch{}state.wakeRecognition=null;
  const request=String(transcript).replace(/^.*?\bjarvis\b[\s,.:;-]*/i,'').trim();
  toast('Wake word detected');
  try{if(request){$('#chatInput').value=request;await sendChat();}else await startVoiceTurn();}finally{state.wakeStarting=false;renderSoundState();}
}
function clearImage(){state.imageData=null;state.imageName=null;$('#chatImageInput').value='';$('#imagePreview').hidden=true;$('#imagePreviewImg').removeAttribute('src');}
function toggleMicMute(){
  state.micMuted=!state.micMuted;
  try{state.voiceSession?.setMicMuted?.(state.micMuted);}catch(error){console.error(error);}
  if(state.micMuted)stopWakeWord(false);
  renderSoundState();
  if(!state.micMuted)maybeAutoArmWake();
}
async function stopLiveVoice(){try{await state.voiceSession?.endSession()}catch{}state.voiceSession=null;try{state.voiceAudioSource?.stop();}catch{}try{state.voiceAudioContext?.close();}catch{}state.voiceAudioSource=null;state.voiceAudioContext=null;state.voiceAudio?.pause();stopAudioMeter();document.body.classList.remove('jarvis-listening','jarvis-speaking','jarvis-thinking');$('#micButton').setAttribute('aria-pressed','false');renderSoundState();}
async function startElevenVoice(initialRequest=''){
  if(!initialRequest){await startVoiceTurn();return;}
  if(state.voiceSession){await stopLiveVoice();toast('Voice session ended');return;}
  if(!state.elevenStatus?.ready){toast('ElevenLabs is not configured or failed authentication');return;}
  stopWakeWord(false);
  try{
    const session=await api('/v1/voice/session',{method:'POST',body:'{}'});
    const { Conversation }=await import('/vendor/elevenlabs-client.js');
    $('#micButton').setAttribute('aria-pressed','true');
    state.voiceSession=await Conversation.startSession({signedUrl:session.signed_url,workletPaths:{rawAudioProcessor:'/vendor/worklets/rawAudioProcessor.js',audioConcatProcessor:'/vendor/worklets/audioConcatProcessor.js'},clientTools:{ask_jarvis:async({message})=>{const request=String(message||'').trim();if(!request)return 'Please repeat the request.';const result=await api('/v1/chat',{method:'POST',body:JSON.stringify({conversation_id:state.conversationId,message:request})});state.conversationId=result.conversationId;await loadChat();return result.message.content;}},onConnect:()=>{state.voiceSession?.setVolume?.({volume:state.muted?0:1});document.body.classList.add('jarvis-listening');startAudioMeter();renderSoundState();if(initialRequest)setTimeout(()=>{try{state.voiceSession?.sendUserMessage(initialRequest);}catch{}},250);toast(initialRequest?'JARVIS is answering':'ElevenLabs voice connected');setTimeout(()=>stopLiveVoice(),Number(session.session_max_seconds||300)*1000);},onDisconnect:()=>{state.voiceSession=null;stopAudioMeter();document.body.classList.remove('jarvis-listening','jarvis-speaking','jarvis-thinking');$('#micButton').setAttribute('aria-pressed','false');renderSoundState();if(state.rearmAfterVoice||state.autoWake)setTimeout(()=>maybeAutoArmWake(),900);},onModeChange:({mode})=>{setListening(mode==='listening');document.body.classList.toggle('jarvis-speaking',mode==='speaking');renderSoundState();},onError:(error)=>{console.error(error);toast('ElevenLabs voice connection failed');stopLiveVoice();}});
  }catch(e){await stopLiveVoice();if(/daily limit|agent.*limit|reached/i.test(e.message)){toast('Live voice quota reached — switching to voice turn fallback');startVoiceTurn();}else toast(`Voice: ${e.message}`);}
}

installAudioControls();installClaudeControls();installHermesControls();installAgentFactory();installRepositoryRegistry();installGithubControls();installProviderKeyControls();installTwilioControls();installFaceTimeControls();installControlSurfaces();installPresenceLipSync();installChatPresence();installChatSessions();installNavigationIA();installCollapsibleWidgets();
$('#loginForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await api('/v1/session',{method:'POST',body:JSON.stringify({token:$('#token').value})});$('#token').value='';await bootstrap();}catch(err){$('#loginError').textContent=err.message;}});
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view));for(const b of document.querySelectorAll('[data-jump]'))b.addEventListener('click',()=>setView(b.dataset.jump));$('#homeButton').addEventListener('click',()=>setView('overview'));$('#logout').addEventListener('click',async()=>{await api('/v1/session',{method:'DELETE'});showLogin();});
$('#refreshAgents').addEventListener('click',loadData);$('#refreshProjects').addEventListener('click',loadData);$('#refreshMac').addEventListener('click',loadData);$('#refreshModels').addEventListener('click',()=>loadModels(true));$('#applyModel').addEventListener('click',async()=>{const[provider,...rest]=$('#modelSelect').value.split('::');try{await api('/v1/models/select',{method:'POST',body:JSON.stringify({provider,model:rest.join('::')})});toast('Model applied');await Promise.all([loadModels(),loadStatus()]);}catch(e){toast(e.message)}});
$('#refreshSettings').addEventListener('click',loadData);
document.getElementById('speakReplies')?.addEventListener('change',(e)=>{localStorage.setItem('jarvis_speak_replies',e.target.checked?'1':'0');toast(e.target.checked?'JARVIS will speak replies':'Spoken replies disabled');});

const motionModes=['off','drift','breathe','scan'];
function applyWallpaperMotion(mode){
  const safe=motionModes.includes(mode)?mode:'off';
  for(const m of motionModes) document.body.classList.toggle(`wallpaper-motion-${m}`,m===safe&&m!=='off');
  document.querySelectorAll('.wp-seg').forEach((b)=>b.classList.toggle('active',b.dataset.motion===safe));
  localStorage.setItem('jarvis_wallpaper_motion',safe);
}
function applyWallpaperLock(locked){
  const toggle=document.getElementById('wallpaperLock');
  if(toggle){toggle.setAttribute('aria-pressed',String(locked));toggle.textContent=locked?'LOCKED':'LOCK';}
  document.body.classList.toggle('wallpaper-locked',locked);
  localStorage.setItem('jarvis_wallpaper_locked',locked?'1':'0');
}
let wallpaperHideTimer=null;
function setWallpaperPanel(open){
  const trigger=document.getElementById('wallpaperControls');
  const panel=document.getElementById('wallpaperPanel');
  if(!trigger||!panel) return;
  panel.hidden=!open;
  trigger.setAttribute('aria-expanded',String(open));
  clearTimeout(wallpaperHideTimer);
  if(open){renderWallpaperState();wallpaperHideTimer=setTimeout(()=>setWallpaperPanel(false),6000);}
}
function renderWallpaperState(){
  const locked=localStorage.getItem('jarvis_wallpaper_locked')==='1';
  const toggle=document.getElementById('wallpaperLock');
  if(toggle){toggle.setAttribute('aria-pressed',String(locked));toggle.textContent=locked?'LOCKED':'LOCK';}
  const mode=localStorage.getItem('jarvis_wallpaper_motion')||'off';
  document.querySelectorAll('.wp-seg').forEach((b)=>b.classList.toggle('active',b.dataset.motion===mode));
}
document.getElementById('wallpaperControls')?.addEventListener('click',(e)=>{e.stopPropagation();setWallpaperPanel(document.getElementById('wallpaperPanel')?.hidden!==false);});
document.getElementById('wallpaperLock')?.addEventListener('click',()=>{applyWallpaperLock(localStorage.getItem('jarvis_wallpaper_locked')!=='1');renderWallpaperState();});
document.querySelectorAll('.wp-seg').forEach((b)=>b.addEventListener('click',()=>applyWallpaperMotion(b.dataset.motion)));
document.addEventListener('click',(e)=>{if(!e.target.closest('.wallpaper-side'))setWallpaperPanel(false);});
document.addEventListener('keydown',(e)=>{if(e.key==='Escape')setWallpaperPanel(false);});

let dictation=null;
document.getElementById('dictateButton')?.addEventListener('click',()=>{
  const button=document.getElementById('dictateButton');
  const input=document.getElementById('chatInput');
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){toast('Dictation is not supported in this browser');return;}
  if(dictation){try{dictation.stop();}catch{};dictation=null;button.classList.remove('active');button.setAttribute('aria-pressed','false');return;}
  dictation=new Recognition();
  dictation.lang=navigator.language||'en-US';
  dictation.continuous=true;
  dictation.interimResults=true;
  const base=input.value?input.value.trim()+' ':'';
  dictation.onresult=(event)=>{let text='';for(let i=event.resultIndex;i<event.results.length;i+=1){text+=event.results[i][0].transcript;}input.value=(base+text).slice(0,8000);};
  dictation.onerror=(event)=>{toast(`Dictation: ${event.error}`);};
  dictation.onend=()=>{dictation=null;button.classList.remove('active');button.setAttribute('aria-pressed','false');};
  dictation.start();
  button.classList.add('active');button.setAttribute('aria-pressed','true');toast('Listening… tap the mic again to stop');
});
document.getElementById('voiceEnabled')?.addEventListener('change',async(e)=>{const want=e.target.checked;try{const res=await api('/v1/voice/enabled',{method:'POST',body:JSON.stringify({enabled:want})});toast(res.voice_enabled?'Voice enabled':'Voice fully disabled');await loadData();}catch(err){e.target.checked=!want;toast(err.message);}});
$('#phoneLogin')?.addEventListener('click',async()=>{
  const message=$('#phoneLoginMessage');
  try{
    message.textContent='Creating a one-time login link…';
    const result=await api('/v1/device-links',{method:'POST',body:JSON.stringify({deliver:true})});
    message.textContent=result.delivered_to_telegram?'Login link sent to your Telegram. Open it on your phone — the session lasts 30 days.':'Login link created. Open it on your phone within 15 minutes.';
    if(!result.delivered_to_telegram){try{await navigator.clipboard.writeText(result.url);toast('Link copied to clipboard');}catch{}}
  }catch(err){message.textContent=err.message;}
});
$('#settingsForm').addEventListener('submit',async(e)=>{e.preventDefault();try{state.settings=await api('/v1/settings',{method:'PATCH',body:JSON.stringify({voice:{session_max_seconds:Number($('#voiceMaxSeconds').value),daily_session_limit:Number($('#voiceDailyLimit').value)}})});renderUsage();$('#settingsMessage').textContent='Voice limits saved';toast('Settings saved');}catch(err){$('#settingsMessage').textContent=err.message;}});
$('#ollamaForm').addEventListener('submit',async(e)=>{e.preventDefault();try{state.ollamaStatus=await api('/v1/providers/ollama',{method:'POST',body:JSON.stringify({api_key:$('#ollamaApiKey').value,base_url:$('#ollamaBaseUrl').value})});$('#ollamaApiKey').value='';renderUsage();await loadModels(true);toast('Ollama provider saved');}catch(err){$('#ollamaMessage').textContent=err.message;}});
$('#nousForm').addEventListener('submit',async(e)=>{e.preventDefault();try{state.nousStatus=await api('/v1/providers/nous',{method:'POST',body:JSON.stringify({api_key:$('#nousApiKey').value,base_url:$('#nousBaseUrl').value})});$('#nousApiKey').value='';renderUsage();await loadModels(true);toast('Nous provider saved');}catch(err){$('#nousMessage').textContent=err.message;}});
$('#agentRingForm').addEventListener('submit',async(e)=>{e.preventDefault();try{const result=await api('/v1/agent-ring/call',{method:'POST',body:JSON.stringify({message:$('#agentRingCallMessage').value,to_phone:$('#agentRingPhone').value.trim()||null})});$('#agentRingMessage').textContent=result?.placed?'Call placed':`Not placed · ${result?.reason||result?.error||'unknown'}`;toast(result?.placed?'Call placed':'Call failed');}catch(err){$('#agentRingMessage').textContent=err.message;}});
$('#testAgentRing').addEventListener('click',async()=>{try{const result=await api('/v1/agent-ring',{method:'GET'});state.agentRingStatus=result;renderUsage();toast(result?.configured?'Bridge configured':'Bridge not configured');}catch(err){toast(err.message)}});
$('#providerFilter').addEventListener('change',()=>loadModels(false));
$('#telegramForm').addEventListener('submit',async(e)=>{e.preventDefault();try{state.telegramStatus=await api('/v1/providers/telegram',{method:'POST',body:JSON.stringify({bot_token:$('#telegramBotToken').value,chat_id:$('#telegramChatId').value})});$('#telegramBotToken').value='';renderUsage();toast('Telegram channel saved');}catch(err){$('#telegramMessage').textContent=err.message;}});
$('#testTelegram').addEventListener('click',async()=>{try{const result=await api('/v1/providers/telegram/test',{method:'POST',body:'{}'});$('#telegramMessage').textContent=`Test delivered · message ${result.message_id}`;}catch(err){$('#telegramMessage').textContent=err.message;}});
$('#testTelegramVoice').addEventListener('click',async()=>{try{const result=await api('/v1/providers/telegram/test-voice',{method:'POST',body:'{}'});$('#telegramMessage').textContent=`Voice test delivered · message ${result.message_id}`;}catch(err){$('#telegramMessage').textContent=err.message;}});
function setChatWorkspace(open){const main=$('.main'),chat=$('#chatConsole'),shell=$('#shell');if(!main||!chat||!shell)return;main.classList.toggle('chat-open',open);shell.classList.toggle('chat-open',open);chat.classList.toggle('open',open);if(open)setTimeout(()=>$('#chatInput').focus(),250);}
$('#openChat').addEventListener('click',()=>setChatWorkspace(true));$('#chatClose').addEventListener('click',()=>setChatWorkspace(false));$('#chatForm').addEventListener('submit',e=>{e.preventDefault();sendChat()});$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});$('#micButton').addEventListener('click',()=>{if(state.micMuted){toast('Microphone is muted');return;}if(state.voiceSession){state.rearmAfterVoice=false;stopLiveVoice();}else startVoiceTurn();});$('#talkButton').addEventListener('click',()=>{if(state.micMuted){toast('Microphone is muted');return;}if(state.voiceSession){state.rearmAfterVoice=false;stopLiveVoice();}else if(state.elevenStatus?.ready){state.rearmAfterVoice=false;startElevenVoice();}else startVoiceTurn();});$('#muteButton').addEventListener('click',toggleMicMute);$('#attachImage').addEventListener('click',()=>$('#chatImageInput').click());$('#chatImageInput').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>4*1024*1024){toast('Image must be 4 MB or smaller');clearImage();return;}const reader=new FileReader();reader.onload=()=>{state.imageData=reader.result;state.imageName=file.name;$('#imagePreviewImg').src=reader.result;$('#imageName').textContent=file.name;$('#imagePreview').hidden=false;};reader.readAsDataURL(file)});$('#removeImage').addEventListener('click',clearImage);
$('#elevenForm').addEventListener('submit',async(e)=>{e.preventDefault();try{const data=await api('/v1/providers/elevenlabs',{method:'POST',body:JSON.stringify({api_key:$('#elevenApiKey').value,agent_id:$('#elevenAgentId').value})});$('#elevenApiKey').value='';renderElevenStatus(data);toast('ElevenLabs credentials saved encrypted');}catch(err){$('#elevenMessage').textContent=err.message;}});
$('#testEleven').addEventListener('click',async()=>{try{const session=await api('/v1/voice/session',{method:'POST',body:'{}'});$('#elevenMessage').textContent=`Signed session issued · ${session.sessions_today}/${session.session_limit} used today · ${session.session_max_seconds}s cap`;}catch(err){$('#elevenMessage').textContent=err.message;}});
$('#repositoryForm').addEventListener('submit',async(e)=>{e.preventDefault();const button=e.submitter||$('#repositoryForm').querySelector('button[type="submit"]');button.disabled=true;$('#repositoryMessage').textContent='Cloning and inspecting repository…';try{const repo=await api('/v1/repositories',{method:'POST',body:JSON.stringify({project_code:$('#repositoryProject').value,url:$('#repositoryUrl').value,install_dependencies:$('#repositoryInstallDependencies').checked})});$('#repositoryUrl').value='';$('#repositoryInstallDependencies').checked=false;$('#repositoryMessage').textContent=`${repo.repository} ready at ${String(repo.commit_sha).slice(0,12)}`;await loadData();}catch(err){$('#repositoryMessage').textContent=err.message;}finally{button.disabled=false;}});
document.addEventListener('click',async(e)=>{const button=e.target.closest('#auditCapabilities');if(!button)return;button.disabled=true;button.textContent='AUDITING…';$('#capabilityAuditList').innerHTML='<div class="empty-state">Opening Chromium, checking GitHub, workers and providers…</div>';try{state.capabilityAudit=await api('/v1/capabilities/audit?probe=1');renderCapabilityAudit();toast(`Audit complete · ${state.capabilityAudit.summary.verified} verified`);}catch(err){$('#capabilityAuditList').innerHTML=`<div class="empty-state">${esc(err.message)}</div>`;}finally{button.disabled=false;button.textContent='RUN LIVE CAPABILITY AUDIT';}});
document.addEventListener('click',async(e)=>{
  const approval=e.target.closest('[data-approval-kind]');
  if(approval){approval.disabled=true;try{await api(`/v1/approvals/${encodeURIComponent(approval.dataset.approvalKind)}/${encodeURIComponent(approval.dataset.approvalId)}/decision`,{method:'POST',body:JSON.stringify({decision:approval.dataset.decision})});toast(`Decision recorded: ${approval.dataset.decision}`);await loadData();}catch(err){toast(err.message);approval.disabled=false;}return;}
  const verify=e.target.closest('[data-account-verify]');
  if(verify){verify.disabled=true;verify.textContent='VERIFYING…';try{await api(`/v1/account-connections/${encodeURIComponent(verify.dataset.accountVerify)}/confirm`,{method:'POST',body:'{}'});toast('Independent browser verification queued');await loadData();}catch(err){toast(err.message);verify.disabled=false;verify.textContent='VERIFY LOGIN';}}
});
function updateClock(){const now=new Date();$('#clock').textContent=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Africa/Cairo'}).format(now);$('#dateDisplay').textContent=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'Africa/Cairo'}).format(now);}
async function bootstrap(){try{await Promise.all([loadData(),loadModels(),loadChat()]);showApp();if(localStorage.getItem('jarvis_speak_replies')===null)localStorage.setItem('jarvis_speak_replies','1');const locked=localStorage.getItem('jarvis_wallpaper_locked')==='1';document.body.classList.toggle('wallpaper-locked',locked);applyWallpaperMotion(localStorage.getItem('jarvis_wallpaper_motion')||'off');renderHologramState();if(window.matchMedia('(min-width: 1100px)').matches)setChatWorkspace(true);}catch(e){showLogin();}}
updateClock();setInterval(updateClock,1000);setInterval(()=>{if(!$('#shell').hidden)loadData().catch(()=>{})},15000);bootstrap();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')maybeAutoArmWake();});
setInterval(()=>{if(!$('#shell').hidden)loadClaudeState().catch(()=>{});},15000);
setTimeout(()=>loadClaudeState().catch(()=>{}),2500);
