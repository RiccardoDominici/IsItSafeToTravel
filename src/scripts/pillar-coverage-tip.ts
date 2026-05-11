function initPillarCoverageTips() {
  const tips = document.querySelectorAll<HTMLElement>('.pillar-coverage-tip');
  tips.forEach((tip) => {
    if (tip.dataset.tipReady === '1') return;
    tip.dataset.tipReady = '1';

    const trigger = tip.querySelector<HTMLButtonElement>('.pillar-coverage-tip-trigger');
    const content = tip.querySelector<HTMLElement>('.pillar-coverage-tip-content');
    if (!trigger || !content) return;

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = !content.classList.contains('is-open');
      document.querySelectorAll<HTMLElement>('.pillar-coverage-tip-content.is-open').forEach((other) => {
        if (other !== content) {
          other.classList.remove('is-open');
          const otherTrigger = other.parentElement?.querySelector<HTMLButtonElement>('.pillar-coverage-tip-trigger');
          otherTrigger?.setAttribute('aria-expanded', 'false');
        }
      });
      content.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', String(willOpen));
    });
  });
}

function closeAllPillarCoverageTips() {
  document.querySelectorAll<HTMLElement>('.pillar-coverage-tip-content.is-open').forEach((c) => {
    c.classList.remove('is-open');
    const trigger = c.parentElement?.querySelector<HTMLButtonElement>('.pillar-coverage-tip-trigger');
    trigger?.setAttribute('aria-expanded', 'false');
  });
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target?.closest('.pillar-coverage-tip')) closeAllPillarCoverageTips();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAllPillarCoverageTips();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPillarCoverageTips);
} else {
  initPillarCoverageTips();
}
