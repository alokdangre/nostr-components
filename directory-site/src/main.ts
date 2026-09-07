import "./styles.css";
import {
  categories,
  directoryProfiles,
  type DirectoryCategory,
  type DirectoryProfile,
} from "./data";
import { formatFollowers, getVisibleProfiles, truncateNpub } from "./directory";
import { brandMark, icon, networkGraphic } from "./icons";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) throw new Error("Nostr Atlas app root was not found.");

const app = appRoot;

let profiles: DirectoryProfile[] = [...directoryProfiles];
let category: DirectoryCategory = "Popular on X.com";
let query = "";

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#039;",
        '"': "&quot;",
      })[character] ?? character,
  );

function profileRow(profile: DirectoryProfile): string {
  const safeName = escapeHtml(profile.name);
  const safeHandle = escapeHtml(profile.handle);
  const safeNip05 = escapeHtml(profile.nip05);
  const safeNpub = escapeHtml(profile.npub);

  return `
    <article class="profile-row" data-profile-id="${escapeHtml(profile.id)}">
      <div class="profile-primary">
        <span
          class="avatar"
          aria-hidden="true"
          style="--avatar-bg:${profile.avatar.background};--avatar-fg:${profile.avatar.foreground}"
        >${escapeHtml(profile.avatar.initials)}</span>
        <span class="profile-name-wrap">
          <span class="profile-name-line">
            <strong>${safeName}</strong>
            ${profile.verified ? `<span class="verified-mark" title="Nostr identity verified">${icon.check()}<span class="sr-only">Nostr identity verified</span></span>` : ""}
          </span>
          <span class="profile-handle">${safeHandle}</span>
        </span>
      </div>
      <a class="nip05-link" href="https://${safeNip05.includes("@") ? safeNip05.split("@")[1] : safeNip05}" target="_blank" rel="noreferrer">${safeNip05}</a>
      <button class="npub-copy" type="button" data-copy-npub="${safeNpub}" aria-label="Copy Nostr public key for ${safeName}">
        <span>${truncateNpub(profile.npub)}</span>
        ${icon.copy()}
      </button>
      <span class="followers"><strong>${formatFollowers(profile.followers)}</strong><span class="mobile-only"> audience</span></span>
      <span class="verified-cell">${profile.verified ? icon.check() : "—"}<span class="sr-only">${profile.verified ? "Nostr identity verified" : "Nostr identity not verified"}</span></span>
      <span class="youtube-cell">${profile.youtube ? escapeHtml(profile.youtube) : "—"}</span>
      <a class="profile-link" href="https://njump.me/${safeNpub}" target="_blank" rel="noreferrer">
        <span>Open Nostr profile</span>${icon.external()}
      </a>
    </article>`;
}

function renderProfiles(): void {
  const results = document.querySelector<HTMLDivElement>("#profile-results");
  const resultCount = document.querySelector<HTMLElement>("#result-count");
  if (!results || !resultCount) return;

  const visibleProfiles = getVisibleProfiles(profiles, {
    category,
    query,
  });

  resultCount.textContent = `${visibleProfiles.length} ${visibleProfiles.length === 1 ? "creator claim" : "creator claims"}`;
  results.innerHTML = visibleProfiles.length
    ? visibleProfiles.map(profileRow).join("")
    : `
      <div class="empty-state">
        <span>${icon.search()}</span>
        <h3>No creator claims found</h3>
        <p>Try an X handle, YouTube channel, NIP-05 address, or npub.</p>
        <button class="text-button" type="button" id="clear-filters">Clear search and filters</button>
      </div>`;
}

function renderApp(): void {
  app.innerHTML = `
    <header class="site-header">
      <div class="shell header-inner">
        <a class="brand" href="#top" aria-label="Nostr Atlas home">
          ${brandMark()}<span>Nostr Atlas</span>
        </a>
      </div>
    </header>

    <main id="top">
      <section class="hero shell" aria-labelledby="hero-heading">
        <div class="hero-copy">
          <h1 id="hero-heading">Receive zaps on X.com and YouTube.</h1>
          <p>Claim the accounts people already know, connect them to your Nostr identity, and give supporters a clear path to zap you across the web.</p>
          <button class="primary-button hero-cta" type="button" data-open-profile-dialog>
            ${icon.plusUser()}<span>Claim your X or YouTube account</span>
          </button>
          <form class="hero-search" id="hero-search" role="search">
            <label class="sr-only" for="directory-search">Search creator claims</label>
            ${icon.search()}
            <input id="directory-search" type="search" autocomplete="off" placeholder="Search X, YouTube, NIP-05, or npub" />
            <button type="submit" aria-label="Search creator claims">${icon.arrow()}</button>
          </form>
        </div>
        <div class="hero-network">${networkGraphic()}</div>
      </section>

      <section class="directory shell" id="directory" aria-label="Creator claims">
        <div class="directory-heading-row">
          <p id="result-count" aria-live="polite"></p>
        </div>

        <div class="tabs" role="tablist" aria-label="Creator claim categories">
          ${categories
            .map(
              (item) => `
                <button
                  class="tab ${item === category ? "selected" : ""}"
                  type="button"
                  role="tab"
                  aria-selected="${item === category}"
                  data-category="${item}"
                >${item}</button>`,
            )
            .join("")}
        </div>

        <div class="profile-table" role="region" aria-label="Creator claim directory" tabindex="0">
          <div class="table-header" aria-hidden="true">
            <span>Creator</span><span>Nostr address</span><span>npub (click to copy)</span><span>Audience</span><span>Nostr verified</span><span>YouTube channel</span><span></span>
          </div>
          <div id="profile-results"></div>
        </div>
      </section>

      <section class="how-it-works" id="how-it-works" aria-labelledby="steps-heading">
        <div class="shell steps-layout">
          <h2 id="steps-heading">From X or YouTube<br />to Nostr zaps</h2>
          <ol class="steps-list">
            <li><span class="step-number">1</span><span><strong>Claim</strong><small>Start with the X or YouTube account your audience already recognizes.</small></span></li>
            <li><span class="step-number">2</span><span><strong>Connect</strong><small>Associate it with your Nostr public key and NIP-05 address.</small></span></li>
            <li><span class="step-number">3</span><span><strong>Receive zaps</strong><small>Supporters with <a href="https://github.com/saiy2k/nostr-components/tree/main/browser-extension" target="_blank" rel="noreferrer">our extension</a> installed can zap you on X.com and YouTube.</small></span></li>
          </ol>
        </div>
      </section>
    </main>

    <footer class="site-footer" id="about">
      <div class="shell footer-inner">
        <div class="footer-brand">${brandMark()}<strong>Nostr Atlas</strong><i aria-hidden="true"></i><span>Built to help creators receive zaps on X.com and YouTube.</span></div>
        <nav aria-label="Footer navigation">
          <a href="https://github.com/nostr-protocol/nostr" target="_blank" rel="noreferrer">About Nostr</a>
          <a href="https://github.com/saiy2k/nostr-components" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>

    <dialog class="profile-dialog" id="profile-dialog" aria-labelledby="profile-dialog-title">
      <form method="dialog" class="dialog-card" id="add-profile-form">
        <div class="dialog-heading">
          <div><h2 id="profile-dialog-title">Preview a creator claim</h2><p>See how an X or YouTube account could appear with your Nostr identity. This stays in your browser.</p></div>
          <button class="icon-button" value="cancel" type="submit" aria-label="Close claim preview">${icon.close()}</button>
        </div>
        <div class="form-grid">
          <label>Creator name<input name="name" required maxlength="50" placeholder="Satoshi" /></label>
          <label>X or YouTube handle<input name="handle" required maxlength="50" placeholder="@satoshi" /></label>
          <label>Nostr address (NIP-05)<input name="nip05" required maxlength="100" placeholder="satoshi@example.com" /></label>
          <label>Claim tab<select name="category"><option>Popular on X.com</option><option>Popular on Nostr</option></select></label>
          <label class="full-field">Nostr public key<input name="npub" required minlength="20" pattern="npub1.+" placeholder="npub1…" /><small>Nostr public keys begin with npub1.</small></label>
        </div>
        <div class="dialog-actions">
          <button class="secondary-button" value="cancel" type="submit">Cancel</button>
          <button class="primary-button" value="default" type="submit">Add claim to preview</button>
        </div>
      </form>
    </dialog>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;

  renderProfiles();
  bindEvents();
}

function bindEvents(): void {
  const searchForm = document.querySelector<HTMLFormElement>("#hero-search");
  const searchInput =
    document.querySelector<HTMLInputElement>("#directory-search");
  const profileDialog =
    document.querySelector<HTMLDialogElement>("#profile-dialog");
  const addProfileForm =
    document.querySelector<HTMLFormElement>("#add-profile-form");

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    query = searchInput?.value ?? "";
    renderProfiles();
    document
      .querySelector("#directory")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  searchInput?.addEventListener("input", (event) => {
    query = (event.target as HTMLInputElement).value;
    renderProfiles();
  });

  document.querySelector(".tabs")?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-category]",
    );
    if (!button) return;
    category = button.dataset.category as DirectoryCategory;
    document
      .querySelectorAll<HTMLButtonElement>("[data-category]")
      .forEach((tab) => {
        const selected = tab === button;
        tab.classList.toggle("selected", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
    renderProfiles();
  });

  document
    .querySelector("#profile-results")
    ?.addEventListener("click", (event) => {
      const copyButton = (
        event.target as HTMLElement
      ).closest<HTMLButtonElement>("[data-copy-npub]");
      if (copyButton?.dataset.copyNpub)
        void copyNpub(copyButton.dataset.copyNpub, copyButton);

      const clearFilters = (
        event.target as HTMLElement
      ).closest<HTMLButtonElement>("#clear-filters");
      if (clearFilters) {
        query = "";
        category = "Popular on X.com";
        if (searchInput) searchInput.value = "";
        document
          .querySelectorAll<HTMLButtonElement>("[data-category]")
          .forEach((tab) => {
            const selected = tab.dataset.category === "Popular on X.com";
            tab.classList.toggle("selected", selected);
            tab.setAttribute("aria-selected", String(selected));
          });
        renderProfiles();
      }
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-open-profile-dialog]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        profileDialog?.showModal();
      });
    });

  addProfileForm?.addEventListener("submit", (event) => {
    const submitter = (event as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    if (submitter?.value === "cancel") return;
    event.preventDefault();
    if (!addProfileForm.reportValidity()) return;

    const formData = new FormData(addProfileForm);
    const name = String(formData.get("name") ?? "").trim();
    const handle = String(formData.get("handle") ?? "").trim();
    const categoryValue = String(
      formData.get("category") ?? "Popular on X.com",
    ) as DirectoryProfile["category"];
    const npub = String(formData.get("npub") ?? "").trim();

    profiles = [
      {
        id: `preview-${Date.now()}`,
        name,
        handle: handle.startsWith("@") ? handle : `@${handle}`,
        nip05: String(formData.get("nip05") ?? "").trim(),
        category: categoryValue,
        followers: 0,
        verified: false,
        npub,
        youtube: "",
        avatar: {
          initials: name
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          foreground: "#ffffff",
          background: "#7456f6",
        },
      },
      ...profiles,
    ];
    category = categoryValue;
    query = "";
    if (searchInput) searchInput.value = "";
    profileDialog?.close();
    addProfileForm.reset();
    document
      .querySelectorAll<HTMLButtonElement>("[data-category]")
      .forEach((tab) => {
        const selected = tab.dataset.category === categoryValue;
        tab.classList.toggle("selected", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
    renderProfiles();
    showToast(`${name} was added to your local claim preview.`);
  });

  profileDialog?.addEventListener("click", (event) => {
    if (event.target === profileDialog) profileDialog.close();
  });
}

async function copyNpub(
  npub: string,
  button: HTMLButtonElement,
): Promise<void> {
  try {
    if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(npub);
    button.classList.add("copied");
    showToast("Nostr public key copied to clipboard.");
    window.setTimeout(() => button.classList.remove("copied"), 1400);
  } catch {
    if (copyWithSelection(npub)) {
      button.classList.add("copied");
      showToast("Nostr public key copied to clipboard.");
      window.setTimeout(() => button.classList.remove("copied"), 1400);
      return;
    }

    showToast("Nostr public key could not be copied.");
  }
}

function copyWithSelection(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function showToast(message: string): void {
  const toast = document.querySelector<HTMLDivElement>("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

renderApp();
