document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const suggestCloseBtn = document.getElementById('suggestCloseBtn');
  const statusEl = document.getElementById('status');
  const groupsEl = document.getElementById('groups');
  const suggestionsEl = document.getElementById('suggestions');

  // Load saved API key
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  if (geminiApiKey) {
    apiKeyInput.value = geminiApiKey;
  }

  // Save API key
  saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      await chrome.storage.local.set({ geminiApiKey: key });
      showStatus('API key saved!', 'success');
    }
  });

  // Analyze and organize tabs
  analyzeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('Please enter your Gemini API key', 'error');
      return;
    }

    const customKeywords = document.getElementById('customKeywords').value.trim();
    const useExisting = document.getElementById('useExistingGroups').checked;
    const allWindows = document.getElementById('allWindows').checked;

    showStatus('Extracting content from tabs...', 'loading');
    analyzeBtn.disabled = true;

    try {
      // Query tabs based on user preference
      const query = allWindows ? {} : { currentWindow: true };
      const tabs = await chrome.tabs.query(query);

      // Get existing tab groups
      let existingGroups = [];
      if (useExisting) {
        const allTabGroups = await chrome.tabGroups.query({});
        existingGroups = allTabGroups.map(group => ({
          id: group.id,
          title: group.title || 'Untitled',
          color: group.color,
          collapsed: group.collapsed
        }));
      }

      // Extract content from each tab
      const tabData = await Promise.all(tabs.map(async (tab) => {
        let content = '';
        let description = '';

        try {
          // Skip chrome:// and other internal URLs
          if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
            return {
              id: tab.id,
              title: tab.title,
              url: tab.url,
              domain: 'system',
              content: '',
              description: '',
              groupId: tab.groupId
            };
          }

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Extract meta description
              const metaDesc = document.querySelector('meta[name="description"]');
              const ogDesc = document.querySelector('meta[property="og:description"]');

              // Extract visible text (limit to first 1000 chars)
              const text = document.body.innerText.substring(0, 1000);

              return {
                description: metaDesc?.content || ogDesc?.content || '',
                content: text.replace(/\s+/g, ' ').trim()
              };
            }
          });

          if (results && results[0]?.result) {
            content = results[0].result.content;
            description = results[0].result.description;
          }
        } catch (err) {
          console.log(`Could not extract content from tab ${tab.id}:`, err.message);
        }

        return {
          id: tab.id,
          title: tab.title,
          url: tab.url,
          domain: new URL(tab.url).hostname,
          content,
          description,
          groupId: tab.groupId
        };
      }));

      showStatus('Analyzing with AI...', 'loading');
      const groups = await analyzeTabsWithGemini(apiKey, tabData, existingGroups, customKeywords);
      displayGroups(groups, tabData, existingGroups);
      showStatus(`Organized into ${groups.length} groups`, 'success');
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      analyzeBtn.disabled = false;
    }
  });

  // Suggest tabs to close
  suggestCloseBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('Please enter your Gemini API key', 'error');
      return;
    }

    showStatus('Extracting content from tabs...', 'loading');
    suggestCloseBtn.disabled = true;

    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });

      // Extract content from each tab (reuse same logic)
      const tabData = await Promise.all(tabs.map(async (tab) => {
        let content = '';
        let description = '';

        try {
          if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
            return {
              id: tab.id,
              title: tab.title,
              url: tab.url,
              domain: 'system',
              content: '',
              description: ''
            };
          }

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const metaDesc = document.querySelector('meta[name="description"]');
              const ogDesc = document.querySelector('meta[property="og:description"]');
              const text = document.body.innerText.substring(0, 1000);

              return {
                description: metaDesc?.content || ogDesc?.content || '',
                content: text.replace(/\s+/g, ' ').trim()
              };
            }
          });

          if (results && results[0]?.result) {
            content = results[0].result.content;
            description = results[0].result.description;
          }
        } catch (err) {
          console.log(`Could not extract content from tab ${tab.id}:`, err.message);
        }

        return {
          id: tab.id,
          title: tab.title,
          url: tab.url,
          domain: new URL(tab.url).hostname,
          content,
          description
        };
      }));

      showStatus('Analyzing tabs for closure suggestions...', 'loading');
      const suggestions = await suggestTabsToClose(apiKey, tabData);
      displaySuggestions(suggestions, tabData);
      showStatus(`Found ${suggestions.length} tabs to potentially close`, 'success');
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      suggestCloseBtn.disabled = false;
    }
  });

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status show ${type}`;
  }

  async function analyzeTabsWithGemini(apiKey, tabs, existingGroups = [], customKeywords = '') {
    let existingGroupsText = '';
    if (existingGroups.length > 0) {
      existingGroupsText = `\n\nExisting Tab Groups (you can suggest adding tabs to these):
${existingGroups.map(g => `- "${g.title}" (color: ${g.color}, ${g.collapsed ? 'collapsed' : 'open'})`).join('\n')}

When suggesting groups, you can either:
1. Use an existing group name if tabs fit well (set "existingGroupId" to the group ID)
2. Create a new group name if tabs don't fit existing groups

For existing groups, set "isExisting": true and include the exact group name.`;
    }

    let customKeywordsText = '';
    if (customKeywords) {
      customKeywordsText = `\n\nUser-specified group keywords to consider: ${customKeywords}
Try to use these keywords when creating group names if they match the tab content.`;
    }

    const prompt = `Analyze these browser tabs and group them by topic/category.
Consider:
- Same domain/website
- Similar topics (e.g., all coding docs, all shopping, all social media)
- Related content (e.g., researching same topic across different sites)
- Actual page content and descriptions${existingGroupsText}${customKeywordsText}

Tabs:
${tabs.map((t, i) => `
${i}: "${t.title}"
   URL: ${t.url}
   Domain: ${t.domain}
   Current Group: ${t.groupId !== -1 ? 'Already in a group' : 'Not grouped'}
   Description: ${t.description || 'N/A'}
   Content Preview: ${t.content ? t.content.substring(0, 300) : 'N/A'}
`).join('\n---\n')}

Return a JSON array of groups. Each group should have:
- "name": short category name (based on actual content, existing groups, or user keywords)
- "tabIndices": array of tab indices that belong to this group
- "color": one of: grey, blue, red, yellow, green, pink, purple, cyan, orange
- "isExisting": true if this matches an existing group name, false for new groups

Example response:
[{"name": "Social Media", "tabIndices": [0, 3, 5], "color": "blue", "isExisting": true}]

Return ONLY the JSON array, no other text.`;

    const response = await callGeminiAPI(apiKey, prompt);
    return parseJsonResponse(response);
  }

  async function suggestTabsToClose(apiKey, tabs) {
    const prompt = `Analyze these browser tabs and suggest which ones could be closed.
Consider tabs that might be:
- Duplicate content (same topic across multiple tabs based on actual content)
- Likely finished/no longer needed (completed purchases, read articles, etc.)
- Generic/utility pages that can easily be reopened
- Old search results
- Similar content where one tab has more comprehensive info

Tabs:
${tabs.map((t, i) => `
${i}: "${t.title}"
   URL: ${t.url}
   Domain: ${t.domain}
   Description: ${t.description || 'N/A'}
   Content Preview: ${t.content ? t.content.substring(0, 300) : 'N/A'}
`).join('\n---\n')}

Return a JSON array of suggestions. Each suggestion should have:
- "tabIndex": the tab index
- "reason": brief reason why it could be closed (be specific based on content)

Be conservative - only suggest tabs that are clearly candidates for closing.
Return ONLY the JSON array, no other text. Return empty array [] if no suggestions.`;

    const response = await callGeminiAPI(apiKey, prompt);
    return parseJsonResponse(response);
  }

  async function callGeminiAPI(apiKey, prompt) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  function parseJsonResponse(text) {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }
  }

  function displayGroups(groups, tabData, existingGroups = []) {
    groupsEl.innerHTML = '<h3>Tab Groups</h3>';

    groups.forEach(group => {
      const groupTabs = group.tabIndices.map(i => tabData[i]).filter(Boolean);
      if (groupTabs.length === 0) return;

      const groupEl = document.createElement('div');
      groupEl.className = 'group-item';

      // Check if this is an existing group
      const isExisting = group.isExisting || existingGroups.some(eg => eg.title === group.name);
      if (isExisting) {
        groupEl.classList.add('existing-group');
      }

      // Create group header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'group-header';

      const badgeHtml = isExisting
        ? '<span class="group-badge">EXISTING</span>'
        : '<span class="group-badge" style="background: #667eea;">NEW</span>';

      headerDiv.innerHTML = `
        <span class="group-name">
          ${escapeHtml(group.name)}
          ${badgeHtml}
        </span>
        <span class="group-count">${groupTabs.length}</span>
      `;

      // Create tabs container
      const tabsDiv = document.createElement('div');
      tabsDiv.className = 'group-tabs';

      groupTabs.forEach(tab => {
        const tabDiv = document.createElement('div');
        tabDiv.className = 'group-tab';

        // Get favicon URL
        const faviconUrl = tab.url.startsWith('http')
          ? `https://www.google.com/s2/favicons?domain=${tab.domain}&sz=32`
          : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23667eea"/></svg>';

        tabDiv.innerHTML = `
          <div class="tab-header">
            <img src="${faviconUrl}" class="tab-favicon" onerror="this.style.display='none'">
            <span class="tab-title">${escapeHtml(tab.title)}</span>
            <span class="tab-expand-icon">▶</span>
          </div>
          <div class="tab-details">
            <div class="tab-url">${escapeHtml(tab.url)}</div>
            ${tab.description ? `<div class="tab-description">"${escapeHtml(tab.description)}"</div>` : ''}
            ${tab.content ? `<div class="tab-content-preview">${escapeHtml(tab.content.substring(0, 200))}...</div>` : ''}
            <div class="tab-actions">
              <button class="switch-tab-btn">Switch to Tab</button>
              <button class="close-single-tab-btn">Close Tab</button>
            </div>
          </div>
          <div class="tab-tooltip">
            <div class="tooltip-url">${escapeHtml(tab.url)}</div>
            ${tab.description ? `<div class="tooltip-desc">${escapeHtml(tab.description)}</div>` : ''}
            ${tab.content ? `<div class="tooltip-preview">${escapeHtml(tab.content.substring(0, 150))}...</div>` : '<div class="tooltip-preview">No content preview available</div>'}
          </div>
        `;

        // Toggle expand on click
        tabDiv.querySelector('.tab-header').addEventListener('click', () => {
          tabDiv.classList.toggle('expanded');
        });

        // Switch to tab
        tabDiv.querySelector('.switch-tab-btn')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await chrome.tabs.update(tab.id, { active: true });
          window.close();
        });

        // Close single tab
        tabDiv.querySelector('.close-single-tab-btn')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await chrome.tabs.remove(tab.id);
          tabDiv.remove();
          showStatus('Tab closed', 'success');
        });

        tabsDiv.appendChild(tabDiv);
      });

      // Create actions
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'group-actions';

      // Find if there's an existing group with this name
      const existingGroup = existingGroups.find(eg => eg.title === group.name);

      if (isExisting && existingGroup) {
        actionsDiv.innerHTML = '<button class="create-group-btn">Add to Existing Group</button>';

        actionsDiv.querySelector('.create-group-btn').addEventListener('click', async () => {
          const tabIds = groupTabs.map(t => t.id);
          // Add tabs to existing group
          await chrome.tabs.group({ tabIds, groupId: existingGroup.id });
          showStatus(`Added ${tabIds.length} tabs to: ${group.name}`, 'success');
        });
      } else {
        actionsDiv.innerHTML = '<button class="create-group-btn">Create Chrome Tab Group</button>';

        actionsDiv.querySelector('.create-group-btn').addEventListener('click', async () => {
          const tabIds = groupTabs.map(t => t.id);
          const groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, {
            title: group.name,
            color: group.color || 'blue'
          });
          showStatus(`Created group: ${group.name}`, 'success');
        });
      }

      groupEl.appendChild(headerDiv);
      groupEl.appendChild(tabsDiv);
      groupEl.appendChild(actionsDiv);
      groupsEl.appendChild(groupEl);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function displaySuggestions(suggestions, tabData) {
    suggestionsEl.innerHTML = suggestions.length > 0 ? '<h3>Suggested to Close</h3>' : '';

    suggestions.forEach(suggestion => {
      const tab = tabData[suggestion.tabIndex];
      if (!tab) return;

      const suggestionEl = document.createElement('div');
      suggestionEl.className = 'suggestion-item';
      suggestionEl.innerHTML = `
        <div class="suggestion-info">
          <div class="suggestion-title">${tab.title}</div>
          <div class="suggestion-reason">${suggestion.reason}</div>
        </div>
        <button class="close-tab-btn">Close</button>
      `;

      suggestionEl.querySelector('.close-tab-btn').addEventListener('click', async () => {
        await chrome.tabs.remove(tab.id);
        suggestionEl.remove();
        showStatus('Tab closed', 'success');
      });

      suggestionsEl.appendChild(suggestionEl);
    });
  }
});
