@import "tailwindcss";

@theme {
  --color-ivory: #F9F9F7;
  --color-ivory-dark: #F2F2EE;
  --color-brand-blue: #0A0A0A; /* Darker, almost black for sharp contrast */
  --color-brand-blue-light: #2563EB;
  --color-accent: #1E40AF;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

@layer base {
  body {
    background-color: var(--color-ivory);
    color: var(--color-brand-blue);
    -webkit-font-smoothing: antialiased;
  }
}

@layer components {
  .sharp-border {
    @apply border border-brand-blue/10;
  }
  
  .micro-label {
    @apply text-[10px] uppercase tracking-[0.15em] font-mono font-semibold opacity-40;
  }
}
