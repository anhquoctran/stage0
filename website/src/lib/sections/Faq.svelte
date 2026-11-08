<script>
  let active = $state(-1);
</script>

<section id="faq" class="section">
  <div class="container">
    <div class="section-header">
      <span class="section-tag">Answers</span>
      <h2 class="section-title">Frequently Asked Questions</h2>
      <p class="section-desc">
        Common questions about AI reviewers, privacy, local-first Git operations, and offline
        support.
      </p>
    </div>

    <div class="faq-list">
      <div class="faq-item" class:open={active === 0}>
        <button
          class="faq-question"
          aria-expanded={active === 0}
          onclick={() => (active = active === 0 ? -1 : 0)}
        >
          <span>What makes Stage0 an AI-native Git code reviewer?</span>
          <i class="fa-solid fa-chevron-down faq-arrow"></i>
        </button>
        <div class="faq-answer">
          Stage0 is designed specifically for code review before code is published. It evaluates
          3-way branch diffs in-memory and deploys specialized AI reviewer bots (Security Sentinel,
          Architecture Guardian, Performance Auditor) directly to your changes, allowing interactive
          discussion, conflict prediction, and one-click patch application.
        </div>
      </div>

      <div class="faq-item" class:open={active === 1}>
        <button
          class="faq-question"
          aria-expanded={active === 1}
          onclick={() => (active = active === 1 ? -1 : 1)}
        >
          <span>What is Stage0's release schedule across Stable, Beta, and Nightly channels?</span>
          <i class="fa-solid fa-chevron-down faq-arrow"></i>
        </button>
        <div class="faq-answer">
          Stage0 follows an automated multi-channel release pipeline designed for predictable,
          scheduled delivery strictly at <strong>00:00:00 UTC</strong>:
          <ul
            style="
                                    margin: 0.75rem 0 0.75rem 1.25rem;
                                    line-height: 1.6;
                                "
          >
            <li>
              <strong>Stable (<code>origin/main</code>)</strong>: Released quarterly at 00:00 UTC on
              the 1st day of the first month of each quarter (Jan 1, Apr 1, Jul 1, Oct 1). SemVer:
              <code>0.0.x</code>. This is the official production build with maximum stability.
            </li>
            <li>
              <strong>Beta (<code>origin/beta</code>)</strong>: Released monthly at 00:00 UTC on the
              27th of every month. SemVer:
              <code>0.0.x-beta</code>. For teams and contributors testing feature-complete
              stabilization builds.
            </li>
            <li>
              <strong>Nightly (<code>origin/nightly</code>)</strong>: Released daily at 00:00 UTC
              every single day. SemVer: <code>0.0.x-nightly</code>. For active preview and
              bleeding-edge validation.
            </li>
          </ul>
          To ensure exact timing, GitHub Actions triggers a
          <strong>60-minute pre-build window</strong> at
          <code>23:00 UTC</code> to compile, sign with Minisign, and stage all 9 packages across 6
          OS targets before releasing to the public at exact 00:00 UTC. While preview channels
          increment patch numbers more frequently, <code>main</code> is authoritative as the official
          production release and in-app updaters never auto-upgrade Stable users to preview builds.
        </div>
      </div>

      <div class="faq-item" class:open={active === 2}>
        <button
          class="faq-question"
          aria-expanded={active === 2}
          onclick={() => (active = active === 2 ? -1 : 2)}
        >
          <span>Which AI models and providers can I use?</span>
          <i class="fa-solid fa-chevron-down faq-arrow"></i>
        </button>
        <div class="faq-answer">
          Stage0 supports Anthropic Claude (Claude 3.7 Sonnet / Haiku), OpenAI (GPT-4o, o3-mini),
          Google Gemini 2.0, DeepSeek, local offline models via Ollama or LM Studio, and custom ACP
          (Agent Client Protocol) external agents.
        </div>
      </div>

      <div class="faq-item" class:open={active === 3}>
        <button
          class="faq-question"
          aria-expanded={active === 3}
          onclick={() => (active = active === 3 ? -1 : 3)}
        >
          <span>Can I run AI reviews completely offline without an internet connection?</span>
          <i class="fa-solid fa-chevron-down faq-arrow"></i>
        </button>
        <div class="faq-answer">
          <strong>Yes!</strong> By configuring Ollama or a local OpenAI-compatible endpoint, Stage0 executes
          AI reviews, conflict analyses, and discussions completely offline on your own GPU/CPU. No data
          ever leaves your computer.
        </div>
      </div>

      <div class="faq-item" class:open={active === 4}>
        <button
          class="faq-question"
          aria-expanded={active === 4}
          onclick={() => (active = active === 4 ? -1 : 4)}
        >
          <span>Does Stage0 modify my working tree or uncommitted files?</span>
          <i class="fa-solid fa-chevron-down faq-arrow"></i>
        </button>
        <div class="faq-answer">
          <strong>No.</strong> Stage0 creates Virtual MRs entirely in memory using Git's native
          <code>git merge-tree --write-tree</code>. It never checks out branches, stashes files, or
          modifies your active working tree.
        </div>
      </div>

      <div class="faq-item" class:open={active === 5}>
        <button
          class="faq-question"
          aria-expanded={active === 5}
          onclick={() => (active = active === 5 ? -1 : 5)}
        >
          <span>How are my API keys and repository code kept secure?</span>
          <i class="fa-solid fa-chevron-down faq-arrow"></i>
        </button>
        <div class="faq-answer">
          API keys are vaulted directly into your operating system's native secure keyring (Windows
          Credential Manager, macOS Keychain, Linux Libsecret) and zeroized in memory immediately
          after use. Stage0 never commits secrets to JSON files or tracks telemetry.
        </div>
      </div>

      <div class="faq-item" class:open={active === 6}>
        <button
          class="faq-question"
          aria-expanded={active === 6}
          onclick={() => (active = active === 6 ? -1 : 6)}
        >
          <span>How is Stage0 different from GitHub Copilot or GitLab Duo?</span>
          <i class="fa-solid fa-chevron-down faq-arrow"></i>
        </button>
        <div class="faq-answer">
          While Copilot assists primarily with autocompleting code as you type, Stage0 acts as an
          <strong>independent, holistic code reviewer</strong>
          that evaluates branch comparisons, analyzes security threats, predicts 3-way merge conflicts,
          and enforces architecture boundaries locally
          <em>before</em> you open an official pull request.
        </div>
      </div>
    </div>
  </div>
</section>
