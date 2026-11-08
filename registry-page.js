"use strict";

(() => {
  const registry = window.CLARITY_REGISTRY;
  const search = document.getElementById("registry-search");
  if (!search) return;
  if (!registry) throw new Error("Clarity registry failed to load; refresh the reference page.");

  const makeCard = (titleText, detailsText, statusText, url, sourceLabel = "Open source") => {
    const card = document.createElement("article");
    card.className = "registry-page-card";
    const title = document.createElement("h4");
    title.textContent = titleText;
    const details = document.createElement("p");
    details.textContent = detailsText;
    const status = document.createElement("span");
    status.className = "registry-card-status";
    status.textContent = statusText;
    card.append(title, details, status);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${sourceLabel} ↗`;
      card.append(link);
    } else {
      const noSource = document.createElement("span");
      noSource.className = "registry-no-source";
      noSource.textContent = "No external source link listed";
      card.append(noSource);
    }
    return card;
  };

  const sections = [
    {
      id: "registry-modules",
      entries: registry.modules.map((module) => makeCard(
        module.label,
        `${module.fields.length} additional structured field(s); ${module.redFlags.length} additional red-flag checklist item(s). Documentation scaffold only; external source is for clinician review and is not used to generate diagnoses.`,
        module.status,
        module.source[1],
        module.source[0]
      ))
    },
    {
      id: "registry-scores",
      entries: registry.scoreRegistry.map((score) => makeCard(
        score.name,
        `${score.type}. Recorded inputs: ${score.inputs}`,
        score.status,
        score.url
      ))
    },
    {
      id: "registry-taxonomy",
      entries: registry.taxonomy.map((finding) => makeCard(
        finding.label,
        `Structured identifier: ${finding.id}`,
        `DOCUMENTATION LABEL · ${finding.modules.join(", ")}`
      ))
    }
  ];

  let total = 0;
  for (const section of sections) {
    const container = document.getElementById(section.id);
    const heading = container.previousElementSibling;
    section.container = container;
    section.heading = heading;
    section.items = section.entries.map((entry) => {
      container.append(entry);
      return entry;
    });
    total += section.items.length;
  }

  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const section of sections) {
      let sectionVisible = 0;
      for (const item of section.items) {
        const matches = item.textContent.toLocaleLowerCase().includes(query);
        item.hidden = !matches;
        if (matches) {
          visible += 1;
          sectionVisible += 1;
        }
      }
      section.container.hidden = sectionVisible === 0;
      section.heading.hidden = sectionVisible === 0;
    }
    document.getElementById("registry-page-count").textContent = `Showing ${visible} of ${total} registry entries. All modules are documentation scaffolds; calculations are not validated for clinical use.`;
  };

  search.addEventListener("input", filter);
  filter();
})();
