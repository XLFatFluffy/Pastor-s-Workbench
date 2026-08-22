// AI-friendly workspace affordances. Every workstation gets explicit, contextual
// prompts so the AI can assist without the user needing to know how its context works.
const CONFIG = {
  dashboard: ['Help me prioritize today', 'Give me my daily briefing', 'What should I work on next?'],
  search: ['Help me find what I need', 'Summarize these search results', 'Connect the useful results to my current work'],
  calendar: ['Help me plan today', 'Find time for my highest-priority work', 'Review my upcoming schedule'],
  bible: ['Help me study this passage', 'Find cross-references and themes', 'Turn this passage into study notes'],
  confession: ['Explain this section', 'Connect this doctrine to Scripture', 'Help me study this teaching'],
  concordance: ['Help me understand this word study', 'Find important related passages', 'Turn these findings into research notes'],
  research: ['Help me organize this research', 'Summarize the current research', 'Find connections to my sermons and studies'],
  sermons: ['Help me develop this sermon', 'Review my sermon structure', 'What is missing from this sermon?'],
  lessons: ['Help me develop this lesson', 'Create a teaching outline', 'Check this lesson for clarity and application'],
  studies: ['Help me continue this study', 'Organize my study findings', 'What should I research next?'],
  projects: ['Help me plan this project', 'Show me the next useful step', 'Review this project for missing work'],
  books: ['Help me use this book', 'Find material relevant to my current work', 'Summarize the selected book material'],
  documents: ['Help me understand this document', 'Find relevant material in these files', 'Connect this document to my work'],
  commentaries: ['Help me use this commentary', 'Compare this with Scripture', 'Find material relevant to my current study'],
  notes: ['Help me organize these notes', 'Find connections among my notes', 'Turn this note into useful ministry work'],
  topics: ['Help me develop this topic', 'Find related Scripture and research', 'Connect this topic to my current projects'],
  collections: ['Help me organize this collection', 'Find connections in this material', 'Suggest the next useful step'],
  ai: ['Explain what you can do here', 'Help me work with my Workbench', 'Show me how to use AI actions'],
  settings: ['Help me configure the Workbench', 'Explain these AI settings', 'Check my AI setup']
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function getWorkspaceAIContract(routeId = '') {
  const prompts = CONFIG[routeId] || ['Help me with this workspace', 'Summarize what I am working on', 'What should I do next?'];
  const entity = globalThis.__pwbCurrentEntity || null;
  return {
    route: routeId,
    entity_type: entity?.type || '',
    entity_id: entity?.id || '',
    label: (typeof document !== 'undefined' ? document.querySelector('.canvas__title')?.textContent?.trim() : '') || routeId,
    capabilities: prompts,
    instruction: `The user is currently working in the ${routeId || 'current'} Workbench workspace. Use the visible workspace content and connected records to give practical, contextual assistance.`
  };
}

export function installWorkspaceAIAssist(routeId = '') {
  const mount = document.getElementById('app-view');
  if (!mount || mount.querySelector('.workspace-ai-assist')) return;
  const contract = getWorkspaceAIContract(routeId);
  const bar = document.createElement('section');
  bar.className = 'workspace-ai-assist';
  bar.setAttribute('aria-label', 'AI assistance for this workspace');
  bar.innerHTML = `<div class="workspace-ai-assist__head"><div><strong>AI help for this workspace</strong><span>Ask about what you are currently working on.</span></div><button type="button" class="text-button workspace-ai-assist__open">Open AI</button></div><div class="workspace-ai-assist__prompts">${contract.capabilities.map((p,i)=>`<button type="button" class="workspace-ai-assist__prompt" data-prompt="${esc(p)}">${esc(p)}</button>`).join('')}</div>`;
  const header = mount.querySelector('.canvas__header');
  (header || mount.firstElementChild)?.insertAdjacentElement('afterend', bar);
  bar.querySelector('.workspace-ai-assist__open')?.addEventListener('click', () => globalThis.openGlobalAIWithPrompt?.('Help me with the current workspace.'));
  bar.querySelectorAll('.workspace-ai-assist__prompt').forEach(btn => btn.addEventListener('click', () => globalThis.openGlobalAIWithPrompt?.(btn.dataset.prompt || 'Help me with this workspace.')));
  globalThis.__pwbWorkspaceAI = contract;
}
