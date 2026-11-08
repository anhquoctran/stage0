<script>
  import { asset, resolve } from '$app/paths';
</script>

<div class="comparison-table-wrapper">
  <table class="comparison-table">
    <thead>
      <tr>
        <th class="th-dim">Workflow Dimension</th>
        <th class="th-alt">
          <div class="th-title">Standard Web PR</div>
          <div class="th-sub">GitHub / GitLab</div>
        </th>
        <th class="th-alt">
          <div class="th-title">In-Editor AI Agent</div>
          <div class="th-sub">Cursor / Codex / Claude Code</div>
        </th>
        <th class="th-stage0">
          <div class="th-stage0-badge">
            <img src={asset('assets/app-icon.svg')} alt="Stage0 Logo" class="th-stage0-logo" />
            <span>Stage0 Virtual Reviewer</span>
          </div>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="td-dim"> Review Timing &amp; Flow </td>
        <td class="td-alt"> Late (after push, waiting for CI/human) </td>
        <td class="td-alt">
          <span class="val-warn"
            ><i class="fa-solid fa-triangle-exclamation"></i>
            Clutters editing tabs; interrupts active coding</span
          >
        </td>
        <td class="td-stage0">
          <span class="val-win"
            ><i class="fa-solid fa-check"></i>
            Instant &amp; Pre-Flight on local branches</span
          >
        </td>
      </tr>
      <tr>
        <td class="td-dim"> 3-Way Git Merge Context </td>
        <td class="td-alt"> Evaluated remotely on cloud servers </td>
        <td class="td-alt">
          <span class="val-cross"
            ><i class="fa-solid fa-xmark"></i>
            Zero 3-way merge base or conflict engine</span
          >
        </td>
        <td class="td-stage0">
          <span class="val-win"
            ><i class="fa-solid fa-check"></i>
            Full in-memory 3-way merge &amp; conflict preview</span
          >
        </td>
      </tr>
      <tr>
        <td class="td-dim">Working Tree Safety</td>
        <td class="td-alt"> Must push branch to remote </td>
        <td class="td-alt">
          <span class="val-cross"
            ><i class="fa-solid fa-xmark"></i>
            Mutates active files; requires branch checkout &amp; stash</span
          >
        </td>
        <td class="td-stage0">
          <span class="val-win"
            ><i class="fa-solid fa-check"></i>
            In-Memory sandbox, zero-checkout, 0% dirty tree risk</span
          >
        </td>
      </tr>
      <tr>
        <td class="td-dim"> Specialized Review Personas </td>
        <td class="td-alt"> Expensive third-party cloud bots </td>
        <td class="td-alt"> Single generalist chat prompt (one model fits all) </td>
        <td class="td-stage0">
          <span class="val-win"
            ><i class="fa-solid fa-check"></i>
            Multi-agent ensemble (Security, Arch, Perf, Merge)</span
          >
        </td>
      </tr>
      <tr>
        <td class="td-dim"> Confidentiality &amp; Privacy </td>
        <td class="td-alt"> Code hosted on public/private SaaS </td>
        <td class="td-alt">
          <span class="val-warn"
            ><i class="fa-solid fa-triangle-exclamation"></i>
            Cloud-dependent; proprietary code indexed offsite</span
          >
        </td>
        <td class="td-stage0">
          <span class="val-win"
            ><i class="fa-solid fa-check"></i>
            100% Local-First, native Ollama &amp; OS Keychain</span
          >
        </td>
      </tr>
    </tbody>
  </table>
</div>
