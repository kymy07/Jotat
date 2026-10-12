// Shared visual feedback; independent of Firebase and the note editor.
(() => {
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const hero = document.querySelector(".hero__visual");
  const toggle = document.querySelector(".motion-toggle");
  const controls = ".pill, .icon-btn, .tabs button, .note-item, .shutter";
  let paused = false;
  let tiltFrame = 0;
  let bounds = null;

  const motionAllowed = () => !reducedMotion.matches && !paused;

  function resetTilt() {
    cancelAnimationFrame(tiltFrame);
    tiltFrame = 0;
    bounds = null;
    hero?.style.removeProperty("--tilt-x");
    hero?.style.removeProperty("--tilt-y");
  }

  function syncMotion() {
    root.toggleAttribute("data-motion-paused", paused);
    if (!motionAllowed()) {
      resetTilt();
      document.querySelectorAll(".press-ripple").forEach((ripple) => ripple.remove());
    }
    if (toggle) {
      toggle.hidden = reducedMotion.matches;
      toggle.textContent = paused ? "Play motion" : "Pause motion";
      toggle.setAttribute("aria-pressed", String(paused));
    }
  }

  toggle?.addEventListener("click", () => {
    paused = !paused;
    syncMotion();
  });
  reducedMotion.addEventListener("change", syncMotion);
  finePointer.addEventListener("change", resetTilt);
  syncMotion();

  // Content stays visible if JS or IntersectionObserver is unavailable.
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (motionAllowed()) entry.target.classList.add("is-revealed");
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: 0.12 });

    document.querySelectorAll(".section__head, .step, .feature, .cta-band__card").forEach((item) => {
      item.classList.add("motion-reveal");
      if (item.matches(".step, .feature")) {
        const index = Array.from(item.parentElement.children).indexOf(item);
        item.style.setProperty("--reveal-delay", `${index * 65}ms`);
      }
      revealObserver.observe(item);
    });

    if (hero) {
      const sceneObserver = new IntersectionObserver(([entry]) => {
        hero.classList.toggle("is-offscreen", !entry.isIntersecting);
        if (!entry.isIntersecting) resetTilt();
      });
      sceneObserver.observe(hero);
    }
  }

  // Tilt only the decorative preview. Touch keeps its normal scroll gesture.
  hero?.addEventListener("pointermove", (event) => {
    if (!motionAllowed() || !finePointer.matches || event.pointerType !== "mouse") return;
    bounds ||= hero.getBoundingClientRect();
    const x = Math.max(-0.5, Math.min(0.5, (event.clientX - bounds.left) / bounds.width - 0.5));
    const y = Math.max(-0.5, Math.min(0.5, (event.clientY - bounds.top) / bounds.height - 0.5));
    cancelAnimationFrame(tiltFrame);
    tiltFrame = requestAnimationFrame(() => {
      hero.style.setProperty("--tilt-x", `${-y * 7}deg`);
      hero.style.setProperty("--tilt-y", `${x * 7}deg`);
      tiltFrame = 0;
    });
  }, { passive: true });
  hero?.addEventListener("pointerleave", resetTilt);
  hero?.addEventListener("pointercancel", resetTilt);
  window.addEventListener("resize", resetTilt, { passive: true });
  window.addEventListener("blur", resetTilt);
  document.addEventListener("visibilitychange", () => {
    hero?.classList.toggle("is-page-hidden", document.hidden);
    if (document.hidden) resetTilt();
  });

  function rippleAt(event, centered = false) {
    if (!motionAllowed() || !(event.target instanceof Element)) return;
    const control = event.target.closest(controls);
    if (!control || control.matches(":disabled, [aria-disabled='true']")) return;
    const rect = control.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement("span");
    ripple.className = "press-ripple";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${(centered ? rect.width / 2 : event.clientX - rect.left) - size / 2}px`;
    ripple.style.top = `${(centered ? rect.height / 2 : event.clientY - rect.top) - size / 2}px`;
    // Bound the effect even during rapid repeated taps.
    control.querySelector(".press-ripple")?.remove();
    control.append(ripple);
    const timeout = setTimeout(() => ripple.remove(), 650);
    ripple.addEventListener("animationend", () => {
      clearTimeout(timeout);
      ripple.remove();
    }, { once: true });
  }

  document.addEventListener("pointerdown", (event) => {
    if (event.button === 0 && event.isPrimary) rippleAt(event);
  }, { passive: true });
  document.addEventListener("click", (event) => {
    if (event.detail === 0) rippleAt(event, true);
  });
})();
