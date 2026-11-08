<section id="features" class="section" style="background-color: var(--bg-card)">
  <div class="container">
    <div class="section-header">
      <span class="section-tag">AI-First Architecture</span>
      <h2 class="section-title">Built for Thorough, Safe Code Reviews</h2>
      <p class="section-desc">
        Everything you need to review Git branches, interact with AI agents, and predict merge
        conflicts with zero disruption to your daily workspace.
      </p>
    </div>

    <div class="feature-grid">
      <div class="feature-card">
        <div class="feature-icon-box">
          <i class="fa-solid fa-microchip"></i>
        </div>
        <h3 class="feature-title">Multi-Model AI Flexibility</h3>
        <p class="feature-desc">
          Bring your own API keys for Anthropic Claude 3.7, OpenAI GPT-4o, Google Gemini 2.0,
          DeepSeek, or run 100% offline with local Ollama models. Switch models per review task
          seamlessly.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon-box">
          <i class="fa-solid fa-comments"></i>
        </div>
        <h3 class="feature-title">Interactive AI Discussions &amp; Patches</h3>
        <p class="feature-desc">
          Start threaded conversations right on any diff hunk. Ask the AI to refactor code, propose
          unit tests, or generate immediate Git patch diffs you can apply with one click.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon-box">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <h3 class="feature-title">Zero Working Tree Disruption</h3>
        <p class="feature-desc">
          Never stash uncommitted work or switch branches just to review changes. Stage0 reads
          directly from Git's object database and computes 3-way comparisons purely in memory.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon-box">
          <i class="fa-solid fa-code-compare"></i>
        </div>
        <h3 class="feature-title">Predictive Conflict Analysis</h3>
        <p class="feature-desc">
          Using Git's native
          <code>merge-tree --write-tree</code>, Stage0 anticipates merge collisions before code is
          pushed to remotes. Inspect exact conflict markers and affected files visually.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon-box">
          <i class="fa-solid fa-plug-circle-bolt"></i>
        </div>
        <h3 class="feature-title">Extensible via MCP &amp; ACP</h3>
        <p class="feature-desc">
          Connect Model Context Protocol (MCP) servers and Agent Client Protocol (ACP) agents. Let
          AI reviewers query linters, documentation, database schemas, and custom architecture
          rules.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon-box">
          <i class="fa-solid fa-lock"></i>
        </div>
        <h3 class="feature-title">100% Local-First &amp; Air-Gapped</h3>
        <p class="feature-desc">
          Your proprietary code never goes to an unapproved cloud. Review sessions are stored
          locally in SQLite, and API keys reside safely in your OS Credential Vault.
        </p>
      </div>
    </div>
  </div>
</section>
